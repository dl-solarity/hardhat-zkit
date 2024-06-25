import { ConfigExtender } from "hardhat/types";

import { ZKitConfig } from "../types/zkit-config";
import { RecursivePartial } from "../types/utils";
import { deepMerge } from "./config-utils";

const defaultConfig: ZKitConfig = {
  circuitsDir: "circuits",
  compilationSettings: {
    artifactsDir: "zkit/artifacts",
    onlyFiles: [],
    skipFiles: [],
    c: false,
    json: false,
    sym: false,
    contributionTemplate: "groth16",
    contributions: 1,
  },
  quiet: false,
  verifiersDir: "contracts/verifiers",
  ptauDir: undefined,
  ptauDownload: true,
};

export const zkitConfigExtender: ConfigExtender = (resolvedConfig, config) => {
  resolvedConfig.zkit = mergeConfigs(config.zkit, defaultConfig);
};

export const mergeConfigs = (cliArgs: RecursivePartial<ZKitConfig> | undefined, zkitConfig: ZKitConfig): ZKitConfig => {
  return cliArgs === undefined ? zkitConfig : deepMerge({}, zkitConfig, cliArgs);
};
