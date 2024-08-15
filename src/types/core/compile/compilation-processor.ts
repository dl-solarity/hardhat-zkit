import { CompilerVersion } from "../compiler/circom-compiler-factory";
import { CompileFlags } from "../compiler/circom-compiler";
import { CircomResolvedFile } from "../dependencies";

export type CompilationProccessorConfig = {
  compilerVersion: CompilerVersion;
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
