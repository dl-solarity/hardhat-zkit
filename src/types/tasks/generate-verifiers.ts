import { VerifierLanguageType } from "@solarity/zkit";

export type GenerateVerifiersTaskConfig = {
  verifiersDir?: string;
  verifiersType?: VerifierLanguageType;
  noCompile: boolean;
  quiet: boolean;
  force: boolean;
};
