import swc from '@rollup/plugin-swc';
import { globSync } from 'glob';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export default /** @type {import('rollup').RollupOptions} */ ({
  input: Object.fromEntries(
    globSync('src/**/*.ts')
      .filter(file => !file.includes('src/__tests__/')) // Filter out files in src/__tests__
      .map(file => [
        // This remove `src/` as well as the file extension from each
        // file, so e.g. src/nested/foo.js becomes nested/foo
        path.relative('src', file.slice(0, file.length - path.extname(file).length)),
        // This expands the relative paths to absolute paths, so e.g.
        // src/nested/foo becomes /project/src/nested/foo.js
        fileURLToPath(new URL(file, import.meta.url)),
      ]),
  ),
  external: () => true,
  plugins: [swc()],
  output: [
    {
      dir: 'dist',
      format: 'es',
      sourcemap: true,
      entryFileNames: '[name].js',
      preserveModules: true,
    },
    {
      dir: 'dist',
      format: 'cjs',
      sourcemap: true,
      entryFileNames: '[name].cjs',
      preserveModules: true,
    },
  ],
});
