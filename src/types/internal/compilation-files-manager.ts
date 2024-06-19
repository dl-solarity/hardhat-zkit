import { ResolvedFile } from "hardhat/types";

export type ResolvedFileWithDependencies = {
  resolvedFile: ResolvedFile;
  dependencies: ResolvedFile[];
};

export type CompilationFilesManagerConfig = {
  artifactsDir?: string;
  ptauDir?: string;
  ptauDownload: boolean;
  force: boolean;
};
