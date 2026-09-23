# Merge resolveSourceMap and resolveSources into a single resolve function

`resolveSourceMap` and `resolveSources` are always called in sequence from `index.ts`; no caller ever uses one without the other. The intermediate `ResolvedSourceMap` type exists only to pass data between them across the module boundary, and its `sourcesRelativeTo` and `url` fields are never used by `index.ts`. Orchestration logic — null-checking the result, extracting `.map`, deciding whether to call `resolveSources` — leaks into the plugin shell where it doesn't belong.

The fix is to export a single `resolve(code, codeUrl, read)` that chains internally and returns a fully-populated map or null. `ResolvedSourceMap` and `ResolvedSources` become private implementation details.

## Consequences

The `load` hook in `index.ts` shrinks significantly. The error-filtering decision (whether partial source failures produce a map or not) moves next to the code that produces the errors, giving locality. The merged function is unit-testable with a fake `read` without Rollup.
