import { CompileOptions } from "./compile";

export type ZKitConfig = {
  compilationSettings: CompilationSettings;
  circuitsDir: string;
  verifiersDir: string;
  ptauDir: string | undefined;
  ptauDownload: boolean;
};

export type CompilationSettings = FileFilterSettings &
  CompileOptions & {
    artifactsDir: string;
    contributionTemplate: ContributionTemplateType;
    contributions: number;
  };

export type FileFilterSettings = {
  onlyFiles: string[];
  skipFiles: string[];
};

export type ContributionTemplateType = "groth16";
