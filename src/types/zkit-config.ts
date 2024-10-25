import { VerifierLanguageType } from "@solarity/zkit";

import { ContributionSettings } from "./core";

export type ZKitConfig = {
  compilerVersion?: string;
  circuitsDir: string;
  compilationSettings: CompilationSettings;
  setupSettings: SetupSettings;
  verifiersSettings: VerifiersSettings;
  typesDir: string;
  quiet: boolean;
};

export type CompileSimplificationFlags = {
  o0: boolean;
  o1: boolean;
  o2: boolean;
  oldSimplificationHeuristics: boolean;
  simplificationSubstitution: boolean;
};

export type CompilationSettings = FileFilterSettings & {
  artifactsDir: string;
  c: boolean;
  json: boolean;
  simplification: CompileSimplificationFlags;
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

export type VerifiersSettings = {
  verifiersDir: string;
  verifiersType: VerifierLanguageType;
};
