# Test and clean up the query-string retry in the load hook

`index.ts` retries a failed file read after stripping a `?query` suffix from the id. This handles Vite-style query parameters (`?worker`, `?raw`). The path has no test coverage, making it a candidate for accidental removal during refactoring. There is also a type inconsistency: `.toString()` is called on the result of the retry read (line 55) but not on the initial read (line 48), suggesting uncertainty about whether `readFile` returns a `Buffer` or a `string`.

The fix is to add a test that passes an id with a `?query` suffix where the base file exists, and to remove the `.toString()` call — the promisified `readFile` returns `string` per its type signature, making the conversion dead code.

## Consequences

Prevents the retry from rotting as a seemingly dead code path. Clarifies the `readFile` contract: it always returns `string`, never `Buffer`.
