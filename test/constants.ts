import type { CompileFlags } from "../src/types/core/compiler/circom-compiler.js";
import type { SetupContributionSettings } from "../src/types/core/setup/setup-processor.js";

export const defaultCompileFlags: CompileFlags = {
  r1cs: true,
  wasm: true,
  sym: true,
  c: false,
  json: false,
  O0: false,
  O1: true,
  O2: false,
};

export const defaultContributionSettings: SetupContributionSettings = {
  provingSystems: ["groth16"],
  contributions: 2,
};
