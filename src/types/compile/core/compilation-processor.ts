import { ResolvedFile } from "hardhat/types/builtin-tasks";

import { CompilerVersion } from "./circom-compiler-factory";
import { CompileFlags } from "./circom-compiler";

export type CompilationProccessorConfig = {
  compilerVersion: CompilerVersion;
  compileFlags: CompileFlags;
};

export type CompilationInfo = {
  circuitName: string;
  tempArtifactsPath: string;
  artifactsPath: string;
  resolvedFile: ResolvedFile;
  constraintsNumber: number;
};
