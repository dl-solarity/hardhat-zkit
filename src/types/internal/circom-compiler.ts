export type CompileFlags = {
  r1cs: boolean;
  wasm: boolean;
  sym: boolean;
  json: boolean;
  c: boolean;
};

export type CompileConfig = {
  circuitFullPath: string;
  artifactsFullPath: string;
  compileFlags: CompileFlags;
  quiet: boolean;
};

export interface ICircomCompiler {
  compile: (config: CompileConfig) => Promise<void>;

  getCompilationArgs: (config: CompileConfig) => string[];
}
