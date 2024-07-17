import { VerifierTemplateType } from "@solarity/zkit";

export type CompileShallowTaskConfig = {
  force: boolean;
  sym: boolean;
  json: boolean;
  c: boolean;
  quiet: boolean;
};

export type CompileTaskConfig = {
  artifactsDir?: string;
  ptauDir?: string;
  ptauDownload?: boolean;
  force: boolean;
  sym: boolean;
  json: boolean;
  c: boolean;
  quiet: boolean;
};

export type GenerateVerifiersTaskConfig = {
  artifactsDir?: string;
  verifiersDir?: string;
  noCompile: boolean;
  quiet: boolean;
  force: boolean;
};

export type GetCircuitZKitConfig = {
  artifactsDir?: string;
  verifiersDir?: string;
  verifierTemplateType?: VerifierTemplateType;
  circuitName: string;
};
