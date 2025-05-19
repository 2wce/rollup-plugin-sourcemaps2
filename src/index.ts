import fs from "node:fs"
import { promisify } from "node:util"
import pluginUtils, { type CreateFilter } from "@rollup/pluginutils"
import type { ExistingRawSourceMap, Plugin, PluginContext } from "rollup"
import { resolveSourceMap, resolveSources } from "./source-map-resolve.js"

const { createFilter } = pluginUtils

export interface SourcemapsPluginOptions {
  include?: Parameters<CreateFilter>[0]
  exclude?: Parameters<CreateFilter>[1]
  readFile?(
    path: string,
    callback: (error: Error | null, data: string) => void
  ): void
}

export default function sourcemaps(
  // eslint-disable-next-line @typescript-eslint/unbound-method
  { include, exclude, readFile }: SourcemapsPluginOptions = {}
): Plugin {
  // Create a filter function based on the include and exclude options
  const filter = createFilter(include, exclude)

  // Default readFile that always reads as UTF-8 string
  const defaultReadFile = (
    path: string,
    cb: (err: NodeJS.ErrnoException | null, data: string) => void
  ) => {
    fs.readFile(path, "utf8", cb)
  }

  // Use the provided readFile or the default one
  const effectiveReadFile = readFile || defaultReadFile

  // Promisify the readFile function
  const promisifiedReadFile = promisify(effectiveReadFile)

  return {
    name: "sourcemaps",

    load: async function (this: PluginContext, id: string) {
      let code: string
      // If the id does not pass the filter, return null
      if (!filter(id)) {
        return null
      }

      try {
        // Try to read the file with the given id
        code = await promisifiedReadFile(id)
        // Add the file to the watch list
        this.addWatchFile(id)
      } catch {
        try {
          // If reading fails, try again without a query suffix that some plugins use
          const cleanId = id.replace(/\?.*$/, "")
          code = (await promisifiedReadFile(cleanId)).toString()
          // Add the file to the watch list
          this.addWatchFile(cleanId)
        } catch {
          // If reading still fails, warn and return null
          this.warn("Failed reading file")
          return null
        }
      }

      let map: ExistingRawSourceMap
      try {
        // Try to resolve the source map for the code
        const result = await resolveSourceMap(code, id, promisifiedReadFile)

        // If the code contained no sourceMappingURL, return the code
        if (result === null) {
          return code
        }

        // If the source map was resolved, assign it to map
        map = result.map
      } catch {
        // If resolving the source map fails, warn and return the code
        this.warn("Failed resolving source map")
        return code
      }

      // If the sources are not included in the map, try to resolve them
      if (map.sourcesContent === undefined) {
        try {
          const { sourcesContent } = await resolveSources(
            map,
            id,
            promisifiedReadFile
          )
          // If all sources are strings, assign them to map.sourcesContent
          if (sourcesContent.every((item) => typeof item === "string")) {
            map.sourcesContent = sourcesContent
          }
        } catch {
          // If resolving the sources fails, warn
          this.warn("Failed resolving sources for source map")
        }
      }

      // Return the code and the map
      return { code, map }
    },
  }
}
