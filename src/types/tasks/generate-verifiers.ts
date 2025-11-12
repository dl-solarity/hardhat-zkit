import { VerifierLanguageType } from "@solarity/zkit";

import { CircuitArtifact } from "../artifacts/circuit-artifacts.js";

export type GenerateVerifiersTaskConfig = {
  verifiersDir?: string;
  verifiersType?: string; //VerifierLanguageType; todo
  noCompile: boolean;
  quiet: boolean;
  force: boolean;
};

export type CircuitArtifactInfo = {
  name: string;
  circuitArtifact: CircuitArtifact;
};
