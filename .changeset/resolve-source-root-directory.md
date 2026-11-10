---
"rollup-plugin-sourcemaps2": patch
---

Resolve sources inside the map's `sourceRoot` directory on filesystem paths. The trailing slash of the root was stripped, so `sourceRoot: "src"` with `sources: ["index.ts"]` resolved to `index.ts` next to the map instead of `src/index.ts`, and the map lost its `sourcesContent`.
