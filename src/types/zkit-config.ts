export type ZKitConfig = {
  compilationSettings: CompilationSettings;
  setupSettings: SetupSettings;
  typesSettings: CircuitTypesSettings;
  circuitsDir: string;
  verifiersDir: string;
  ptauDir: string | undefined;
  ptauDownload: boolean;
  nativeCompiler: boolean;
  quiet: boolean;
};

export type CircuitTypesSettings = {
  typesArtifactsDir: string;
  typesDir: string;
};

export type CompilationSettings = FileFilterSettings & {
  artifactsDir: string;
  c: boolean;
  sym: boolean;
  json: boolean;
};

export type SetupSettings = FileFilterSettings & {
  contributionTemplate: ContributionTemplateType;
  contributions: number;
};

export type FileFilterSettings = {
  onlyFiles: string[];
  skipFiles: string[];
};

export type ContributionTemplateType = "groth16";
