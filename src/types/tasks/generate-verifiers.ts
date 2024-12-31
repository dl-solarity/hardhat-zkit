import { VerifierLanguageType } from "@solarity/zkit";

import { CircuitArtifact } from "../artifacts/circuit-artifacts";

export type GenerateVerifiersTaskConfig = {
  verifiersDir?: string;
  verifiersType?: VerifierLanguageType;
  noCompile: boolean;
  quiet: boolean;
  force: boolean;
};

export type CircuitArtifactInfo = {
  name: string;
  circuitArtifact: CircuitArtifact;
};
