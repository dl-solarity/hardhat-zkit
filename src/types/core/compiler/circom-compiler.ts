export type CompileFlags = {
  r1cs: boolean;
  wasm: boolean;
  sym: boolean;
  json: boolean;
  c: boolean;
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

export interface IWASMCircomCompiler extends ICircomCompiler {
  generateAST: (config: BaseCompileConfig) => Promise<void>;

  getASTGenerationArgs: (config: BaseCompileConfig) => string[];
}
