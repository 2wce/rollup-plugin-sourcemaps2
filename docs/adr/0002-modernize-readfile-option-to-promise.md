# Change readFile option from callback to Promise-returning function

The public `readFile` option accepts a Node.js callback-style function `(path, callback) => void`, which is immediately wrapped with `util.promisify`. Internally, `source-map-resolve.ts` already expects a promise-returning reader. Tests that inject a fake reader must use `util.callbackify` to convert an async function back to callback style, creating a round-trip conversion that obscures the real contract.

The option shape should be `(path: string) => Promise<string>`. The option itself is worth keeping — it enables virtual filesystems and in-memory caches for consumers that don't use the real filesystem. Only the callback convention is wrong.

## Considered Options

- **Drop the option entirely** — rejected. The option has genuine utility for consumers with virtual filesystems or custom read layers. Removing it would force them to wrap the plugin.
- **Accept both signatures** — rejected. Runtime duck-typing adds complexity for a compatibility concern that isn't established by usage.

## Consequences

This is a breaking change to the public API. It removes `util.promisify` from `index.ts`, simplifies test setup, and aligns the option's declared type with what `source-map-resolve.ts` actually requires.
