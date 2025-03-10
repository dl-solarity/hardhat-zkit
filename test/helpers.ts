import { join } from "path";
import fsExtra from "fs-extra";

import { resetHardhatContext } from "hardhat/plugins-testing";
import { TASK_COMPILE } from "hardhat/builtin-tasks/task-names";

import { createReporter, Reporter } from "../src/reporter";
import { resetCircuitsCompileCache, resetCircuitsSetupCache } from "../src/cache";
import { getNormalizedFullPath } from "../src/utils/path-utils";

export type EnvironmentSettings = {
  fixtureProjectName: string;
  withCleanUp?: boolean;
  withoutLogging?: boolean;
  withJSProject?: boolean;
  networkName?: string;
};

export function useEnvironment(envSettings: EnvironmentSettings) {
  beforeEach("Loading hardhat environment", async function () {
    const fixtureProjectsDirName = `fixture-projects${envSettings.withJSProject ? "-js" : ""}`;
    const prefix = "hardhat-project-";

    process.chdir(join(__dirname, fixtureProjectsDirName, prefix + envSettings.fixtureProjectName));
    process.env.HARDHAT_NETWORK = envSettings.networkName ? envSettings.networkName : "hardhat";

    this.hre = require("hardhat");

    if (envSettings.withCleanUp) {
      cleanUp(this.hre.config.paths.root);

      return;
    }

    if (!Reporter) {
      createReporter(!!envSettings.withoutLogging);
    } else {
      Reporter!.setQuiet(!!envSettings.withoutLogging);
    }

    await this.hre.run(TASK_COMPILE, { quiet: true });
  });

  afterEach("Resetting hardhat", async function () {
    resetHardhatContext();

    const typesDir: string = getNormalizedFullPath(this.hre.config.paths.root, "generated-types/zkit");
    fsExtra.rmSync(typesDir, { recursive: true, force: true });
  });
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
