import { ConfigExtender } from "hardhat/types";

import { CompilationSettings, VerifiersGenerationSettings, ZKitConfig } from "./types/zkit-config";
import { RecursivePartial } from "./types/utils";
import { deepMerge } from "./utils/utils";
import { CompilationTaskArgs, VerifiersGenerationTaskArgs } from "./types/task-args";

const defaultConfig: ZKitConfig = {
  circuitsDir: "circuits",
  compilationSettings: {
    artifactsDir: "zkit/artifacts",
    onlyFiles: [],
    skipFiles: [],
    c: false,
    json: false,
    quiet: false,
    sym: false,
  },
  verifiersSettings: {
    verifiersDir: "contracts/verifiers",
    onlyFiles: [],
    skipFiles: [],
  },
  ptauDir: undefined,
  allowDownload: true,
};

export const zkitConfigExtender: ConfigExtender = (resolvedConfig, config) => {
  resolvedConfig.zkit = mergeConfigs(config.zkit, defaultConfig);
};

export const mergeCompilationSettings = (
  cliArgs: Partial<CompilationTaskArgs> | undefined,
  compilationSettings: CompilationSettings,
): CompilationSettings => {
  return { ...compilationSettings, ...definedProps(cliArgs) };
};

export const mergeVerifiersGenerationSettings = (
  cliArgs: Partial<VerifiersGenerationTaskArgs> | undefined,
  verifiersGenerationSettings: VerifiersGenerationSettings,
): VerifiersGenerationSettings => {
  return { ...verifiersGenerationSettings, ...definedProps(cliArgs) };
};

export const mergeConfigs = (cliArgs: RecursivePartial<ZKitConfig> | undefined, zkitConfig: ZKitConfig): ZKitConfig => {
  return cliArgs === undefined ? zkitConfig : deepMerge({}, zkitConfig, cliArgs);
};

const definedProps = (obj: any): any =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== false));
