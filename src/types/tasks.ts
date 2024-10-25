import { VerifierLanguageType, VerifierProvingSystem } from "@solarity/zkit";

export type MakeTaskConfig = {
  force: boolean;
  json: boolean;
  c: boolean;
  quiet: boolean;
};

export type SetupTaskConfig = {
  force: boolean;
  quiet: boolean;
};

export type CompileTaskConfig = {
  force: boolean;
  json: boolean;
  c: boolean;
  quiet: boolean;
  o0: boolean;
  o1: boolean;
  o2: boolean;
  oldSimplificationHeuristics: boolean;
  simplificationSubstitution: boolean;
};

export type GenerateVerifiersTaskConfig = {
  verifiersDir?: string;
  verifiersType?: VerifierLanguageType;
  noCompile: boolean;
  quiet: boolean;
  force: boolean;
};

export type GetCircuitZKitConfig = {
  verifiersDir?: string;
  verifierTemplateType?: VerifierProvingSystem;
  circuitName: string;
};
