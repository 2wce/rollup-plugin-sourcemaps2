import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import util from 'node:util';
import { transformSync } from '@swc/core';
import { type PluginContext, rollup } from 'rollup';
/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-non-null-assertion */
import { describe, expect, it, test, vi } from 'vitest';

import sourcemaps, { type SourcemapsPluginOptions } from '..';
import { resolveSourceMap } from '../source-map-resolve';

const inputPath = path.join(__dirname, '../index.ts');
const inputText = fs.readFileSync(inputPath, 'utf8');

const outputPath = path.format({
  dir: path.dirname(inputPath),
  name: path.basename(inputPath, path.extname(inputPath)),
  ext: '.js',
});

const sourceMapPath = path.format({
  dir: path.dirname(inputPath),
  name: path.basename(inputPath, path.extname(inputPath)),
  ext: '.js.map',
});

type TranspileOptions = {
  fileName: string;
  compilerOptions: {
    inlineSourceMap?: boolean;
    inlineSources?: boolean;
    sourceMap?: boolean;
  };
};

type TranspileOutput = {
  outputText: string;
  sourceMapText?: string;
};

function transpile(
  input: string,
  { fileName, compilerOptions }: TranspileOptions,
): TranspileOutput {
  const sourceMaps = compilerOptions.inlineSourceMap
    ? 'inline'
    : compilerOptions.sourceMap === true;
  const result = transformSync(input, {
    filename: fileName,
    inlineSourcesContent: compilerOptions.inlineSources,
    jsc: {
      parser: {
        syntax: 'typescript',
      },
      target: 'es2017',
    },
    sourceMaps,
  });

  return {
    outputText: compilerOptions.sourceMap
      ? `${result.code}\n//# sourceMappingURL=${path.basename(sourceMapPath)}`
      : result.code,
    sourceMapText: result.map,
  };
}

// Function to compare two file paths
function comparePath(a: string, b: string): boolean {
  // Split the paths into segments
  const first = a.split(/[\\/]/);
  const second = b.split(/[\\/]/);

  // If the platform is Windows, convert the first segment (drive letter) to lowercase
  if (process.platform === 'win32') {
    first[0] = first[0].toLowerCase();
    second[0] = second[0].toLowerCase();
  }

  // Return true if both paths have the same number of segments and all corresponding segments are equal
  return first.length === second.length && first.every((v, i) => v === second[i]);
}

async function rollupBundle({
  outputText,
  sourceMapText,
  pluginOptions,
}: TranspileOutput & {
  pluginOptions?: SourcemapsPluginOptions;
}) {
  const load = async (path: string) => {
    if (comparePath(path, inputPath)) {
      return inputText;
    }

    if (comparePath(path, outputPath)) {
      return outputText;
    }

    if (sourceMapText && comparePath(path, sourceMapPath)) {
      return sourceMapText;
    }

    throw new Error(`Unexpected path: ${path}`);
  };

  const { generate } = await rollup({
    input: outputPath,
    external: () => true,
    plugins: [
      { name: 'skip-checks', resolveId: path => path },
      sourcemaps({
        readFile: util.callbackify(load),
        ...pluginOptions,
      }),
      { name: 'fake-fs', load },
    ],
  });

  const { output } = await generate({
    format: 'esm',
    sourcemap: true,
    sourcemapPathTransform(relativePath) {
      return path.resolve(__dirname, '..', '..', relativePath);
    },
  });

  return output[0];
}

// Invokes the plugin's load hook directly with no readFile option so the default reader runs
async function loadWithDefaultReadFile(id: string) {
  // No options, so the plugin falls back to its fs-backed defaultReadFile
  const plugin = sourcemaps();

  // Minimal stand-in for Rollup's PluginContext; only the two methods load() calls are mocked
  const context = { addWatchFile: vi.fn(), warn: vi.fn() } as unknown as PluginContext;

  // Plugin['load'] may be a function or an object hook; this plugin always returns a function
  const load = plugin.load as (this: PluginContext, id: string) => Promise<unknown>;

  // Call the hook the way Rollup would, with the context bound as `this`
  const result = await load.call(context, id);

  // Return the context too so callers can assert on addWatchFile and warn
  return { result, context };
}

