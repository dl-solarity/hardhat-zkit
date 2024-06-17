import { CircuitZKit } from "@solarity/zkit";

export declare function getCircuit(circuitName: string): Promise<CircuitZKit>;

export interface HardhatZKit {
  getCircuit: typeof getCircuit;
}
