import { CompileFlags, ContributionSettings } from "../src/types/core";

export const defaultCompileFlags: CompileFlags = {
  r1cs: true,
  wasm: true,
  sym: true,
  c: false,
  json: false,
  O0: false,
  O1: false,
  O2: false,
};

export const defaultContributionSettings: ContributionSettings = {
  provingSystem: "groth16",
  contributions: 1,
};
