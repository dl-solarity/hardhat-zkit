import { CircuitZKit, ProvingSystemType } from "@solarity/zkit";

import { ICircuitArtifacts } from "./artifacts/circuit-artifacts.js";
import { ICircuitZKitBuilder } from "./core/zkit/circuit-zkit-builder.js";

export declare function getCircuit(
  circuitName: string,
  provingSystem?: ProvingSystemType,
): Promise<CircuitZKit<ProvingSystemType>>;

export interface HardhatZKit {
  circuitArtifacts: ICircuitArtifacts;
  circuitZKitBuilder: ICircuitZKitBuilder;

  getCircuit: typeof getCircuit;
}
