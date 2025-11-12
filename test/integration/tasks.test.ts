import os from "os";
import path from "path";
import fsExtra from "fs-extra";
import { capitalize } from "lodash-es";
import { execSync } from "child_process";
import { expect } from "chai";
import { before } from "mocha";
import { stub, SinonStub } from "sinon";

import "@tawny0wl/test-chai-zkit";
import { ProvingSystemType } from "@solarity/zkit";

import { BaseCircomCompilerFactory } from "../../src/core/compiler/CircomCompilerFactory.js";
import { getNormalizedFullPath } from "../../src/utils/path-utils.js";
import { HardhatZKit } from "../../src/types/hardhat-zkit.js";
import { SetupCacheEntry } from "../../src/types/cache/circuits-setup-cache.js";
import { CircuitsSetupCache } from "../../src/cache/CircuitsSetupCache.js";
import { CompileCacheEntry } from "../../src/types/cache/circuits-compile-cache.js";
import { CircuitsCompileCache } from "../../src/cache/CircuitsCompileCache.js";
import { CircomCompilerDownloader } from "../../src/core/compiler/CircomCompilerDownloader.js";

import { cleanUp, useEnvironment } from "../helpers.js";
import {
  getCompileCacheEntry,
  getSetupCacheEntry,
  updateInclude,
  updateProvingSystems,
  updateTypesDir,
} from "../utils.js";

import {
  TASK_CIRCUITS_COMPILE,
  TASK_CIRCUITS_MAKE,
  TASK_CIRCUITS_SETUP,
  TASK_GENERATE_VERIFIERS,
  TASK_ZKIT_CLEAN,
  ZKIT_SCOPE_NAME,
} from "../../src/task-names.js";
import { HardhatConfig } from "hardhat/types/config";

