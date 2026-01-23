import path from 'node:path';
import type { ExistingRawSourceMap } from 'rollup';
import decodeUriComponent from './decode-uri-component.js';

interface ResolvedSources {
  sourcesResolved: string[];
  sourcesContent: (string | Error)[];
}

interface ResolvedSourceMap {
  map: ExistingRawSourceMap;
  url: string | null;
  sourcesRelativeTo: string;
  sourceMappingURL: string;
}

function isWindowsDrivePath(value: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(value);
}

function isUrl(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z\\d+.-]*:/.test(value) && !isWindowsDrivePath(value);
}

function resolveUrl(...args: string[]): string {
  let resolved = args[0] ?? '';
  for (let index = 1; index < args.length; index++) {
    const nextUrl = args[index] ?? '';
    if (!nextUrl) {
      continue;
    }

    if (isUrl(nextUrl)) {
      resolved = nextUrl;
      continue;
    }

    if (isUrl(resolved)) {
      resolved = new URL(nextUrl, resolved).toString();
      continue;
    }

    resolved = path.resolve(path.dirname(resolved), nextUrl);
  }

  return resolved;
}

function customDecodeUriComponent(encodedURI: string): string {
  return decodeUriComponent(encodedURI.replace(/\+/g, '%2B'));
}

function parseMapToJSON(string: string): ExistingRawSourceMap {
  return <ExistingRawSourceMap>JSON.parse(string.replace(/^\)\]\}'/, ''));
}

const sourceMappingURLRegex =
  /(?:\/\*(?:\s*\r?\n(?:\/\/)?)?(?:[#@] sourceMappingURL=([^\s'"]*))\s*\*\/|\/\/(?:[#@] sourceMappingURL=([^\s'"]*)))\s*/g;

function getSourceMappingUrl(code: string): string | null {
  const match = Array.from(code.matchAll(sourceMappingURLRegex)).pop();
  return match ? match[1] || match[2] || '' : null;
}

export async function resolveSourceMap(
  code: string,
  codeUrl: string,
  read: (path: string) => Promise<Buffer | string>,
): Promise<ResolvedSourceMap | null> {
  const sourceMappingURL = getSourceMappingUrl(code);
  if (!sourceMappingURL) {
    return null;
  }
  const dataUri = /^data:([^,;]*)(;[^,;]*)*(?:,(.*))?$/.exec(sourceMappingURL);
  if (dataUri) {
    const mimeType = dataUri[1] || 'text/plain';
    if (!/^(?:application|text)\/json$/.test(mimeType)) {
      throw new Error(`Unuseful data uri mime type: ${mimeType}`);
    }
    const payload = dataUri[3] || '';
    const decoded =
      dataUri[2] === ';base64'
        ? Buffer.from(payload, 'base64').toString('utf8')
        : decodeURIComponent(payload);
    const map = parseMapToJSON(decoded);
    return { sourceMappingURL, url: null, sourcesRelativeTo: codeUrl, map };
  }
  const url = resolveUrl(codeUrl, sourceMappingURL);
  const map = parseMapToJSON(String(await read(customDecodeUriComponent(url))));
  return { sourceMappingURL, url, sourcesRelativeTo: url, map };
}

export async function resolveSources(
  map: ExistingRawSourceMap,
  mapUrl: string,
  read: (path: string) => Promise<Buffer | string>,
): Promise<ResolvedSources> {
  const sourcesResolved: string[] = [];
  const sourcesContent: (string | Error)[] = [];
  for (let index = 0, len = map.sources.length; index < len; index++) {
    const sourceRoot = map.sourceRoot;
    const sourceContent = (map.sourcesContent || [])[index];
    const resolvePaths = [mapUrl, map.sources[index]];
    if (sourceRoot !== undefined && sourceRoot !== '') {
      resolvePaths.splice(1, 0, sourceRoot.replace(/\/?$/, '/'));
    }
    sourcesResolved[index] = resolveUrl(...resolvePaths);
    if (typeof sourceContent === 'string') {
      sourcesContent[index] = sourceContent;
      continue;
    }
    try {
      const source = await read(customDecodeUriComponent(sourcesResolved[index]));
      sourcesContent[index] = String(source);
    } catch (error) {
      sourcesContent[index] = <Error>error;
    }
  }
  return { sourcesResolved, sourcesContent };
}
