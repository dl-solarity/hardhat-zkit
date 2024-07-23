import { VerifierTemplateType } from "@solarity/zkit";

export type CompileShallowTaskConfig = {
  force: boolean;
  sym: boolean;
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
  sym: boolean;
  json: boolean;
  c: boolean;
  quiet: boolean;
};

export type GenerateVerifiersTaskConfig = {
  verifiersDir?: string;
  noCompile: boolean;
  quiet: boolean;
  force: boolean;
};

export type GetCircuitZKitConfig = {
  verifiersDir?: string;
  verifierTemplateType?: VerifierTemplateType;
  circuitName: string;
};
