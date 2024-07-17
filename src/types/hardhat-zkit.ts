import { CircuitZKit } from "@solarity/zkit";
import { ICircuitArtifacts } from "./artifacts";

export declare function getCircuit(circuitName: string): Promise<CircuitZKit>;

export interface HardhatZKit {
  circuitArtifacts: ICircuitArtifacts;

  getCircuit: typeof getCircuit;
}
