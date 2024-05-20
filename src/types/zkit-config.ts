export type ZKitConfig = {
  compilationSettings: CompilationSettings;
  verifiersSettings: VerifiersGenerationSettings;
  circuitsDir: string;
  ptauDir: string | undefined;
  allowDownload: boolean;
};

export type CompilationSettings = {
  artifactsDir: string;
  sym: boolean;
  json: boolean;
  c: boolean;
  quiet: boolean;
};

export type VerifiersGenerationSettings = {
  verifiersDir: string;
};
