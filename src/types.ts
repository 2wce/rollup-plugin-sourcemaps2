import { CreateFilter } from '@rollup/pluginutils';
import { ExistingRawSourceMap } from 'rollup';

export interface ResolvedSources {
  sourcesResolved: string[];
  sourcesContent: (string | Error)[];
}

export interface ResolvedSourceMap {
  map: ExistingRawSourceMap;
  url: string | null;
  sourcesRelativeTo: string;
  sourceMappingURL: string;
}

export interface SourcemapsPluginOptions {
  include?: Parameters<CreateFilter>[0];
  exclude?: Parameters<CreateFilter>[1];
  readFile?(path: string, callback: (error: Error | null, data: Buffer | string) => void): void;
}
