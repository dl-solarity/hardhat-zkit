import { CircuitZKit, CircuitInfo } from "@solarity/zkit";

export declare function getCircuit(circuit: string): Promise<CircuitZKit>;

export declare function getCircuitsInfo(): CircuitInfo[];

export interface HardhatZKit {
  getCircuit: typeof getCircuit;
  getCircuitsInfo: typeof getCircuitsInfo;
}
