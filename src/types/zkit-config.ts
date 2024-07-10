export type ZKitConfig = {
  compilationSettings: CompilationSettings;
  typesSettings: CircuitTypesSettings;
  circuitsDir: string;
  verifiersDir: string;
  ptauDir: string | undefined;
  ptauDownload: boolean;
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
  contributionTemplate: ContributionTemplateType;
  contributions: number;
};

export type FileFilterSettings = {
  onlyFiles: string[];
  skipFiles: string[];
};

export type ContributionTemplateType = "groth16";
