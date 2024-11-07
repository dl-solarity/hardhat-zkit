import { CircuitZKit, ProvingSystemType } from "@solarity/zkit";

import { ICircuitZKitBuilder } from "./core";
import { ICircuitArtifacts } from "./artifacts/circuit-artifacts";

export declare function getCircuit(
  circuitName: string,
  provingSystem?: ProvingSystemType,
): Promise<CircuitZKit<ProvingSystemType>>;

export interface HardhatZKit {
  circuitArtifacts: ICircuitArtifacts;
  circuitZKitBuilder: ICircuitZKitBuilder;

  getCircuit: typeof getCircuit;
}
