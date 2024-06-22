import fsExtra from "fs-extra";

import { expect } from "chai";

import { useEnvironment } from "../../../helpers";
import { getNormalizedFullPath } from "../../../../src/utils/path-utils";
import { CompileFlags } from "../../../../src/types/compile";
import { CircomCompiler } from "../../../../src/compile/core";

describe("CircomCompiler", () => {
  const defaultCompileFlags: CompileFlags = {
    r1cs: true,
    wasm: true,
    c: false,
    json: false,
    sym: false,
  };

  describe("compile", () => {
    let circomCompiler: CircomCompiler;

    useEnvironment("with-circuits");

    beforeEach("setup", async function () {
      circomCompiler = new CircomCompiler(fsExtra.readFileSync(require.resolve("@distributedlab/circom2/circom.wasm")));
    });

    it("should correctly compile circuit", async function () {
      const circuitFullPath: string = getNormalizedFullPath(this.hre.config.paths.root, "circuits/main/mul2.circom");
      const artifactsFullPath: string = getNormalizedFullPath(
        this.hre.config.paths.root,
        "zkit/artifacts/test/mul2.circom",
      );

      fsExtra.mkdirSync(artifactsFullPath, { recursive: true });
      expect(fsExtra.readdirSync(artifactsFullPath)).to.be.deep.eq([]);

      await circomCompiler.compile({
        circuitFullPath,
        artifactsFullPath,
        compileFlags: { ...defaultCompileFlags, sym: true },
        quiet: true,
      });

      expect(fsExtra.readdirSync(artifactsFullPath)).to.be.deep.eq(["mul2.r1cs", "mul2.sym", "mul2_js"]);

      fsExtra.rmSync(artifactsFullPath, { recursive: true, force: true });
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

      const reason: string =
        "Compilation failed with an unknown error. Consider passing 'quiet=false' flag to see the compilation error.";

      await expect(
        circomCompiler.compile({
          circuitFullPath,
          artifactsFullPath,
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

      fsExtra.mkdirSync(artifactsFullPath, { recursive: true });

      const reason: string = "Compilation failed.";

      await expect(
        circomCompiler.compile({
          circuitFullPath,
          artifactsFullPath,
          compileFlags: defaultCompileFlags,
          quiet: false,
        }),
      ).to.be.rejectedWith(reason);

      fsExtra.rmSync(artifactsFullPath, { recursive: true, force: true });
    });
  });

  describe("getCompilationArgs", () => {
    let circomCompiler: CircomCompiler;

    beforeEach("setup", async function () {
      circomCompiler = new CircomCompiler(fsExtra.readFileSync(require.resolve("@distributedlab/circom2/circom.wasm")));
    });

    it("should return correct compilation args", async function () {
      const circuitFullPath: string = "circuit-path";
      const artifactsFullPath: string = "artifacts-path";

      let expectedArgs: string[] = [circuitFullPath, "-o", artifactsFullPath, "--r1cs", "--wasm"];
      let args: string[] = circomCompiler.getCompilationArgs({
        circuitFullPath,
        artifactsFullPath,
        compileFlags: defaultCompileFlags,
        quiet: true,
      });

      expect(args).to.be.deep.eq(expectedArgs);

      expectedArgs = [circuitFullPath, "-o", artifactsFullPath, "--r1cs", "--wasm", "--c", "--sym"];
      args = circomCompiler.getCompilationArgs({
        circuitFullPath,
        artifactsFullPath,
        compileFlags: { ...defaultCompileFlags, c: true, sym: true },
        quiet: true,
      });

      expect(args).to.be.deep.eq(expectedArgs);
    });
  });
});
