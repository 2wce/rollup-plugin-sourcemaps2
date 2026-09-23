# Unit test source-map-resolve and decode-uri-component directly

Most tests exercise the plugin through a full Rollup bundle simulation that invokes the TypeScript compiler. Although `resolveSourceMap` already has a direct test, `resolveSources`, `getSourceMappingUrl`, and the remaining path-resolution helpers in `source-map-resolve.ts` are primarily covered through the bundle round-trip. `decode-uri-component.ts` has zero direct tests.

The fix is to add `source-map-resolve.test.ts` and `decode-uri-component.test.ts` with focused unit tests covering edge cases that the integration tests cannot efficiently reach: malformed sourceMappingURL comments, `sourceRoot` resolution, Windows drive paths, data URIs, the XSSI prefix strip, BOM handling, and the binary-split fallback in the decoder.

## Consequences

These unit tests must exist before the merges in ADR-0001 and ADR-0002 are attempted — they lock current behavior and make refactoring safe. Sub-millisecond tests replace ~100-300ms Rollup round-trips for logic that lives entirely inside the resolution module.
