import { CompileFlags } from "../core/compiler/circom-compiler.js";
import { ResolvedFileData } from "../core/dependencies/circom-files-resolver.js";

export type CompileCacheEntry = {
  lastModificationDate: number;
  contentHash: string;
  sourceName: string;
  compileFlags: CompileFlags;
  fileData: ResolvedFileData;
};
