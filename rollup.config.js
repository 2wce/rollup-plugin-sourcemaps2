// @ts-check
import typescript from '@rollup/plugin-typescript';

export default /** @type {import('rollup').RollupOptions} */ ({
  input: 'src/index.ts',
  // internals are ./source-map-resolve or .../src/source-map-resolve.ts
  external: name => !(name.startsWith('.') || name.endsWith('.ts')),
  plugins: [typescript()],
  output: [
    {
      dir: 'dist',
      format: 'es',
      sourcemap: true,
      entryFileNames: '[name].js',
    },
    {
      dir: 'dist',
      format: 'cjs',
      sourcemap: true,
      entryFileNames: '[name].cjs',
      exports: 'default',
    },
  ],
});
