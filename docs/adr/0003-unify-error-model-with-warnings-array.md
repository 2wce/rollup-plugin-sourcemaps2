# Unify the error model: return warnings array, use null for missing sourcesContent entries

Three different patterns currently represent "we could not load something, degrade gracefully": a `(string | Error)[]` union in `sourcesContent`, `this.warn()` + early return in `index.ts`, and silent omission when partial source failures occur. The third case is a bug: when some sources fail to load, the map is returned with no `sourcesContent` and no warning issued.

The source map spec v3 allows `null` entries in `sourcesContent`. The resolution module should populate entries it can read, use `null` for entries it cannot, and return a `warnings` array that the plugin shell emits via `this.warn()`.

## Consequences

Fixes the silent partial-failure bug. Eliminates the `(string | Error)[]` union type. Creates a single place to audit degradation behavior: the resolution module decides what failed, the plugin shell decides how to report it.
