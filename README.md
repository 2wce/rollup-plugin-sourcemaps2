# rollup-plugin-sourcemaps2

[![npm](https://img.shields.io/npm/v/rollup-plugin-sourcemaps2.svg)](https://www.npmjs.com/package/rollup-plugin-sourcemaps2)
[![Build Status](https://img.shields.io/travis/maxdavidson/rollup-plugin-sourcemaps2/master.svg)](https://travis-ci.org/maxdavidson/rollup-plugin-sourcemaps2)
[![Coverage Status](https://img.shields.io/coveralls/maxdavidson/rollup-plugin-sourcemaps2/master.svg)](https://coveralls.io/github/maxdavidson/rollup-plugin-sourcemaps2?branch=master)

[Rollup](https://rollupjs.org) plugin for loading files with existing source maps.
Inspired by [webpack/source-map-loader](https://github.com/webpack/source-map-loader).

Works with rollup 4 or later.

If you use [rollup-plugin-babel](https://github.com/rollup/rollup-plugin-babel),
you might be able to use the [`inputSourceMap`](https://babeljs.io/docs/en/options#inputsourcemap) option instead of this plugin.

## Why?

- You transpile your files with source maps before bundling with rollup
- You consume external modules with bundled source maps

## Usage

```javascript
import sourcemaps from 'rollup-plugin-sourcemaps2';

export default {
  input: 'src/index.js',
  plugins: [sourcemaps()],
  output: {
    sourcemap: true,
    file: 'dist/my-awesome-package.js',
  },
};
```
