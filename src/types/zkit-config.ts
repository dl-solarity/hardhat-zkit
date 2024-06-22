export type ZKitConfig = {
  compilationSettings: CompilationSettings;
  circuitsDir: string;
  verifiersDir: string;
  ptauDir: string | undefined;
  ptauDownload: boolean;
};

export type CompilationSettings = FileFilterSettings & {
  artifactsDir: string;
  quiet: boolean;
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
