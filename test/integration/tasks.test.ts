import os from "os";
import path from "path";
import fsExtra from "fs-extra";
import { execSync } from "child_process";

import "@solarity/chai-zkit";
import { expect } from "chai";
import { before } from "mocha";
import { stub, SinonStub } from "sinon";

import { HardhatUserConfig } from "hardhat/config";

import {
  TASK_CIRCUITS_COMPILE,
  TASK_CIRCUITS_MAKE,
  TASK_CIRCUITS_SETUP,
  TASK_GENERATE_VERIFIERS,
  TASK_ZKIT_CLEAN,
  ZKIT_SCOPE_NAME,
} from "@src/task-names";
import { CircuitsCompileCache, CircuitsSetupCache } from "@src/cache";
import { CompileCacheEntry, SetupCacheEntry } from "@src/types/cache";

import { cleanUp, useEnvironment } from "@test-helpers";
import { getNormalizedFullPath } from "@src/utils/path-utils";
import { getCompileCacheEntry, getSetupCacheEntry } from "../utils";

import { HardhatZKit } from "@src/types/hardhat-zkit";
import { BaseCircomCompilerFactory } from "@src/core";
import { CircomCompilerDownloader } from "@src/core/compiler/CircomCompilerDownloader";

describe("ZKit tasks", async function () {
  const circuitNames = ["Multiplier2", "Multiplier3Arr"];
  const sourceNames = ["circuits/main/mul2.circom", "circuits/main/Multiplier3Arr.circom"];

  let nativeCompilerStub: SinonStub;

  before(() => {
    nativeCompilerStub = stub(BaseCircomCompilerFactory.prototype, "_tryCreateNativeCompiler" as any).callsFake(
      async () => {
        return undefined;
      },
    );
  });

  after(() => {
    nativeCompilerStub.restore();
  });

  function getZkitCircuitFullPaths(config: HardhatUserConfig): string[] {
    const circuitFullPaths: string[] = [];
    sourceNames.forEach((sourceName) => {
      circuitFullPaths.push(
        getNormalizedFullPath(config.paths!.root!, `${config.zkit!.compilationSettings!.artifactsDir}/${sourceName}`),
      );
    });

    return circuitFullPaths;
  }

  async function checkMake(config: HardhatUserConfig, zkit: HardhatZKit) {
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

    const circuit = await zkit.getCircuit("Multiplier2");
    await expect(circuit).with.witnessInputs({ in1: "3", in2: "7" }).to.have.witnessOutputs(["21"]);

    const proof = await circuit.generateProof({ in1: "4", in2: "2" });

    await expect(circuit).to.verifyProof(proof);
  }

  function updateInclude(filePath: string, newIncludePath: string) {
    const fileContent = fsExtra.readFileSync(filePath, "utf-8");

    const updatedContent = fileContent.replace(/include\s*".*";/, `include "${newIncludePath}";`);

    fsExtra.writeFileSync(filePath, updatedContent, "utf-8");
  }

  describe("compile", async function () {
    describe("no config compiler version", async function () {
      useEnvironment("with-circuits", true);

      it("should correctly compile circuits", async function () {
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

    describe("config compiler version", async function () {
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

    describe("incorrect config compiler version", async function () {
      useEnvironment("compiler-incorrect-config", true);

      it("should throw an error when the specified config compiler version is lower that the circuit one", async function () {
        await expect(this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_CIRCUITS_COMPILE })).to.be.rejectedWith(
          "Unable to compile a circuit with Circom version 2.1.9 using compiler version 2.1.8 specified in the config",
        );
      });
    });

    describe("with libraries", async function () {
      describe("valid circuits", function () {
        useEnvironment("circuits-with-libraries", true);

        it("should correctly compile circuits that include libraries", async function () {
          const root = this.hre.config.paths.root;

          execSync("npm install --no-workspaces", { cwd: root });
          await this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_CIRCUITS_COMPILE });

          const cacheFullPath: string = getNormalizedFullPath(root, "cache");

          expect(fsExtra.readdirSync(cacheFullPath)).to.be.deep.eq(["circuits-compile-cache.json"]);

          CircuitsCompileCache!.getEntries().forEach(async (entry: CompileCacheEntry) => {
            expect(entry).to.be.deep.eq(await getCompileCacheEntry(root, entry.sourceName));
          });

          const circuitPath = getNormalizedFullPath(
            root,
            `${this.hre.config.zkit.compilationSettings.artifactsDir}/circuits/hash2.circom`,
          );

          expect(fsExtra.readdirSync(circuitPath)).to.be.deep.eq([
            `Hash2.r1cs`,
            `Hash2.sym`,
            `Hash2_artifacts.json`,
            `Hash2_js`,
          ]);

          fsExtra.rmSync(`${root}/node_modules`, { recursive: true, force: true });
          fsExtra.rmSync(`${root}/package-lock.json`, { recursive: true, force: true });
        });
      });

      describe("invalid circuits", function () {
        useEnvironment("invalid-circuits", true);

        it("should throw an error if circuit include statement is URI", async function () {
          const circuitPath = "circuits/invalidImportCircuit.circom";
          const circuitFullPath = path.join(this.hre.config.paths.root, circuitPath);
          const invalidImportPath = "http://example.com/circuit.circom";

          updateInclude(circuitFullPath, invalidImportPath);

          await expect(this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_CIRCUITS_COMPILE })).to.be.rejectedWith(
            `Invalid import ${invalidImportPath} from ${circuitPath}. Hardhat doesn't support imports via http`,
          );
        });

        it("should throw an error if circuit include statement includes backslashes", async function () {
          const circuitPath = "circuits/invalidImportCircuit.circom";
          const circuitFullPath = path.join(this.hre.config.paths.root, circuitPath);
          const invalidImportPath = "circomlib/circuits\\poseidon.circom";

          updateInclude(circuitFullPath, invalidImportPath);

          await expect(this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_CIRCUITS_COMPILE })).to.be.rejectedWith(
            `Invalid import ${invalidImportPath} from ${circuitPath}. Imports must use / instead of \\, even in Windows`,
          );
        });

        it("should throw an error if circuit include statement is absolute path", async function () {
          const circuitPath = "circuits/invalidImportCircuit.circom";
          const circuitFullPath = path.join(this.hre.config.paths.root, circuitPath);
          const invalidImportPath = "/absolute/path/to/circuit.circom";

          updateInclude(circuitFullPath, invalidImportPath);

          await expect(this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_CIRCUITS_COMPILE })).to.be.rejectedWith(
            ` Invalid import ${invalidImportPath} from ${circuitPath}. Hardhat doesn't support imports with absolute paths.`,
          );
        });
      });
    });

    describe("with different constraints simplifications flags", async function () {
      const circuitName = "ComplexCircuitWithSimplifications";

      const expectedFiles = [
        `${circuitName}.r1cs`,
        `${circuitName}.sym`,
        `${circuitName}_artifacts.json`,
        `${circuitName}_constraints.json`,
        `${circuitName}_js`,
      ];

      useEnvironment("with-constraint-simplification", true);

      it("should correctly compile circuits with different simplification flag", async function () {
        const fileSizes: {
          r1cs: number;
          constraints: number;
        } = {
          r1cs: 0,
          constraints: 0,
        };

        const root = this.hre.config.paths.root;

        const circuitPath = getNormalizedFullPath(
          root,
          `${this.hre.config.zkit.compilationSettings.artifactsDir}/circuits/${circuitName}.circom`,
        );

        const runCompilationAndGetSizes = async (optimization: "O0" | "O1" | "O2") => {
          this.hre.config.zkit.compilationSettings.optimization = optimization;

          await this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_CIRCUITS_COMPILE });

          expect(fsExtra.readdirSync(circuitPath)).to.deep.equal(expectedFiles);

          const r1csSize = fsExtra.statSync(`${circuitPath}/${circuitName}.r1cs`).size;
          const constraintsSize = fsExtra.statSync(`${circuitPath}/${circuitName}_constraints.json`).size;

          return { r1csSize, constraintsSize };
        };

        let { r1csSize, constraintsSize } = await runCompilationAndGetSizes("O0");

        fileSizes.r1cs = r1csSize;
        fileSizes.constraints = constraintsSize;

        ({ r1csSize, constraintsSize } = await runCompilationAndGetSizes("O1"));

        expect(r1csSize).to.be.lt(fileSizes.r1cs);
        expect(constraintsSize).to.be.lt(fileSizes.constraints);

        fileSizes.r1cs = r1csSize;
        fileSizes.constraints = constraintsSize;

        ({ r1csSize, constraintsSize } = await runCompilationAndGetSizes("O2"));

        expect(r1csSize).to.be.lt(fileSizes.r1cs);
        expect(constraintsSize).to.be.lt(fileSizes.constraints);
      });
    });
  });

  describe("setup", async function () {
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

      await checkMake(this.hre.config, this.hre.zkit);
    });
  });

  describe("make", async function () {
    useEnvironment("with-circuits", true);

    it("should correctly compile circuits and generate vkey, zkey files", async function () {
      await this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_CIRCUITS_MAKE });

      await checkMake(this.hre.config, this.hre.zkit);
    });
  });

  describe("verifiers", async function () {
    useEnvironment("with-circuits", true);

    it("should correctly generate verifiers after running the verifiers task", async function () {
      await this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_GENERATE_VERIFIERS });

      await checkMake(this.hre.config, this.hre.zkit);

      const verifiersFullPath: string = getNormalizedFullPath(this.hre.config.paths.root, "contracts/verifiers");
      expect(fsExtra.readdirSync(verifiersFullPath)).to.be.deep.eq(circuitNames.map((name) => `${name}Verifier.sol`));
    });
  });

  describe("clean", async function () {
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

      await checkMake(this.hre.config, this.hre.zkit);

      await this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_ZKIT_CLEAN });

      expect(fsExtra.readdirSync(cacheDir)).to.be.deep.eq([]);
      expect(fsExtra.readdirSync(typesDir)).to.be.deep.eq([]);
      expect(fsExtra.readdirSync(zkitDir)).to.be.deep.eq(["ptau"]);
    });
  });
});
