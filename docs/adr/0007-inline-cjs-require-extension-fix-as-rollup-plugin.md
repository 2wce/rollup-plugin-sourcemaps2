# Inline the CJS require-extension fix as a Rollup renderChunk plugin

Rollup emits `require('./foo.js')` in CJS output even when entry files are named `.cjs`. A `postbuild` script (`patch-paths.js`) currently fixes this with a regex over all `dist/**/*.cjs` files after the build completes. This is a fragile postprocessing step — it runs outside Rollup, depends on `glob` as a dev dependency, and can silently fail without affecting the build exit code.

The same transformation can be done inside Rollup using an inline `renderChunk` hook scoped to `format === 'cjs'`. This eliminates `patch-paths.js`, the `postbuild` npm script, and the `glob` dev dependency entirely.

## Consequences

The CJS extension fix becomes part of the build graph rather than a postprocessing side effect. Removing `glob` from devDependencies reduces the dependency surface.

A test should assert that CJS output contains `require('./foo.cjs')` rather than `require('./foo.js')` — the existing integration tests produce a full Rollup bundle and are the right place to add this assertion.
