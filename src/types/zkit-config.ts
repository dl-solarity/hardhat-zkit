import { VerifierLanguageType } from "@solarity/zkit";

import { ContributionSettings } from "./core";

export type ZKitConfig = {
  compilationSettings: CompilationSettings;
  setupSettings: SetupSettings;
  typesSettings: CircuitTypesSettings;
  circuitsDir: string;
  verifiersDir: string;
  verifiersType: VerifierLanguageType;
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
  json: boolean;
};

export type SetupSettings = FileFilterSettings & {
  ptauDir: string | undefined;
  ptauDownload: boolean;
  contributionSettings: ContributionSettings;
};

export type FileFilterSettings = {
  onlyFiles: string[];
  skipFiles: string[];
};
