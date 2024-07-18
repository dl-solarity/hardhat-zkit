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
  },
  setupSettings: {
    contributionTemplate: "groth16",
    contributions: 1,
    onlyFiles: [],
    skipFiles: [],
  },
  typesSettings: {
    typesArtifactsDir: "zkit/abi",
    typesDir: "generated-types/zkit",
  },
  verifiersDir: "contracts/verifiers",
  ptauDir: undefined,
  ptauDownload: true,
  nativeCompiler: false,
  quiet: false,
};

export const zkitConfigExtender: ConfigExtender = (resolvedConfig, config) => {
  resolvedConfig.zkit = mergeConfigs(config.zkit, defaultConfig);
};

export const mergeConfigs = (cliArgs: RecursivePartial<ZKitConfig> | undefined, zkitConfig: ZKitConfig): ZKitConfig => {
  return cliArgs === undefined ? zkitConfig : deepMerge({}, zkitConfig, cliArgs);
};
