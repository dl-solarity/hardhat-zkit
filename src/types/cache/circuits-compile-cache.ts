import { CompileFlags } from "../compile/core/circom-compiler";

export type CompileCacheEntry = {
  lastModificationDate: number;
  contentHash: string;
  sourceName: string;
  compileFlags: CompileFlags;
  imports: string[];
  versionPragmas: string[];
};

export type CompileCache = {
  _format: string;
  files: Record<string, CompileCacheEntry>;
};
