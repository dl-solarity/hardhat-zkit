import { CompileFlags } from "./circom-compiler";

export interface CacheEntry {
  lastModificationDate: number;
  contentHash: string;
  sourceName: string;
  compileFlags: CompileFlags;
  imports: string[];
  versionPragmas: string[];
}

export interface Cache {
  _format: string;
  files: Record<string, CacheEntry>;
}
