import { CompileFlags, SetupContributionSettings } from "../src/types/core";

export const defaultCompileFlags: CompileFlags = {
  r1cs: true,
  wasm: true,
  sym: true,
  c: false,
  json: false,
};

export const defaultContributionSettings: SetupContributionSettings = {
  provingSystems: ["groth16"],
  contributions: 2,
};
