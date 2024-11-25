import { ProvingSystemType } from "@solarity/zkit";

export * from "./compile";
export * from "./setup";
export * from "./make";
export * from "./generate-verifiers";

export type GetCircuitZKitConfig = {
  circuitName: string;
  verifiersDir?: string;
  provingSystem?: ProvingSystemType;
};
