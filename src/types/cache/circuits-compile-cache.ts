import { CompileFlags } from "../compile/core/circom-compiler";

export interface CompileCacheEntry {
  lastModificationDate: number;
  contentHash: string;
  sourceName: string;
  compileFlags: CompileFlags;
  imports: string[];
  versionPragmas: string[];
}

export interface CompileCache {
  _format: string;
  files: Record<string, CompileCacheEntry>;
}
