import { join, dirname } from "path";
import fsExtra from "fs-extra";

import { resetHardhatContext } from "hardhat/plugins-testing";
import { TASK_COMPILE } from "hardhat/builtin-tasks/task-names";

import { getNormalizedFullPath } from "../src/utils/path-utils";
import { resetCircuitsCompileCache, resetCircuitsSetupCache } from "../src/cache";

export function useEnvironment(fixtureProjectName: string, withCleanUp: boolean = false, networkName = "hardhat") {
  beforeEach("Loading hardhat environment", async function () {
    const prefix = "hardhat-project-";
    process.chdir(join(__dirname, "fixture-projects", prefix + fixtureProjectName));
    process.env.HARDHAT_NETWORK = networkName;

    this.hre = require("hardhat");

    if (withCleanUp) {
      cleanUp(this.hre.config.paths.root);

      return;
    }

    await this.hre.run(TASK_COMPILE, { quiet: true });
  });

  afterEach("Resetting hardhat", async function () {
    resetHardhatContext();

    const typesDir: string = getNormalizedFullPath(this.hre.config.paths.root, "generated-types/zkit");
    fsExtra.rmSync(typesDir, { recursive: true, force: true });
  });
}

export function getProjectRootPath(): string {
  return dirname(__dirname);
}

export function cleanUp(rootPath: string) {
  resetCircuitsCompileCache();
  resetCircuitsSetupCache();

  const directoriesToRemove = [
    "generated-types/zkit",
    "cache",
    "zkit",
    "artifacts",
    "contracts/verifiers",
    "compilers",
  ].map((dir) => getNormalizedFullPath(rootPath, dir));

  directoriesToRemove.forEach((dir) => {
    fsExtra.rmSync(dir, { recursive: true, force: true });
  });
}
