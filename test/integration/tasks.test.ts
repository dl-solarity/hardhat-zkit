import os from "os";
import path from "path";
import fsExtra from "fs-extra";
import { expect } from "chai";
import { HardhatUserConfig } from "hardhat/config";

import {
  TASK_CIRCUITS_COMPILE,
  TASK_CIRCUITS_MAKE,
  TASK_CIRCUITS_SETUP,
  TASK_GENERATE_VERIFIERS,
  TASK_ZKIT_CLEAN,
  ZKIT_SCOPE_NAME,
} from "../../src/task-names";
import { CircuitsCompileCache, CircuitsSetupCache } from "../../src/cache";
import { CompileCacheEntry, SetupCacheEntry } from "../../src/types/cache";

import { cleanUp, useEnvironment } from "../helpers";
import { getNormalizedFullPath } from "../../src/utils/path-utils";
import { getCompileCacheEntry, getSetupCacheEntry } from "../utils";

import { CircomCompilerDownloader } from "../../src/core/compiler/CircomCompilerDownloader";
import { createReporter } from "../../src/reporter";

describe("ZKit tasks", () => {
  const circuitNames = ["Multiplier2", "Multiplier3Arr"];
  const sourceNames = ["circuits/main/mul2.circom", "circuits/main/Multiplier3Arr.circom"];

  function getZkitCircuitFullPaths(config: HardhatUserConfig): string[] {
    const circuitFullPaths: string[] = [];
    sourceNames.forEach((sourceName) => {
      circuitFullPaths.push(
        getNormalizedFullPath(config.paths!.root!, `${config.zkit!.compilationSettings!.artifactsDir}/${sourceName}`),
      );
    });

    return circuitFullPaths;
  }

  async function checkMake(config: HardhatUserConfig) {
    const cacheFullPath: string = getNormalizedFullPath(config.paths!.root!, "cache");

    expect(fsExtra.readdirSync(cacheFullPath)).to.be.deep.eq([
      "circuits-compile-cache.json",
      "circuits-setup-cache.json",
    ]);

    CircuitsSetupCache!.getEntries().forEach(async (entry: SetupCacheEntry) => {
      expect(entry).to.be.deep.eq(await getSetupCacheEntry(entry.circuitSourceName, entry.r1csSourcePath));
    });

    getZkitCircuitFullPaths(config).forEach((path, index) => {
      expect(fsExtra.readdirSync(path)).to.be.deep.eq([
        `${circuitNames[index]}.r1cs`,
        `${circuitNames[index]}.sym`,
        `${circuitNames[index]}.vkey.json`,
        `${circuitNames[index]}.zkey`,
        `${circuitNames[index]}_artifacts.json`,
        `${circuitNames[index]}_js`,
      ]);
    });

    const ptauFullPath: string = getNormalizedFullPath(config.paths!.root!, "zkit/ptau");
    expect(fsExtra.readdirSync(ptauFullPath)).to.be.deep.eq(["powers-of-tau-8.ptau"]);
  }

  describe("compile", () => {
    describe("no config compiler version", () => {
      createReporter(false);

      useEnvironment("with-circuits", true);

      it("should correctly compile circuits", async function () {
        this.timeout(30000);

        await this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_CIRCUITS_COMPILE });

        const cacheFullPath: string = getNormalizedFullPath(this.hre.config.paths.root, "cache");

        expect(fsExtra.readdirSync(cacheFullPath)).to.be.deep.eq(["circuits-compile-cache.json"]);

        CircuitsCompileCache!.getEntries().forEach(async (entry: CompileCacheEntry) => {
          expect(entry).to.be.deep.eq(await getCompileCacheEntry(this.hre.config.paths.root, entry.sourceName));
        });

        getZkitCircuitFullPaths(this.hre.config).forEach((path, index) => {
          expect(fsExtra.readdirSync(path)).to.be.deep.eq([
            `${circuitNames[index]}.r1cs`,
            `${circuitNames[index]}.sym`,
            `${circuitNames[index]}_artifacts.json`,
            `${circuitNames[index]}_js`,
          ]);
        });
      });

      it("should correctly compile circuits with task arguments", async function () {
        this.timeout(30000);

        await this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_CIRCUITS_COMPILE }, { json: true, c: true });

        const cacheFullPath: string = getNormalizedFullPath(this.hre.config.paths.root, "cache");

        expect(fsExtra.readdirSync(cacheFullPath)).to.be.deep.eq(["circuits-compile-cache.json"]);

        CircuitsCompileCache!.getEntries().forEach(async (entry: CompileCacheEntry) => {
          expect(entry).to.be.deep.eq(await getCompileCacheEntry(this.hre.config.paths.root, entry.sourceName));
        });

        getZkitCircuitFullPaths(this.hre.config).forEach((path, index) => {
          expect(fsExtra.readdirSync(path)).to.be.deep.eq([
            `${circuitNames[index]}.r1cs`,
            `${circuitNames[index]}.sym`,
            `${circuitNames[index]}_artifacts.json`,
            `${circuitNames[index]}_constraints.json`,
            `${circuitNames[index]}_cpp`,
            `${circuitNames[index]}_js`,
          ]);
        });
      });
    });

    describe("config compiler version", () => {
      useEnvironment("compiler-config", true);

      it("should correctly compile circuits with the specified version of the compiler", async function () {
        await this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_CIRCUITS_COMPILE });

        const artifactsPath = getNormalizedFullPath(
          this.hre.config.paths.root,
          `${this.hre.config.zkit!.compilationSettings!.artifactsDir}/circuits/main/mul2.circom`,
        );

        expect(fsExtra.readdirSync(artifactsPath)).to.be.deep.eq([
          "Multiplier2.r1cs",
          "Multiplier2.sym",
          "Multiplier2_artifacts.json",
          "Multiplier2_js",
        ]);

        const compilerPath = path.join(os.homedir(), ".zkit", "compilers", this.hre.config.zkit.compilerVersion);
        expect(fsExtra.readdirSync(compilerPath)).to.be.deep.equal([
          CircomCompilerDownloader.getCompilerPlatformBinary(),
        ]);
      });
    });

    describe("incorrect config compiler version", () => {
      useEnvironment("compiler-incorrect-config", true);

      it("should throw an error when the specified config compiler version is lower that the circuit one", async function () {
        await expect(this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_CIRCUITS_COMPILE })).to.be.rejectedWith(
          "Unable to compile a circuit with Circom version 2.1.9 using compiler version 2.1.8 specified in the config",
        );
      });
    });
  });

  describe("setup", () => {
    useEnvironment("with-circuits", true);

    it("should not generate vkey, zkey files without compiled circuits", async function () {
      cleanUp(this.hre.config.paths.root);

      await this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_CIRCUITS_SETUP });

      const cacheFullPath: string = getNormalizedFullPath(this.hre.config.paths.root, "cache");
      expect(fsExtra.readdirSync(cacheFullPath)).to.be.deep.eq(["circuits-setup-cache.json"]);

      expect(CircuitsSetupCache!.getEntries()).to.be.deep.eq([]);
    });

    it("should generate correct vkey, zkey files for compiled circuits", async function () {
      await this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_CIRCUITS_COMPILE });
      await this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_CIRCUITS_SETUP });

      await checkMake(this.hre.config);
    });
  });

  describe("make", () => {
    useEnvironment("with-circuits", true);

    it("should correctly compile circuits and generate vkey, zkey files", async function () {
      await this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_CIRCUITS_MAKE });

      await checkMake(this.hre.config);
    });
  });

  describe("verifiers", () => {
    useEnvironment("with-circuits", true);

    it("should correctly generate verifiers after running the verifiers task", async function () {
      await this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_GENERATE_VERIFIERS });

      await checkMake(this.hre.config);

      const verifiersFullPath: string = getNormalizedFullPath(this.hre.config.paths.root, "contracts/verifiers");
      expect(fsExtra.readdirSync(verifiersFullPath)).to.be.deep.eq(circuitNames.map((name) => `${name}Verifier.sol`));
    });
  });

  describe("clean", () => {
    useEnvironment("with-circuits", true);

    it("should correctly clean up the generated artifacts, types, etc", async function () {
      expect(fsExtra.readdirSync(this.hre.config.paths.root)).to.be.deep.eq([
        ".gitignore",
        "circuits",
        "contracts",
        "generated-types",
        "hardhat.config.ts",
        "package.json",
      ]);

      expect(fsExtra.readdirSync(getNormalizedFullPath(this.hre.config.paths.root, "generated-types"))).to.be.deep.eq(
        [],
      );

      await this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_CIRCUITS_MAKE });

      const typesDir: string = getNormalizedFullPath(this.hre.config.paths.root, "generated-types");
      const cacheDir: string = getNormalizedFullPath(this.hre.config.paths.root, "cache");
      const zkitDir: string = getNormalizedFullPath(this.hre.config.paths.root, "zkit");

      await checkMake(this.hre.config);

      await this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_ZKIT_CLEAN });

      expect(fsExtra.readdirSync(cacheDir)).to.be.deep.eq([]);
      expect(fsExtra.readdirSync(typesDir)).to.be.deep.eq([]);
      expect(fsExtra.readdirSync(zkitDir)).to.be.deep.eq(["ptau"]);
    });
  });
});
