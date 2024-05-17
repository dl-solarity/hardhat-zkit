import { ConfigExtender } from "hardhat/types";

import { CompilationSettings, VerifiersGenerationSettings, ZKitConfig } from "./types/zkit-config";
import { RecursivePartial } from "./types/utils";
import { deepMerge } from "./utils/utils";

const defaultConfig: ZKitConfig = {
  circuitsDir: "circuits",
  compilationSettings: {
    artifactsDir: "zkit-artifacts",
    c: false,
    json: false,
    quiet: false,
    sym: false,
  },
  verifiersSettings: {
    verifiersDir: "contracts/verifiers",
  },
  ptauDir: "",
  allowDownload: true,
};

export const zkitConfigExtender: ConfigExtender = (resolvedConfig, config) => {
  resolvedConfig.zkit = mergeConfigs(config.zkit, defaultConfig);
};

export const mergeCompilationSettings = (
  cliArgs: Partial<CompilationSettings> | undefined,
  compilationSettings: CompilationSettings,
): CompilationSettings => {
  const config = cliArgs === undefined ? compilationSettings : { ...compilationSettings, ...definedProps(cliArgs) };

  return config;
};

export const mergeVerifiersGenerationSettings = (
  cliArgs: Partial<VerifiersGenerationSettings> | undefined,
  verifiersGenerationSettings: VerifiersGenerationSettings,
): VerifiersGenerationSettings => {
  const config =
    cliArgs === undefined ? verifiersGenerationSettings : { ...verifiersGenerationSettings, ...definedProps(cliArgs) };

  return config;
};

export const mergeConfigs = (cliArgs: RecursivePartial<ZKitConfig> | undefined, zkitConfig: ZKitConfig): ZKitConfig => {
  const config = cliArgs === undefined ? zkitConfig : deepMerge(zkitConfig, cliArgs);

  return config;
};

const definedProps = (obj: any): any => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
