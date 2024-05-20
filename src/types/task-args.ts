export type CompilationTaskArgs = {
  artifactsDir: string;
  sym: boolean;
  json: boolean;
  c: boolean;
  quiet: boolean;
};

export type VerifiersGenerationTaskArgs = {
  verifiersDir: string;
};
