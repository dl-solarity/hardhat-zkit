import os from "os";
import path from "path";
import fsExtra from "fs-extra";

import { stub } from "sinon";
import { expect } from "chai";

import { useEnvironment } from "../../../../helpers";
import { getNormalizedFullPath } from "../../../../../src/utils/path-utils";
import { CompileFlags, CompilerPlatformBinary, ICircomCompiler } from "../../../../../src/types/core";
import {
  BinaryCircomCompiler,
  CircomCompilerFactory,
  createCircomCompilerFactory,
  WASMCircomCompiler,
} from "../../../../../src/core";

import { CircomCompilerDownloader } from "../../../../../src/core/compiler/CircomCompilerDownloader";

import { LATEST_SUPPORTED_CIRCOM_VERSION } from "../../../../../src/constants";

describe("CircomCompilerFactory", () => {
  const defaultCompileFlags: CompileFlags = {
    r1cs: true,
    wasm: true,
    c: false,
    json: false,
    sym: false,
  };

  async function checkPlatformSpecificCompiler(osType: NodeJS.Platform) {
    const compilerDir = path.join(os.homedir(), ".zkit", "compilers", LATEST_SUPPORTED_CIRCOM_VERSION);
    fsExtra.rmSync(compilerDir, { recursive: true, force: true });

    const platformStub = stub(os, "platform").callsFake(() => {
      return osType;
    });

    const compiler = await CircomCompilerFactory!.createCircomCompiler("2.0.0", false, false);

    const platform = CircomCompilerDownloader.getCompilerPlatformBinary();

    if (platform === CompilerPlatformBinary.WASM) {
      expect(compiler).to.be.instanceof(WASMCircomCompiler);
    } else {
      expect(compiler).to.be.instanceof(BinaryCircomCompiler);
    }

    expect(fsExtra.readdirSync(compilerDir)).to.be.deep.equal([platform]);

    fsExtra.rmSync(compilerDir, { recursive: true, force: true });
    platformStub.restore();
  }

  describe("createCircomCompiler", () => {
    useEnvironment("with-circuits");

    it("should correctly create circom compiler instance", async function () {
      createCircomCompilerFactory();
      const compiler: ICircomCompiler = await CircomCompilerFactory!.createCircomCompiler("0.2.18", false);

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
      const invalidVersion = "2.1.10";

      const reason = `Unsupported Circom compiler version - ${invalidVersion}. Please provide another version.`;

      createCircomCompilerFactory();
      await expect(CircomCompilerFactory!.createCircomCompiler(invalidVersion, false)).to.be.rejectedWith(reason);
    });

    it("should create compiler for each platform properly", async function () {
      this.timeout(50000);

      let archStub = stub(os, "arch").callsFake(() => {
        return "x64";
      });

      await checkPlatformSpecificCompiler("linux");
      await checkPlatformSpecificCompiler("darwin");
      await checkPlatformSpecificCompiler("win32");
      await checkPlatformSpecificCompiler("freebsd");

      archStub.restore();

      archStub = stub(os, "arch").callsFake(() => {
        return "arm64";
      });

      await checkPlatformSpecificCompiler("linux");
      await checkPlatformSpecificCompiler("darwin");
      await checkPlatformSpecificCompiler("win32");

      archStub.restore();

      archStub = stub(os, "arch").callsFake(() => {
        return "mips";
      });

      await checkPlatformSpecificCompiler("linux");

      archStub.restore();
    });

    it("should create amd compiler if arm compiler with specific version is unavailable", async function () {
      this.timeout(30000);

      const archStub = stub(os, "arch").callsFake(() => {
        return "arm64";
      });

      const platformStub = stub(os, "platform").callsFake(() => {
        return "darwin";
      });

      const compilerDir = path.join(os.homedir(), ".zkit", "compilers", "2.1.7");
      fsExtra.rmSync(compilerDir, { recursive: true, force: true });

      const compiler = await CircomCompilerFactory!.createCircomCompiler("2.1.7", true, false);
      const platform = CompilerPlatformBinary.MACOS_AMD;

      expect(compiler).to.be.instanceof(BinaryCircomCompiler);
      expect(fsExtra.readdirSync(compilerDir)).to.be.deep.equal([platform]);

      fsExtra.rmSync(compilerDir, { recursive: true, force: true });
      platformStub.restore();
      archStub.restore();
    });

    it("should create wasm compiler if the downloaded platform compiler is not working", async function () {
      this.timeout(30000);

      const archStub = stub(os, "arch").callsFake(() => {
        return "arm64";
      });

      // this test will fail if ran on Windows
      const platformStub = stub(os, "platform").callsFake(() => {
        return "win32";
      });

      const compilerDir = path.join(os.homedir(), ".zkit", "compilers", LATEST_SUPPORTED_CIRCOM_VERSION);
      fsExtra.rmSync(compilerDir, { recursive: true, force: true });

      const compiler = await CircomCompilerFactory!.createCircomCompiler("2.0.0", false, true);
      const platform = CompilerPlatformBinary.WASM;

      expect(compiler).to.be.instanceof(WASMCircomCompiler);
      expect(fsExtra.readdirSync(compilerDir)).to.be.deep.equal([platform]);

      fsExtra.rmSync(compilerDir, { recursive: true, force: true });
      platformStub.restore();
      archStub.restore();
    });

    it("should not download a platform compiler if there already is a wasm one", async function () {
      this.timeout(30000);
      createCircomCompilerFactory();

      const compilerDir = path.join(os.homedir(), ".zkit", "compilers");
      fsExtra.rmSync(compilerDir, { recursive: true, force: true });

      const wasmDownloader = CircomCompilerDownloader.getCircomCompilerDownloader(
        CompilerPlatformBinary.WASM,
        compilerDir,
      );
      await wasmDownloader.downloadCompiler(LATEST_SUPPORTED_CIRCOM_VERSION, true, true);

      const platformStub = stub(os, "platform").callsFake(() => {
        return "darwin";
      });

      const compiler = await CircomCompilerFactory!.createCircomCompiler(LATEST_SUPPORTED_CIRCOM_VERSION, true, false);
      const platform = CompilerPlatformBinary.WASM;

      expect(compiler).to.be.instanceof(WASMCircomCompiler);
      expect(fsExtra.readdirSync(`${compilerDir}/${LATEST_SUPPORTED_CIRCOM_VERSION}`)).to.be.deep.equal([platform]);

      fsExtra.rmSync(compilerDir, { recursive: true, force: true });
      platformStub.restore();
    });
  });
});
