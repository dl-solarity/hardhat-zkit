import { VerifierLanguageType, ProvingSystemType } from "@solarity/zkit";

export type ZKitConfig = {
  compilerVersion?: string;
  circuitsDir: string;
  compilationSettings: CompilationSettings;
  setupSettings: SetupSettings;
  verifiersSettings: VerifiersSettings;
  typesDir: string;
  quiet: boolean;
};

export type CompilationSettings = FileFilterSettings & {
  artifactsDir: string;
  c: boolean;
  json: boolean;
};

export type SetupSettings = FileFilterSettings & {
  ptauDir: string | undefined;
  ptauDownload: boolean;
  contributionSettings: ContributionSettings;
};

export type ContributionSettings = {
  provingSystem: ProvingSystemType | ProvingSystemType[];
  contributions: number;
};

export type FileFilterSettings = {
  onlyFiles: string[];
  skipFiles: string[];
};

export type VerifiersSettings = {
  verifiersDir: string;
  verifiersType: VerifierLanguageType;
};
