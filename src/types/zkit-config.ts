export type ZKitConfig = {
  compilationSettings: CompilationSettings;
  verifiersSettings: VerifiersGenerationSettings;
  circuitsDir: string;
  ptauDir: string | undefined;
  allowDownload: boolean;
};

export type CompilationSettings = FileFilterSettings & {
  artifactsDir: string;
  sym: boolean;
  json: boolean;
  c: boolean;
  quiet: boolean;
};

export type VerifiersGenerationSettings = FileFilterSettings & {
  verifiersDir: string;
};

export type FileFilterSettings = {
  onlyFiles: string[];
  skipFiles: string[];
};
