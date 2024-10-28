export type CompileFlags = {
  r1cs: boolean;
  wasm: boolean;
  sym: boolean;
  json: boolean;
  c: boolean;
  O0: boolean;
  O1: boolean;
  O2: boolean;
};

export type BaseCompileConfig = {
  circuitFullPath: string;
  artifactsFullPath: string;
  errorFileFullPath: string;
  linkLibraries: string[];
  quiet: boolean;
};

export type CompileConfig = BaseCompileConfig & {
  compileFlags: CompileFlags;
};

export interface ICircomCompiler {
  compile: (config: CompileConfig) => Promise<void>;

  getCompilationArgs: (config: CompileConfig) => string[];
}
