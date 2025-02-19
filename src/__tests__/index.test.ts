import fs from 'node:fs';
import path from 'node:path';
import util from 'node:util';
import { rollup } from 'rollup';
import ts from 'typescript';
/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-non-null-assertion */
import { describe, expect, it, test } from 'vitest';

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
}: ts.TranspileOutput & {
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

it('ignores files with no source maps', async () => {
  const { outputText, sourceMapText } = ts.transpileModule(inputText, {
    fileName: inputPath,
    compilerOptions: {
      target: ts.ScriptTarget.ES2017,
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
      const { outputText, sourceMapText } = ts.transpileModule(inputText, {
        fileName: inputPath,
        compilerOptions: {
          target: ts.ScriptTarget.ES2017,
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
    const { outputText, sourceMapText } = ts.transpileModule(inputText, {
      fileName: inputPath,
      compilerOptions: {
        target: ts.ScriptTarget.ES2017,
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
    const { outputText, sourceMapText } = ts.transpileModule(inputText, {
      fileName: inputPath,
      compilerOptions: {
        target: ts.ScriptTarget.ES2017,
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
  const { outputText, sourceMapText } = ts.transpileModule(inputText, {
    fileName: inputPath,
    compilerOptions: {
      target: ts.ScriptTarget.ES2017,
      sourceMap: true,
    },
  });

  expect(sourceMapText).toBeDefined();

  const { map } = await rollupBundle({
    outputText,
    sourceMapText,
    pluginOptions: {
      readFile(_path: string, cb: (error: Error | null, data: Buffer | string) => void) {
        cb(new Error('Failed!'), '');
      },
    },
  });

  expect(map).toBeDefined();
  expect(map?.sources.map(source => path.normalize(source))).toStrictEqual([outputPath]);
  expect(map?.sourcesContent).toStrictEqual([outputText]);
});

it('handles failing source maps reads', async () => {
  const { outputText, sourceMapText } = ts.transpileModule(inputText, {
    fileName: inputPath,
    compilerOptions: {
      target: ts.ScriptTarget.ES2017,
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
