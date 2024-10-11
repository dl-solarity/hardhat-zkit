import os from "os";
import path from "path";
import fsExtra from "fs-extra";

import { expect } from "chai";
import { before } from "mocha";
import { stub, SinonStub } from "sinon";

import { useEnvironment } from "@test-helpers";
import { getNormalizedFullPath } from "@src/utils/path-utils";
import { CompilerPlatformBinary, ICircomCompiler } from "@src/types/core";
import {
  BaseCircomCompilerFactory,
  BinaryCircomCompiler,
  CircomCompilerFactory,
  createCircomCompilerFactory,
  WASMCircomCompiler,
} from "@src/core";

import { CircomCompilerDownloader } from "@src/core/compiler/CircomCompilerDownloader";

import { defaultCompileFlags } from "../../../constants";
import { LATEST_SUPPORTED_CIRCOM_VERSION } from "@src/constants";

describe("CircomCompilerFactory", () => {
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
      const compiler: ICircomCompiler = await CircomCompilerFactory!.createCircomCompiler("2.1.7", false);

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
      let invalidVersion = "2.1.10";
      let reason = `Unsupported Circom compiler version - ${invalidVersion}. Please provide another version.`;

      createCircomCompilerFactory();
      await expect(CircomCompilerFactory!.createCircomCompiler(invalidVersion, true)).to.be.rejectedWith(reason);

      invalidVersion = "2.2.0";
      reason = `Unsupported Circom compiler version - ${invalidVersion}. Please provide another version.`;

      await expect(CircomCompilerFactory!.createCircomCompiler(invalidVersion, false)).to.be.rejectedWith(reason);

      invalidVersion = "2.0.4";
      reason = `Unsupported Circom compiler version - ${invalidVersion}. Please provide another version.`;

      await expect(CircomCompilerFactory!.createCircomCompiler(invalidVersion, true)).to.be.rejectedWith(reason);
    });

    it("should create compiler for each platform properly", async function () {
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

    it("should create wasm compiler if the downloaded platform compiler is not working", async function () {
      const archStub = stub(os, "arch").callsFake(() => {
        return "arm64";
      });

      const mockPlatform = os.platform() === "win32" ? "darwin" : "win32";
      const platformStub = stub(os, "platform").callsFake(() => mockPlatform);

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
