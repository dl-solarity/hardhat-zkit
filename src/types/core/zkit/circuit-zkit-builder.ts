import { CircuitZKit, IProtocolImplementer, ProvingSystemType } from "@solarity/zkit";

export interface ICircuitZKitBuilder {
  getCircuitZKit(
    circuitName: string,
    provingSystem?: ProvingSystemType,
    verifiersDir?: string,
  ): Promise<CircuitZKit<ProvingSystemType>>;

  getProtocolImplementer(provingSystem: ProvingSystemType): IProtocolImplementer<ProvingSystemType>;
}
