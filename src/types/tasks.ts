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
  optimization?: "O0" | "O1" | "O2";
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
