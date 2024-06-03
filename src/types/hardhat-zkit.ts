import { CircuitZKit, CircuitInfo } from "@solarity/zkit";

export declare function getCircuit(circuitName: string): Promise<CircuitZKit>;

export declare function getCircuitsInfo(withMainComponent?: boolean): Promise<CircuitInfo[]>;

export interface HardhatZKit {
  getCircuit: typeof getCircuit;
  getCircuitsInfo: typeof getCircuitsInfo;
}
