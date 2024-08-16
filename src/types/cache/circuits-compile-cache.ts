import { CircomFileData, CompileFlags } from "../core";

export type CompileCacheEntry = {
  lastModificationDate: number;
  contentHash: string;
  sourceName: string;
  compileFlags: CompileFlags;
  fileData: CircomFileData;
};

export type CompileCache = {
  _format: string;
  files: Record<string, CompileCacheEntry>;
};
