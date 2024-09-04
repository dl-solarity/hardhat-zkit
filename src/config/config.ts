import { ConfigExtender } from "hardhat/types";

import { deepMerge } from "./config-utils";

import { ZKitConfig } from "../types/zkit-config";
import { RecursivePartial } from "../types/utils";

const defaultConfig: ZKitConfig = {
  circuitsDir: "circuits",
  compilationSettings: {
    artifactsDir: "zkit/artifacts",
    onlyFiles: [],
    skipFiles: [],
    c: false,
    json: false,
  },
  setupSettings: {
    contributionSettings: {
      contributionTemplate: "groth16",
      contributions: 1,
    },
    ptauDir: undefined,
    ptauDownload: true,
    onlyFiles: [],
    skipFiles: [],
  },
  verifiersDir: "contracts/verifiers",
  typesDir: "generated-types/zkit",
  verifiersType: "sol",
  quiet: false,
};

export const zkitConfigExtender: ConfigExtender = (resolvedConfig, config) => {
  resolvedConfig.zkit = mergeConfigs(config.zkit, defaultConfig);
};

export const mergeConfigs = (cliArgs: RecursivePartial<ZKitConfig> | undefined, zkitConfig: ZKitConfig): ZKitConfig => {
  return cliArgs === undefined ? zkitConfig : deepMerge({}, zkitConfig, cliArgs);
};