it('ignores files with no source maps', async () => {
  const { outputText, sourceMapText } = transpile(inputText, {
    fileName: inputPath,
    compilerOptions: {
      sourceMap: false,
      inlineSourceMap: false,
    },
  });

  expect(sourceMapText).toBeUndefined();

  const { map } = await rollupBundle({ outputText, sourceMapText });

  expect(map).toBeDefined();
  expect(map?.sources).toStrictEqual([outputPath]);
  expect(map?.sourcesContent).toStrictEqual([outputText]);
});

describe('detects files with source maps', () => {
  test.each`
    sourceMap | inlineSourceMap | inlineSources
    ${true}   | ${false}        | ${false}
    ${false}  | ${true}         | ${false}
    ${true}   | ${false}        | ${true}
    ${false}  | ${true}         | ${true}
  `(
    'sourceMap: $sourceMap, inlineSourceMap: $inlineSourceMap, inlineSources: $inlineSources',
    async ({ sourceMap, inlineSourceMap, inlineSources }: Record<string, boolean>) => {
      const { outputText, sourceMapText } = transpile(inputText, {
        fileName: inputPath,
        compilerOptions: {
          sourceMap,
          inlineSourceMap,
          inlineSources,
        },
      });

      if (sourceMap) {
        expect(sourceMapText).toBeDefined();
      } else {
        expect(sourceMapText).toBeUndefined();
      }

      const { map } = await rollupBundle({ outputText, sourceMapText });

      expect(map).toBeDefined();
      expect(map?.sources.map(source => path.normalize(source))).toStrictEqual([inputPath]);
      expect(map?.sourcesContent).toStrictEqual([inputText]);
    },
  );
});

describe('ignores filtered files', () => {
  test('included', async () => {
    const { outputText, sourceMapText } = transpile(inputText, {
      fileName: inputPath,
      compilerOptions: {
        sourceMap: true,
      },
    });

    expect(sourceMapText).toBeDefined();

    const { map } = await rollupBundle({
      outputText,
      sourceMapText,
      pluginOptions: {
        include: ['dummy-file'],
      },
    });

    expect(map).toBeDefined();
    expect(map?.sources.map(source => path.normalize(source))).toStrictEqual([outputPath]);
    expect(map?.sourcesContent).toStrictEqual([outputText]);
  });

  test('excluded', async () => {
    const { outputText, sourceMapText } = transpile(inputText, {
      fileName: inputPath,
      compilerOptions: {
        sourceMap: true,
      },
    });

    expect(sourceMapText).toBeDefined();

    const { map } = await rollupBundle({
      outputText,
      sourceMapText,
      pluginOptions: {
        exclude: [path.relative(process.cwd(), outputPath).split('\\').join('/')],
      },
    });

    expect(map).toBeDefined();
    expect(map?.sources.map(source => path.normalize(source))).toStrictEqual([outputPath]);
    expect(map?.sourcesContent).toStrictEqual([outputText]);
  });
});

it('delegates failing file reads to the next plugin', async () => {
  const { outputText, sourceMapText } = transpile(inputText, {
    fileName: inputPath,
    compilerOptions: {
      sourceMap: true,
    },
  });

  expect(sourceMapText).toBeDefined();

  const { map } = await rollupBundle({
    outputText,
    sourceMapText,
    pluginOptions: {
      readFile(_path: string, cb: (error: Error | null, data: string) => void) {
        cb(new Error('Failed!'), '');
      },
    },
  });

  expect(map).toBeDefined();
  expect(map?.sources.map(source => path.normalize(source))).toStrictEqual([outputPath]);
  expect(map?.sourcesContent).toStrictEqual([outputText]);
});

