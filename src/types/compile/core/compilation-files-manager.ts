import { ResolvedFile } from "hardhat/types/builtin-tasks";

export type ResolvedFileInfo = {
  circuitName: string;
  resolvedFile: ResolvedFile;
  dependencies: ResolvedFile[];
};

export type CompilationFilesManagerConfig = {
  artifactsDir?: string;
  ptauDir?: string;
  ptauDownload: boolean;
  force: boolean;
};
