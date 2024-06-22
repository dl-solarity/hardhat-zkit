import fsExtra from "fs-extra";

import { expect } from "chai";

import { useEnvironment } from "../../../helpers";
import { getNormalizedFullPath } from "../../../../src/utils/path-utils";
import { CompileFlags, ICircomCompiler } from "../../../../src/types/compile";
import { CircomCompiler, CircomCompilerFactory } from "../../../../src/compile/core";

describe("CircomCompilerFactory", () => {
  const defaultCompileFlags: CompileFlags = {
    r1cs: true,
    wasm: true,
    c: false,
    json: false,
    sym: false,
  };

  describe("createCircomCompiler", () => {
    useEnvironment("with-circuits");

    it("should correctly create circom compiler instance", async function () {
      const compiler: ICircomCompiler = CircomCompilerFactory.createCircomCompiler("0.2.18");

      const circuitFullPath: string = getNormalizedFullPath(this.hre.config.paths.root, "circuits/main/mul2.circom");
      const artifactsFullPath: string = getNormalizedFullPath(
        this.hre.config.paths.root,
        "zkit/artifacts/test/mul2.circom",
      );

      fsExtra.mkdirSync(artifactsFullPath, { recursive: true });
      expect(fsExtra.readdirSync(artifactsFullPath)).to.be.deep.eq([]);

      await compiler.compile({
        circuitFullPath,
        artifactsFullPath,
        compileFlags: { ...defaultCompileFlags, sym: true },
        quiet: true,
      });

      expect(fsExtra.readdirSync(artifactsFullPath)).to.be.deep.eq(["mul2.r1cs", "mul2.sym", "mul2_js"]);

      fsExtra.rmSync(artifactsFullPath, { recursive: true, force: true });
    });

    it("should correctly throw error if pass invalid version", async function () {
      const invalidVersion = "2.0.0";

      const reason = `Unsupported Circom compiler version - ${invalidVersion}. Please provide another version.`;

      expect(function () {
        CircomCompilerFactory.createCircomCompiler(invalidVersion as any);
      }).to.throw(reason);
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