it('handles failing source maps reads', async () => {
  const { outputText, sourceMapText } = transpile(inputText, {
    fileName: inputPath,
    compilerOptions: {
      sourceMap: true,
    },
  });

  expect(sourceMapText).toBeDefined();

  const { map } = await rollupBundle({
    outputText,
    sourceMapText,
    pluginOptions: {
      readFile: util.callbackify(async (path: string) => {
        switch (path) {
          case inputPath:
            return inputText;
          case outputPath:
            return outputText;
          default:
            throw new Error(`Unexpected path: ${path}`);
        }
      }),
    },
  });

  expect(map).toBeDefined();
  expect(map?.sources.map(source => path.normalize(source))).toStrictEqual([outputPath]);
  expect(map?.sourcesContent).toStrictEqual([outputText]);
});

it('finds last source map file definition', async () => {
  const multipleSourceMappingFile = `
    function test(sourceMapUrl: string): string {
      return \`/*# sourceMappingURL=\${sourceMapUrl} */\`;
    }
    //# sourceMappingURL=index.js.map
  `;

  const multipleSourceMappingMapFile =
    '{"version":3,"file":"index.js","sourceRoot":"","sources":["index.ts"],"names":[],"mappings":"AAAA,SAAS,IAAI,CAAC,YAAoB;IAChC,OAAO,+BAAwB,YAAY,QAAK,CAAC;AACnD,CAAC"}';

  let requestedSourceMap: string | null = null;

  const map = await resolveSourceMap(
    multipleSourceMappingFile,
    '/dev/null/index.js',
    async path => {
      requestedSourceMap = path;
      return multipleSourceMappingMapFile;
    },
  );

  expect(requestedSourceMap).toEqual('/dev/null/index.js.map');

  expect(map).toBeDefined();
  expect(map?.url).toEqual('/dev/null/index.js.map');
});

it('skips directories even when the filesystem lets them be read', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sourcemaps2-'));
  // Mimic macOS devfs, where read() on the /dev directory succeeds and returns raw bytes.
  // fs.stat is left untouched so the guard runs against a real directory.
  const readFile = vi
    .spyOn(fs, 'readFile')
    .mockImplementation(((
      _path: string,
      _options: unknown,
      cb: (err: null, data: string) => void,
    ) => cb(null, 'not a source file')) as typeof fs.readFile);

  try {
    const { result, context } = await loadWithDefaultReadFile(dir);

    expect(result).toBeNull();
    expect(readFile).not.toHaveBeenCalled();
    expect(context.addWatchFile).not.toHaveBeenCalled();
    expect(context.warn).toHaveBeenCalledWith('Failed reading file');
  } finally {
    readFile.mockRestore();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

it('reads regular files with the default readFile', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sourcemaps2-'));
  const filePath = path.join(dir, 'plain.js');
  const fileText = 'export const value = 1;\n';
  fs.writeFileSync(filePath, fileText);

  try {
    const { result, context } = await loadWithDefaultReadFile(filePath);

    expect(result).toStrictEqual(fileText);
    expect(context.addWatchFile).toHaveBeenCalledTimes(1);
    expect(context.addWatchFile).toHaveBeenCalledWith(filePath);
    expect(context.warn).not.toHaveBeenCalled();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

it('correctly handles Chinese and non-ASCII characters in source files', async () => {
  // Chinese string
  const chineseText = 'console.log("你好，世界！"); // 中文字符测试';
  // Transpile with source map
  const { outputText, sourceMapText } = transpile(chineseText, {
    fileName: inputPath,
    compilerOptions: {
      sourceMap: true,
      inlineSourceMap: false,
      inlineSources: true,
    },
  });

  expect(sourceMapText).toBeDefined();

  const { map, code } = await rollupBundle({ outputText, sourceMapText });

  // The code should contain the original Chinese characters
  expect(code).toContain('你好，世界');
  // The sourcesContent should also contain the original Chinese characters
  expect(map?.sourcesContent?.[0]).toContain('你好，世界');
});
