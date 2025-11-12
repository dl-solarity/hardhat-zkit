import path from "path";
import fsExtra from "fs-extra";
import { fileURLToPath } from "url";

import "../src/type-extensions.js";

import { HardhatRuntimeEnvironment } from "hardhat/types/hre";

import { createHardhatRuntimeEnvironment } from "hardhat/hre";

import { createReporter, Reporter } from "../src/reporter/ReporterFacade.js";
import { getNormalizedFullPath } from "../src/utils/path-utils.js";
import { resetCircuitsCompileCache } from "../src/cache/CircuitsCompileCache.js";
import { resetCircuitsSetupCache } from "../src/cache/CircuitsSetupCache.js";

export type EnvironmentSettings = {
  fixtureProjectName: string;
  withCleanUp?: boolean;
  withoutLogging?: boolean;
  withJSProject?: boolean;
  networkName?: string;
};

declare module "mocha" {
  interface Context {
    hre: HardhatRuntimeEnvironment;
    _cwd?: string;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function useEnvironment(envSettings: EnvironmentSettings) {
  beforeEach("Loading hardhat environment", async function () {
    const fixtureProjectsDirName = `fixture-projects${envSettings.withJSProject ? "-js" : ""}`;
    const prefix = "hardhat-project-";

    this._cwd = process.cwd();

    const projectPath = path.join(__dirname, fixtureProjectsDirName, prefix + envSettings.fixtureProjectName);
    const configPath = path.join(projectPath, `hardhat.config.${envSettings.withJSProject ? "js" : "ts"}`);

    process.chdir(projectPath);
    process.env.HARDHAT_NETWORK = envSettings.networkName ? envSettings.networkName : "hardhat";

    this.hre = await createHardhatRuntimeEnvironment(
      (await import(configPath)).default,
      { config: configPath },
      projectPath,
    );

    if (envSettings.withCleanUp) {
      cleanUp(this.hre.config.paths.root);
      return;
    }

    if (!Reporter) {
      createReporter(!!envSettings.withoutLogging);
    } else {
      Reporter!.setQuiet(!!envSettings.withoutLogging);
    }

    await this.hre.tasks.getTask("compile").run({ quiet: true });
  });

  afterEach("Resetting hardhat", async function () {
    await this.hre.tasks.getTask("clean").run({});

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
