import { CompileOptions } from "../compile";

export interface CacheEntry {
  lastModificationDate: number;
  contentHash: string;
  sourceName: string;
  compileOptions: CompileOptions;
  imports: string[];
  versionPragmas: string[];
}

export interface Cache {
  _format: string;
  files: Record<string, CacheEntry>;
}
