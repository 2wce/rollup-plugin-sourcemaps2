# Keep decode-uri-component vendored but add attribution and tests

`src/decode-uri-component.ts` is a TypeScript port of the npm package `decode-uri-component`. It has no attribution comment, no tests, and no mechanism to pull upstream fixes. It earns its keep — deleting it and using `decodeURIComponent` directly would lose graceful handling of malformed percent-sequences, a real concern for source map paths from non-conforming tools and Windows paths.

The file should carry a `// Vendored from decode-uri-component@<version>` header, and ADR-0004 mandates direct tests that lock its behavior.

## Considered Options

- **Add the npm package as a dependency** — rejected. The plugin has a single runtime dependency by design (`@rollup/pluginutils`). Adding a dependency for 103 lines of well-understood code conflicts with that constraint. If the upstream package releases a meaningful fix, the vendor copy can be updated manually.

## Consequences

Future contributors know the file's provenance and can check upstream for fixes. The test coverage from ADR-0004 prevents silent regressions in the trickiest code in the repo.
