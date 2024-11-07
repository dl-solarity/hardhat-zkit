import { ProvingSystemType } from "@solarity/zkit";

import { CircuitArtifact } from "../../artifacts/circuit-artifacts";

export type CircuitSetupInfo = {
  circuitArtifact: CircuitArtifact;
  r1csSourcePath: string;
  r1csContentHash: string;
  circuitArtifactFullPath: string;
  provingSystems: ProvingSystemType[];
};
