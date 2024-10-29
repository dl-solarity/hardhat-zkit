import { CircuitZKit, ProvingSystemType } from "@solarity/zkit";

import { ICircuitArtifacts } from "./artifacts/circuit-artifacts";

export declare function getCircuit(
  circuitName: string,
  provingSystem: ProvingSystemType,
): Promise<CircuitZKit<typeof provingSystem>>;

export interface HardhatZKit {
  circuitArtifacts: ICircuitArtifacts;

  getCircuit: typeof getCircuit;
}
