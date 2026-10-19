---
"rollup-plugin-sourcemaps2": patch
---

Skip paths that are not regular files in the default `readFile`. Previously a readable directory such as `/dev` on macOS was returned as module source and handed to the bundler's watcher, which could crash a Vite dev server on a hard navigation to a `/dev` route.
