import fs from "fs";

import { NewTaskActionFunction } from "hardhat/types/tasks";

import { CIRCUITS_COMPILE_CACHE_FILENAME, CIRCUITS_SETUP_CACHE_FILENAME } from "../constants.js";
import { getNormalizedFullPath } from "../utils/path-utils.js";

const cleanAction: NewTaskActionFunction<any> = async (_, hre) => {
  const circuitsCompileCacheFullPath: string = getNormalizedFullPath(
    hre.config.paths.cache,
    CIRCUITS_COMPILE_CACHE_FILENAME,
  );
  const circuitsSetupCacheFullPath: string = getNormalizedFullPath(
    hre.config.paths.cache,
    CIRCUITS_SETUP_CACHE_FILENAME,
  );
  const artifactsDirFullPath: string = getNormalizedFullPath(
    hre.config.paths.root,
    hre.config.zkit.compilationSettings.artifactsDir,
  );
  const circuitTypesFullPath: string = getNormalizedFullPath(hre.config.paths.root, hre.config.zkit.typesDir);

  fs.rmSync(circuitsCompileCacheFullPath, { force: true });
  fs.rmSync(circuitsSetupCacheFullPath, { force: true });
  fs.rmSync(artifactsDirFullPath, { recursive: true, force: true });
  fs.rmSync(circuitTypesFullPath, { recursive: true, force: true });
};

export default cleanAction;
