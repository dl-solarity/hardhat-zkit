import { ResolvedFile } from "hardhat/types";

export type ResolvedFileWithDependencies = {
  resolvedFile: ResolvedFile;
  dependencies: ResolvedFile[];
};

export type CompileOptions = {
  sym: boolean;
  json: boolean;
  c: boolean;
  quiet: boolean;
};

export type CircuitCompilationInfo = {
  circuitName: string;
  tempArtifactsPath: string;
  artifactsPath: string;
  resolvedFile: ResolvedFile;
  compileOptions: CompileOptions;
  compilationArgs: string[];
};

export type PtauInfo = {
  file: string;
  downloadURL: string;
};
