import { CompileFlags } from "../compiler/circom-compiler.js";
import { CircomResolvedFile } from "../dependencies/circom-files-resolver.js";

export type CompilationProcessorConfig = {
  compileFlags: CompileFlags;
  quiet: boolean;
};

export type CompilationInfo = {
  circuitName: string;
  circuitFileName: string;
  tempArtifactsPath: string;
  artifactsPath: string;
  resolvedFile: CircomResolvedFile;
  constraintsNumber: number;
};

export type NativeCompiler = {
  binaryPath: string;
  version: string;
};
