import fsExtra from "fs-extra";

import { expect } from "chai";

import { useEnvironment } from "../../../helpers";
import { CircomCompilerFactory } from "../../../../src/core";
import { getNormalizedFullPath } from "../../../../src/utils/path-utils";

import { CompileFlags, ICircomCompiler } from "../../../../src/types/core";

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
      const compiler: ICircomCompiler = CircomCompilerFactory.createWASMCircomCompiler("0.2.18");

      const circuitFullPath: string = getNormalizedFullPath(this.hre.config.paths.root, "circuits/main/mul2.circom");
      const artifactsFullPath: string = getNormalizedFullPath(
        this.hre.config.paths.root,
        "zkit/artifacts/test/mul2.circom",
      );
      const errorFileFullPath: string = getNormalizedFullPath(artifactsFullPath, "errors.log");
      const typesDir: string = getNormalizedFullPath(this.hre.config.paths.root, "generated-types/zkit");

      fsExtra.rmSync(artifactsFullPath, { recursive: true, force: true });
      fsExtra.mkdirSync(artifactsFullPath, { recursive: true });

      await compiler.compile({
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

    it("should correctly throw error if pass invalid version", async function () {
      const invalidVersion = "2.0.0";

      const reason = `Unsupported Circom compiler version - ${invalidVersion}. Please provide another version.`;

      expect(function () {
        CircomCompilerFactory.createWASMCircomCompiler(invalidVersion as any);
      }).to.throw(reason);
    });
  });
});