describe("ZKit tasks", async function () {
  const circuitNames = ["Multiplier2", "Multiplier3Arr"];
  const sourceNames = ["circuits/main/mul2.circom", "circuits/main/Multiplier3Arr.circom"];
  const defaultTypesDir = "generated-types/zkit";

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

  function getZkitCircuitFullPaths(config: HardhatConfig): string[] {
    const circuitFullPaths: string[] = [];

    sourceNames.forEach((sourceName) => {
      circuitFullPaths.push(
        getNormalizedFullPath(config.paths.root, `${config.zkit!.compilationSettings!.artifactsDir}/${sourceName}`),
      );
    });

    return circuitFullPaths;
  }

  async function checkMake(config: HardhatConfig, zkit: HardhatZKit, provingSystems: ProvingSystemType[]) {
    const cacheFullPath: string = getNormalizedFullPath(config.paths.root, "cache");

    expect(fsExtra.readdirSync(cacheFullPath)).to.be.deep.eq([
      "circuits-compile-cache.json",
      "circuits-setup-cache.json",
    ]);

    CircuitsSetupCache!.getEntries().forEach(async (entry: SetupCacheEntry) => {
      expect(entry).to.be.deep.eq(await getSetupCacheEntry(entry.circuitSourceName, entry.r1csSourcePath));
    });

    getZkitCircuitFullPaths(config).forEach((path, index) => {
      const provingSystemsFiles: string[] = [];

      provingSystems.forEach((provingSystem) => {
        provingSystemsFiles.push(
          `${circuitNames[index]}.${provingSystem}.vkey.json`,
          `${circuitNames[index]}.${provingSystem}.zkey`,
        );
      });

      expect(fsExtra.readdirSync(path)).to.be.deep.eq([
        ...provingSystemsFiles,
        `${circuitNames[index]}.r1cs`,
        `${circuitNames[index]}.sym`,
        `${circuitNames[index]}_artifacts.json`,
        `${circuitNames[index]}_js`,
      ]);
    });

    const ptauFullPath: string = getNormalizedFullPath(config.paths.root, "zkit/ptau");
    expect(fsExtra.readdirSync(ptauFullPath)).to.be.deep.eq(["powers-of-tau-8.ptau"]);

    for (const provingSystem of provingSystems) {
      const circuit = await zkit.getCircuit("Multiplier2", provingSystems.length > 1 ? provingSystem : undefined);
      await expect(circuit).with.witnessInputs({ in1: "3", in2: "7" }).to.have.witnessOutputs(["21"]);

      const proof = await circuit.generateProof({ in1: "4", in2: "2" });

      await expect(circuit).to.verifyProof(proof);
    }
  }

  describe("compile", async function () {
    describe("no config compiler version", async function () {
      useEnvironment({
        fixtureProjectName: "with-circuits",
        withCleanUp: true,
      });

      it("should correctly compile circuits", async function () {
        await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_COMPILE]).run({});

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
        await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_COMPILE]).run({ json: true, c: true });

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
      useEnvironment({
        fixtureProjectName: "compiler-config",
        withCleanUp: true,
      });

      it("should correctly compile circuits with the specified version of the compiler", async function () {
        await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_COMPILE]).run({});

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

        const compilerPath = path.join(os.homedir(), ".zkit", "compilers", this.hre.config.zkit.compilerVersion!);

        expect(fsExtra.readdirSync(compilerPath)).to.be.deep.equal([
          CircomCompilerDownloader.getCompilerPlatformBinary(),
        ]);
      });
    });

    describe("incorrect config compiler version", async function () {
      useEnvironment({
        fixtureProjectName: "compiler-incorrect-config",
        withCleanUp: true,
      });

      it("should throw an error when the specified config compiler version is lower that the circuit one", async function () {
        await expect(this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_COMPILE]).run()).to.be.rejectedWith(
          "Unable to compile a circuit with Circom version 2.1.9 using compiler version 2.1.8 specified in the config",
        );
      });
    });

    describe("with libraries", async function () {
      describe("valid circuits", function () {
        useEnvironment({
          fixtureProjectName: "circuits-with-libraries",
          withCleanUp: true,
        });

        it("should correctly compile circuits that include libraries", async function () {
          const root = this.hre.config.paths.root;

          execSync("npm install --no-workspaces", { cwd: root });
          await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_COMPILE]).run({});

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
        useEnvironment({
          fixtureProjectName: "invalid-circuits",
          withCleanUp: true,
        });

        it("should throw an error if circuit include statement is URI", async function () {
          const circuitPath = "circuits/invalidImportCircuit.circom";
          const circuitFullPath = path.join(this.hre.config.paths.root, circuitPath);
          const invalidImportPath = "http://example.com/circuit.circom";

          updateInclude(circuitFullPath, invalidImportPath);

          await expect(this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_COMPILE]).run()).to.be.rejectedWith(
            `Invalid import ${invalidImportPath} from ${circuitPath}. Hardhat doesn't support imports via http`,
          );
        });

        it("should throw an error if circuit include statement includes backslashes", async function () {
          const circuitPath = "circuits/invalidImportCircuit.circom";
          const circuitFullPath = path.join(this.hre.config.paths.root, circuitPath);
          const invalidImportPath = "circomlib/circuits\\poseidon.circom";

          updateInclude(circuitFullPath, invalidImportPath);

          await expect(this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_COMPILE]).run()).to.be.rejectedWith(
            `Invalid import ${invalidImportPath} from ${circuitPath}. Imports must use / instead of \\, even in Windows`,
          );
        });

        it("should throw an error if circuit include statement is absolute path", async function () {
          const circuitPath = "circuits/invalidImportCircuit.circom";
          const circuitFullPath = path.join(this.hre.config.paths.root, circuitPath);
          const invalidImportPath = "/absolute/path/to/circuit.circom";

          updateInclude(circuitFullPath, invalidImportPath);

          await expect(this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_COMPILE]).run()).to.be.rejectedWith(
            `Invalid import ${invalidImportPath} from ${circuitPath}. Hardhat doesn't support imports with absolute paths`,
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

      useEnvironment({
        fixtureProjectName: "with-constraint-simplification",
        withCleanUp: true,
      });

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

          // console.log(this.hre.config.zkit.compilationSettings.optimization);

          await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_COMPILE]).run({});

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

    describe("with different proving systems", async function () {
      const plonkTypesDir = "zkit/types-plonk";
      const groth16PlonkTypesDir = "zkit/types-groth16-plonk";

      useEnvironment({
        fixtureProjectName: "with-circuits",
        withCleanUp: true,
      });

      it("should correctly compile circuits with 'groth16' proving system", async function () {
        await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_COMPILE]).run({});

        const circuit = await this.hre.zkit.getCircuit("Multiplier2");

        expect(circuit.getProvingSystemType()).to.be.eq("groth16");

        updateProvingSystems(this.hre.config.paths.config!, ["plonk"]);
        updateTypesDir(this.hre.config.paths.config!, defaultTypesDir, plonkTypesDir);

        // console.log(fsExtra.readFileSync(this.hre.config.paths.config!, "utf-8"));
      });

      it("should correctly compile circuits with 'plonk' proving system", async function () {
        await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_COMPILE]).run({});

        const circuit = await this.hre.zkit.getCircuit("Multiplier2");

        updateProvingSystems(this.hre.config.paths.config!, ["groth16", "plonk"]);
        updateTypesDir(this.hre.config.paths.config!, plonkTypesDir, groth16PlonkTypesDir);

        expect(circuit.getProvingSystemType()).to.be.eq("plonk");
      });

      it("should correctly compile circuits with several proving systems", async function () {
        await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_COMPILE]).run({});

        let circuit = await this.hre.zkit.getCircuit("Multiplier2", "groth16");

        expect(circuit.getProvingSystemType()).to.be.eq("groth16");

        circuit = await this.hre.zkit.getCircuit("Multiplier2", "plonk");

        expect(circuit.getProvingSystemType()).to.be.eq("plonk");

        updateProvingSystems(this.hre.config.paths.config!, ["groth16"]);
        updateTypesDir(this.hre.config.paths.config!, groth16PlonkTypesDir, defaultTypesDir);
      });
    });

    describe("with js project", async function () {
      useEnvironment({
        fixtureProjectName: "js-with-circuits",
        withCleanUp: true,
        withJSProject: true,
      });

      it("should correctly compile circuits with 'groth16' proving system", async function () {
        await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_COMPILE]).run({});

        const circuit = await this.hre.zkit.getCircuit("Multiplier2");

        expect(circuit.getProvingSystemType()).to.be.eq("groth16");

        updateProvingSystems(this.hre.config.paths.config!, ["plonk"]);
      });

      it("should correctly compile circuits with 'plonk' proving system", async function () {
        await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_COMPILE]).run({});

        const circuit = await this.hre.zkit.getCircuit("Multiplier2");

        updateProvingSystems(this.hre.config.paths.config!, ["groth16", "plonk"]);

        expect(circuit.getProvingSystemType()).to.be.eq("plonk");
      });

      it("should correctly compile circuits with several proving systems", async function () {
        await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_COMPILE]).run({});

        let circuit = await this.hre.zkit.getCircuit("Multiplier2", "groth16");

        expect(circuit.getProvingSystemType()).to.be.eq("groth16");

        circuit = await this.hre.zkit.getCircuit("Multiplier2", "plonk");

        expect(circuit.getProvingSystemType()).to.be.eq("plonk");

        updateProvingSystems(this.hre.config.paths.config!, ["groth16"]);
      });
    });
  });

  describe("setup", async function () {
    describe("with ts project", async function () {
      const plonkTypesDir = "zkit/types-plonk";
      const groth16PlonkTypesDir = "zkit/types-groth16-plonk";

      useEnvironment({
        fixtureProjectName: "with-circuits",
        withCleanUp: true,
      });

      it("should not generate vkey, zkey files without compiled circuits", async function () {
        cleanUp(this.hre.config.paths.root);

        await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_SETUP]).run({});

        const cacheFullPath: string = getNormalizedFullPath(this.hre.config.paths.root, "cache");
        expect(fsExtra.readdirSync(cacheFullPath)).to.be.deep.eq(["circuits-setup-cache.json"]);

        expect(CircuitsSetupCache!.getEntries()).to.be.deep.eq([]);
      });

      it("should generate correct vkey, zkey files for compiled circuits with 'groth16' proving system", async function () {
        await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_COMPILE]).run({});
        await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_SETUP]).run({});

        await checkMake(this.hre.config, this.hre.zkit, ["groth16"]);

        updateProvingSystems(this.hre.config.paths.config!, ["plonk"]);
        updateTypesDir(this.hre.config.paths.config!, defaultTypesDir, plonkTypesDir);
      });

      it("should generate correct vkey, zkey files for compiled circuits with 'plonk' proving system", async function () {
        await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_COMPILE]).run({});
        await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_SETUP]).run({});

        await checkMake(this.hre.config, this.hre.zkit, ["plonk"]);

        updateProvingSystems(this.hre.config.paths.config!, ["groth16", "plonk"]);
        updateTypesDir(this.hre.config.paths.config!, plonkTypesDir, groth16PlonkTypesDir);
      });

      it("should generate correct vkey, zkey files with 'plonk' and 'groth16' proving systems", async function () {
        await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_COMPILE]).run({});
        await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_SETUP]).run({});

        await checkMake(this.hre.config, this.hre.zkit, ["groth16", "plonk"]);

        updateProvingSystems(this.hre.config.paths.config!, ["groth16"]);
        updateTypesDir(this.hre.config.paths.config!, groth16PlonkTypesDir, defaultTypesDir);
      });
    });

    describe("with js project", async function () {
      useEnvironment({
        fixtureProjectName: "js-with-circuits",
        withCleanUp: true,
        withJSProject: true,
      });

      it("should not generate vkey, zkey files without compiled circuits", async function () {
        cleanUp(this.hre.config.paths.root);

        await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_SETUP]).run({});

        const cacheFullPath: string = getNormalizedFullPath(this.hre.config.paths.root, "cache");
        expect(fsExtra.readdirSync(cacheFullPath)).to.be.deep.eq(["circuits-setup-cache.json"]);

        expect(CircuitsSetupCache!.getEntries()).to.be.deep.eq([]);
      });

      it("should generate correct vkey, zkey files for compiled circuits with 'groth16' proving system", async function () {
        await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_COMPILE]).run({});
        await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_SETUP]).run({});

        await checkMake(this.hre.config, this.hre.zkit, ["groth16"]);

        updateProvingSystems(this.hre.config.paths.config!, ["plonk"]);
      });

      it("should generate correct vkey, zkey files for compiled circuits with 'plonk' proving system", async function () {
        await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_COMPILE]).run({});
        await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_SETUP]).run({});

        await checkMake(this.hre.config, this.hre.zkit, ["plonk"]);

        updateProvingSystems(this.hre.config.paths.config!, ["groth16", "plonk"]);
      });

      it("should generate correct vkey, zkey files with 'plonk' and 'groth16' proving systems", async function () {
        await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_COMPILE]).run({});
        await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_SETUP]).run({});

        await checkMake(this.hre.config, this.hre.zkit, ["groth16", "plonk"]);

        updateProvingSystems(this.hre.config.paths.config!, ["groth16"]);
      });
    });
  });

  describe("make", async function () {
    describe("with ts project", async function () {
      useEnvironment({
        fixtureProjectName: "with-circuits",
        withCleanUp: true,
      });

      it("should correctly compile circuits and generate vkey, zkey files", async function () {
        await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_MAKE]).run({});

        await checkMake(this.hre.config, this.hre.zkit, ["groth16"]);
      });
    });

    describe("with js project", async function () {
      useEnvironment({
        fixtureProjectName: "js-with-circuits",
        withCleanUp: true,
        withJSProject: true,
      });

      it("should correctly compile circuits and generate vkey, zkey files", async function () {
        await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_MAKE]).run({});

        await checkMake(this.hre.config, this.hre.zkit, ["groth16"]);
      });
    });
  });

  describe("verifiers", async function () {
    const plonkTypesDir = "zkit/types-plonk";
    const groth16PlonkTypesDir = "zkit/types-groth16-plonk";

    describe("with simple circuits", async function () {
      useEnvironment({
        fixtureProjectName: "with-circuits",
        withCleanUp: true,
      });

      it("should correctly generate 'groth16' verifiers after running the verifiers task", async function () {
        await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_GENERATE_VERIFIERS]).run({});

        await checkMake(this.hre.config, this.hre.zkit, ["groth16"]);

        const verifiersFullPath: string = getNormalizedFullPath(this.hre.config.paths.root, "contracts/verifiers");
        expect(fsExtra.readdirSync(verifiersFullPath)).to.be.deep.eq([
          ...circuitNames.map((name) => `${name}Groth16Verifier.sol`),
          "Test_10_Groth16Verifier.sol",
          "Test_20_Groth16Verifier.sol",
        ]);

        updateProvingSystems(this.hre.config.paths.config!, ["plonk"]);
        updateTypesDir(this.hre.config.paths.config!, defaultTypesDir, plonkTypesDir);
      });

      it("should correctly generate 'plonk' verifiers after running the verifiers task", async function () {
        await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_GENERATE_VERIFIERS]).run({});

        await checkMake(this.hre.config, this.hre.zkit, ["plonk"]);

        const verifiersFullPath: string = getNormalizedFullPath(this.hre.config.paths.root, "contracts/verifiers");
        expect(fsExtra.readdirSync(verifiersFullPath)).to.be.deep.eq([
          ...circuitNames.map((name) => `${name}PlonkVerifier.sol`),
          "Test_10_PlonkVerifier.sol",
          "Test_20_PlonkVerifier.sol",
        ]);

        updateProvingSystems(this.hre.config.paths.config!, ["groth16", "plonk"]);
        updateTypesDir(this.hre.config.paths.config!, plonkTypesDir, groth16PlonkTypesDir);
      });

      it("should correctly generate 'groth16' and 'plonk' verifiers after running the verifiers task", async function () {
        const provingSystemsArr: ProvingSystemType[] = ["groth16", "plonk"];

        await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_GENERATE_VERIFIERS]).run({});

        await checkMake(this.hre.config, this.hre.zkit, provingSystemsArr);

        const verifiersFullPath: string = getNormalizedFullPath(this.hre.config.paths.root, "contracts/verifiers");
        const verifiersNameArr: string[] = [];

        for (const circuitName of [...circuitNames, "Test_10_", "Test_20_"]) {
          verifiersNameArr.push(
            ...provingSystemsArr.map((provingSystem) => `${circuitName}${capitalize(provingSystem)}Verifier.sol`),
          );
        }

        expect(fsExtra.readdirSync(verifiersFullPath)).to.be.deep.eq(verifiersNameArr);

        updateProvingSystems(this.hre.config.paths.config!, ["groth16"]);
        updateTypesDir(this.hre.config.paths.config!, groth16PlonkTypesDir, defaultTypesDir);
      });
    });

    describe("with complex main components", async function () {
      useEnvironment({
        fixtureProjectName: "with-circuits-main-component",
        withCleanUp: true,
      });

      it("should correctly generate verifiers with custom verifier names", async function () {
        await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_GENERATE_VERIFIERS]).run({});

        const expectedCircuitNames: string[] = ["SomeCircuit_5_3_2_5_3_", "SomeCircuit_5_3_2_5_4_"];

        const verifiersFullPath: string = getNormalizedFullPath(this.hre.config.paths.root, "contracts/verifiers");
        expect(fsExtra.readdirSync(verifiersFullPath)).to.be.deep.eq([
          ...expectedCircuitNames.map((name) => `${name}Groth16Verifier.sol`),
        ]);
      });
    });

    describe("with js project", async function () {
      useEnvironment({
        fixtureProjectName: "js-with-circuits",
        withCleanUp: true,
        withJSProject: true,
      });

      it("should correctly generate 'groth16' verifiers after running the verifiers task", async function () {
        await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_GENERATE_VERIFIERS]).run({});

        await checkMake(this.hre.config, this.hre.zkit, ["groth16"]);

        const verifiersFullPath: string = getNormalizedFullPath(this.hre.config.paths.root, "contracts/verifiers");
        expect(fsExtra.readdirSync(verifiersFullPath)).to.be.deep.eq([
          ...circuitNames.map((name) => `${name}Groth16Verifier.sol`),
        ]);

        updateProvingSystems(this.hre.config.paths.config!, ["plonk"]);
        updateTypesDir(this.hre.config.paths.config!, defaultTypesDir, plonkTypesDir);
      });

      it("should correctly generate 'plonk' verifiers after running the verifiers task", async function () {
        await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_GENERATE_VERIFIERS]).run({});

        await checkMake(this.hre.config, this.hre.zkit, ["plonk"]);

        const verifiersFullPath: string = getNormalizedFullPath(this.hre.config.paths.root, "contracts/verifiers");
        expect(fsExtra.readdirSync(verifiersFullPath)).to.be.deep.eq([
          ...circuitNames.map((name) => `${name}PlonkVerifier.sol`),
        ]);

        updateProvingSystems(this.hre.config.paths.config!, ["groth16", "plonk"]);
        updateTypesDir(this.hre.config.paths.config!, plonkTypesDir, groth16PlonkTypesDir);
      });

      it("should correctly generate 'groth16' and 'plonk' verifiers after running the verifiers task", async function () {
        const provingSystemsArr: ProvingSystemType[] = ["groth16", "plonk"];

        await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_GENERATE_VERIFIERS]).run({});

        await checkMake(this.hre.config, this.hre.zkit, provingSystemsArr);

        const verifiersFullPath: string = getNormalizedFullPath(this.hre.config.paths.root, "contracts/verifiers");
        const verifiersNameArr: string[] = [];

        for (const circuitName of circuitNames) {
          verifiersNameArr.push(
            ...provingSystemsArr.map((provingSystem) => `${circuitName}${capitalize(provingSystem)}Verifier.sol`),
          );
        }

        expect(fsExtra.readdirSync(verifiersFullPath)).to.be.deep.eq(verifiersNameArr);

        updateProvingSystems(this.hre.config.paths.config!, ["groth16"]);
        updateTypesDir(this.hre.config.paths.config!, groth16PlonkTypesDir, defaultTypesDir);
      });
    });
  });

  describe("clean", async function () {
    describe("with ts project", async function () {
      useEnvironment({
        fixtureProjectName: "with-circuits",
        withCleanUp: true,
      });

      it("should correctly clean up the generated artifacts, types, etc", async function () {
        expect(fsExtra.readdirSync(this.hre.config.paths.root)).to.be.deep.eq([
          ".gitignore",
          "circuits",
          "contracts",
          "generated-types",
          "hardhat.config.ts",
          "mock-circuits",
          "package.json",
        ]);

        expect(fsExtra.readdirSync(getNormalizedFullPath(this.hre.config.paths.root, "generated-types"))).to.be.deep.eq(
          [],
        );

        await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_MAKE]).run({});

        const typesDir: string = getNormalizedFullPath(this.hre.config.paths.root, "generated-types");
        const cacheDir: string = getNormalizedFullPath(this.hre.config.paths.root, "cache");
        const zkitDir: string = getNormalizedFullPath(this.hre.config.paths.root, "zkit");

        await checkMake(this.hre.config, this.hre.zkit, ["groth16"]);

        await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_ZKIT_CLEAN]).run({});

        expect(fsExtra.readdirSync(cacheDir)).to.be.deep.eq([]);
        expect(fsExtra.readdirSync(typesDir)).to.be.deep.eq([]);
        expect(fsExtra.readdirSync(zkitDir)).to.be.deep.eq(["ptau"]);
      });
    });

    describe("with js project", async function () {
      useEnvironment({
        fixtureProjectName: "js-with-circuits",
        withCleanUp: true,
        withJSProject: true,
      });

      it("should correctly clean up the generated artifacts, types, etc", async function () {
        expect(fsExtra.readdirSync(this.hre.config.paths.root)).to.be.deep.eq([
          ".gitignore",
          "circuits",
          "contracts",
          "hardhat.config.js",
          "package.json",
        ]);

        await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_MAKE]).run({});

        const cacheDir: string = getNormalizedFullPath(this.hre.config.paths.root, "cache");
        const zkitDir: string = getNormalizedFullPath(this.hre.config.paths.root, "zkit");

        await checkMake(this.hre.config, this.hre.zkit, ["groth16"]);

        await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_ZKIT_CLEAN]).run({});

        expect(fsExtra.readdirSync(cacheDir)).to.be.deep.eq([]);
        expect(fsExtra.readdirSync(zkitDir)).to.be.deep.eq(["ptau"]);
      });
    });
  });
});
