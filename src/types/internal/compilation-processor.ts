import { CompilerVersion } from "./circom-compiler-factory";
import { CompileFlags } from "./circom-compiler";
import { ResolvedFile } from "../../internal/Resolver";

export type CompilationProccessorConfig = {
  compilerVersion: CompilerVersion;
  compileFlags: CompileFlags;
  quiet: boolean;
};

export type CompilationInfo = {
  circuitName: string;
  tempArtifactsPath: string;
  artifactsPath: string;
  resolvedFile: ResolvedFile;
};
