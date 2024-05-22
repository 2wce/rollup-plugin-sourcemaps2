import { ExistingRawSourceMap } from 'rollup';
import * as urlLib from 'url';
import decodeUriComponent from './decode-uri-component';
import { ResolvedSourceMap, ResolvedSources } from './types';

function resolveUrl(...args: string[]): string {
  return args.reduce((resolved, nextUrl) => urlLib.resolve(resolved, nextUrl), '');
}

function customDecodeUriComponent(encodedURI: string): string {
  return decodeUriComponent(encodedURI.replace(/\+/g, '%2B'));
}

function parseMapToJSON(string: string): ExistingRawSourceMap {
  return <ExistingRawSourceMap>JSON.parse(string.replace(/^\)\]\}'/, ''));
}

const sourceMappingURLRegex =
  /(?:\/\*(?:\s*\r?\n(?:\/\/)?)?(?:[#@] sourceMappingURL=([^\s'"]*))\s*\*\/|\/\/(?:[#@] sourceMappingURL=([^\s'"]*)))\s*/;

function getSourceMappingUrl(code: string): string | null {
  const match = sourceMappingURLRegex.exec(code);
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
      throw new Error('Unuseful data uri mime type: ' + mimeType);
    }
    const map = parseMapToJSON(
      (dataUri[2] === ';base64' ? atob : decodeURIComponent)(dataUri[3] || ''),
    );
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
