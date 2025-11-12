import { ProvingSystemType } from "@solarity/zkit"; // todo

export * from "./compile.js";
export * from "./setup.js";
export * from "./make.js";
export * from "./generate-verifiers.js";

export type GetCircuitZKitConfig = {
  circuitName: string;
  verifiersDir?: string;
  provingSystem?: string;
};
