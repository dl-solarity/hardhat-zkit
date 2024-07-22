import { ResolvedFile } from "hardhat/types/builtin-tasks";

import { CompilerVersion } from "../compiler/circom-compiler-factory";
import { CompileFlags } from "../compiler/circom-compiler";

export type CompilationProccessorConfig = {
  compilerVersion: CompilerVersion;
  compileFlags: CompileFlags;
};

export type CompilationInfo = {
  circuitName: string;
  circuitFileName: string;
  tempArtifactsPath: string;
  artifactsPath: string;
  resolvedFile: ResolvedFile;
  constraintsNumber: number;
};
