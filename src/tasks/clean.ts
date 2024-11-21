import fs from "fs";

import { ActionType, HardhatRuntimeEnvironment } from "hardhat/types";

import { CIRCUITS_COMPILE_CACHE_FILENAME, CIRCUITS_SETUP_CACHE_FILENAME } from "../constants";
import { getNormalizedFullPath } from "../utils";

export const clean: ActionType<any> = async (_taskArgs: any, env: HardhatRuntimeEnvironment) => {
  const circuitsCompileCacheFullPath: string = getNormalizedFullPath(
    env.config.paths.cache,
    CIRCUITS_COMPILE_CACHE_FILENAME,
  );
  const circuitsSetupCacheFullPath: string = getNormalizedFullPath(
    env.config.paths.cache,
    CIRCUITS_SETUP_CACHE_FILENAME,
  );
  const artifactsDirFullPath: string = getNormalizedFullPath(
    env.config.paths.root,
    env.config.zkit.compilationSettings.artifactsDir,
  );
  const circuitTypesFullPath: string = getNormalizedFullPath(env.config.paths.root, env.config.zkit.typesDir);

  fs.rmSync(circuitsCompileCacheFullPath, { force: true });
  fs.rmSync(circuitsSetupCacheFullPath, { force: true });
  fs.rmSync(artifactsDirFullPath, { recursive: true, force: true });
  fs.rmSync(circuitTypesFullPath, { recursive: true, force: true });
};
