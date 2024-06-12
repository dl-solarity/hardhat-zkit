import { CompileOptions } from "./compile";

export type ZKitConfig = {
  compilationSettings: CompilationSettings;
  verifiersSettings: VerifiersGenerationSettings;
  circuitsDir: string;
  ptauDir: string | undefined;
  allowDownload: boolean;
};

export type CompilationSettings = FileFilterSettings &
  CompileOptions & {
    artifactsDir: string;
    contributionTemplate: ContributionTemplateType;
    contributions: number;
  };

export type VerifiersGenerationSettings = FileFilterSettings & {
  verifiersDir: string;
};

export type FileFilterSettings = {
  onlyFiles: string[];
  skipFiles: string[];
};

export type ContributionTemplateType = "groth16";
