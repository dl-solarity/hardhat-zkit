import { CompileFlags, ResolvedFileData } from "../core";

export type CompileCacheEntry = {
  lastModificationDate: number;
  contentHash: string;
  sourceName: string;
  compileFlags: CompileFlags;
  fileData: ResolvedFileData;
};

export type CompileCache = {
  _format: string;
  files: Record<string, CompileCacheEntry>;
};
