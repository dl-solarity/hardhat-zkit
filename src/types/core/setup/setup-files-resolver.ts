import { CircuitArtifact } from "../../circuit-artifacts";

export type CircuitSetupInfo = {
  circuitArtifact: CircuitArtifact;
  r1csSourcePath: string;
  r1csContentHash: string;
  circuitArtifactFullPath: string;
};
