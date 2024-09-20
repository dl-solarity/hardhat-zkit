import fsExtra from "fs-extra";

import { expect } from "chai";

import { getProjectRootPath, useEnvironment } from "../../../../helpers";
import { getNormalizedFullPath } from "../../../../../src/utils/path-utils";
import { WASMCircomCompiler } from "../../../../../src/core";
import { NODE_MODULES } from "../../../../../src/constants";

import { CompileFlags } from "../../../../../src/types/core";

describe("WASMCircomCompiler", () => {
  const defaultCompileFlags: CompileFlags = {
    r1cs: true,
    wasm: true,
    c: false,
    json: false,
    sym: false,
  };

  describe("compile:without-libraries", () => {
    let circomCompiler: WASMCircomCompiler;

    useEnvironment("with-circuits");

    beforeEach("setup", async function () {
      circomCompiler = new WASMCircomCompiler(
        fsExtra.readFileSync(require.resolve("@distributedlab/circom2/circom.wasm")),
      );
    });

    it("should correctly compile circuit", async function () {
      const circuitFullPath: string = getNormalizedFullPath(this.hre.config.paths.root, "circuits/main/mul2.circom");
      const artifactsFullPath: string = getNormalizedFullPath(
        this.hre.config.paths.root,
        "zkit/artifacts/test/mul2.circom",
      );
      const errorFileFullPath: string = getNormalizedFullPath(artifactsFullPath, "errors.log");
      const typesDir: string = getNormalizedFullPath(this.hre.config.paths.root, "generated-types/zkit");

      fsExtra.rmSync(artifactsFullPath, { recursive: true, force: true });
      fsExtra.mkdirSync(artifactsFullPath, { recursive: true });

      await circomCompiler.compile({
        circuitFullPath,
        artifactsFullPath,
        errorFileFullPath,
        linkLibraries: [],
        compileFlags: { ...defaultCompileFlags, sym: true },
        quiet: true,
      });

      fsExtra.rmSync(errorFileFullPath, { force: true });

      expect(fsExtra.readdirSync(artifactsFullPath)).to.be.deep.eq(["mul2.r1cs", "mul2.sym", "mul2_js"]);

      fsExtra.rmSync(typesDir, { recursive: true, force: true });
    });

    it("should correctly throw error with quiet=true", async function () {
      const circuitFullPath: string = getNormalizedFullPath(
        this.hre.config.paths.root,
        "circuits/base/mul2Base.circom",
      );
      const artifactsFullPath: string = getNormalizedFullPath(
        this.hre.config.paths.root,
        "zkit/artifacts/test/mul2.circom",
      );
      const errorFileFullPath: string = getNormalizedFullPath(artifactsFullPath, "errors.log");

      const reason: string = "Compilation failed.\nHardhatZKitError: Error during compiler execution. Exit code: 1.";

      await expect(
        circomCompiler.compile({
          circuitFullPath,
          artifactsFullPath,
          errorFileFullPath,
          linkLibraries: [],
          compileFlags: defaultCompileFlags,
          quiet: true,
        }),
      ).to.be.rejectedWith(reason);
    });

    it("should correctly throw error with quiet=false", async function () {
      const circuitFullPath: string = getNormalizedFullPath(
        this.hre.config.paths.root,
        "circuits/base/mul2Base.circom",
      );
      const artifactsFullPath: string = getNormalizedFullPath(
        this.hre.config.paths.root,
        "zkit/artifacts/test/mul2.circom",
      );
      const errorFileFullPath: string = getNormalizedFullPath(artifactsFullPath, "errors.log");

      fsExtra.mkdirSync(artifactsFullPath, { recursive: true });

      const reason: string = "Compilation failed.";

      await expect(
        circomCompiler.compile({
          circuitFullPath,
          artifactsFullPath,
          errorFileFullPath,
          linkLibraries: [],
          compileFlags: defaultCompileFlags,
          quiet: false,
        }),
      ).to.be.rejectedWith(reason);

      fsExtra.rmSync(artifactsFullPath, { recursive: true, force: true });
    });
  });

  describe("compile:with-libraries", () => {
    let circomCompiler: WASMCircomCompiler;

    useEnvironment("circuits-with-libraries");

    beforeEach("setup", async function () {
      circomCompiler = new WASMCircomCompiler(
        fsExtra.readFileSync(require.resolve("@distributedlab/circom2/circom.wasm")),
      );
    });

    it("should correctly compile circuit with library include", async function () {
      const circuitFullPath: string = getNormalizedFullPath(this.hre.config.paths.root, "circuits/hash2.circom");
      const artifactsFullPath: string = getNormalizedFullPath(
        this.hre.config.paths.root,
        "zkit/artifacts/test/hash2.circom",
      );
      const errorFileFullPath: string = getNormalizedFullPath(artifactsFullPath, "errors.log");
      const typesDir: string = getNormalizedFullPath(this.hre.config.paths.root, "generated-types/zkit");
      const nodeModulesPath: string = getNormalizedFullPath(getProjectRootPath(), NODE_MODULES);

      fsExtra.rmSync(artifactsFullPath, { recursive: true, force: true });
      fsExtra.mkdirSync(artifactsFullPath, { recursive: true });

      await circomCompiler.compile({
        circuitFullPath,
        artifactsFullPath,
        errorFileFullPath,
        linkLibraries: [nodeModulesPath],
        compileFlags: { ...defaultCompileFlags, sym: true },
        quiet: true,
      });

      fsExtra.rmSync(errorFileFullPath, { force: true });

      expect(fsExtra.readdirSync(artifactsFullPath)).to.be.deep.eq(["hash2.r1cs", "hash2.sym", "hash2_js"]);

      fsExtra.rmSync(typesDir, { recursive: true, force: true });
    });
  });

  describe("getCompilationArgs", () => {
    let circomCompiler: WASMCircomCompiler;

    beforeEach("setup", async function () {
      circomCompiler = new WASMCircomCompiler(
        fsExtra.readFileSync(require.resolve("@distributedlab/circom2/circom.wasm")),
      );
    });

    it("should return correct compilation args", async function () {
      const circuitFullPath: string = "circuit-path";
      const artifactsFullPath: string = "artifacts-path";
      const errorFileFullPath: string = "errors-path";

      let expectedArgs: string[] = [circuitFullPath, "-o", artifactsFullPath, "--r1cs", "--wasm"];
      let args: string[] = circomCompiler.getCompilationArgs({
        circuitFullPath,
        artifactsFullPath,
        errorFileFullPath,
        linkLibraries: [],
        compileFlags: defaultCompileFlags,
        quiet: true,
      });

      expect(args).to.be.deep.eq(expectedArgs);

      expectedArgs = [circuitFullPath, "-o", artifactsFullPath, "--r1cs", "--wasm", "--c", "--sym"];
      args = circomCompiler.getCompilationArgs({
        circuitFullPath,
        artifactsFullPath,
        errorFileFullPath,
        linkLibraries: [],
        compileFlags: { ...defaultCompileFlags, c: true, sym: true },
        quiet: true,
      });

      expect(args).to.be.deep.eq(expectedArgs);
    });
  });
});
