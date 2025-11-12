import path from "path";

import findUp from "find-up";

const JS_CONFIG_FILENAME = "hardhat.config.js";
const CJS_CONFIG_FILENAME = "hardhat.config.cjs";
const TS_CONFIG_FILENAME = "hardhat.config.ts";
const CTS_CONFIG_FILENAME = "hardhat.config.cts";

/**
 * Returns true if Hardhat will run in using typescript mode.
 * @param configPath The config path if provider by the user.
 */
export function willRunWithTypescript(configPath?: string): boolean {
  const config = resolveConfigPath(configPath);

  if (config === undefined) {
    throw new Error("Config is undefined");
  }

  return isNonEsmTypescriptFile(config);
}

function isNonEsmTypescriptFile(path: string): boolean {
  return /\.(ts|cts)$/i.test(path);
}

export function resolveConfigPath(configPath: string | undefined) {
  if (configPath === undefined) {
    configPath = getUserConfigPath();
  } else {
    if (!path.isAbsolute(configPath)) {
      configPath = path.join(process.cwd(), configPath);
      configPath = path.normalize(configPath);
    }
  }
  return configPath;
}

export function getUserConfigPath() {
  const tsConfigPath = findUp.sync(TS_CONFIG_FILENAME);
  if (tsConfigPath !== null) {
    return tsConfigPath;
  }

  const ctsConfigPath = findUp.sync(CTS_CONFIG_FILENAME);
  if (ctsConfigPath !== null) {
    return ctsConfigPath;
  }

  const cjsConfigPath = findUp.sync(CJS_CONFIG_FILENAME);
  if (cjsConfigPath !== null) {
    return cjsConfigPath;
  }

  const pathToConfigFile = findUp.sync(JS_CONFIG_FILENAME);
  if (pathToConfigFile === null) {
    throw new Error("GENERAL.NOT_INSIDE_PROJECT");
  }

  return pathToConfigFile;
}
