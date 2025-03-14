import os from "os";
import fsExtra from "fs-extra";

import { spy } from "sinon";
import { expect } from "chai";

import { cleanUp, useEnvironment } from "@test-helpers";
import { getNormalizedFullPath } from "@src/utils/path-utils";

import { CompilerPlatformBinary } from "@src/types/core";
import { createReporter, Reporter } from "@src/reporter";
import { LATEST_SUPPORTED_CIRCOM_VERSION } from "@src/constants";
import { CircomCompilerDownloader } from "@src/core/compiler/CircomCompilerDownloader";

describe("CircomCompilerDownloader", () => {
  createReporter(true);

  describe("isCompilerDownloaded", () => {
    useEnvironment({ fixtureProjectName: "with-circuits" });

    it("should correctly identify whether the latest compatible compiler is downloaded", async function () {
      cleanUp(this.hre.config.paths.root);

      const compilersDir = getNormalizedFullPath(this.hre.config.paths.root, "compilers");
      await fsExtra.ensureDir(compilersDir);

      const circomCompilerDownloader = CircomCompilerDownloader.getCircomCompilerDownloader(
        CircomCompilerDownloader.getCompilerPlatformBinary(),
        compilersDir,
      );

      expect(await circomCompilerDownloader.isCompilerDownloaded("2.1.1", false)).to.be.false;

      await circomCompilerDownloader.downloadCompiler("2.1.1", false, true);

      expect(await circomCompilerDownloader.isCompilerDownloaded("2.1.1", false)).to.be.true;
    });

    it("should correctly identify whether the specific compiler version is downloaded", async function () {
      const compilersDir = getNormalizedFullPath(this.hre.config.paths.root, "compilers");
      await fsExtra.ensureDir(compilersDir);

      const circomCompilerDownloader = CircomCompilerDownloader.getCircomCompilerDownloader(
        CompilerPlatformBinary.WASM,
        compilersDir,
      );

      expect(await circomCompilerDownloader.isCompilerDownloaded("2.1.8", true)).to.be.false;

      await circomCompilerDownloader.downloadCompiler("2.1.8", true, true);

      expect(await circomCompilerDownloader.isCompilerDownloaded("2.1.8", true)).to.be.true;
    });
  });

  describe("getCompilerBinary", () => {
    useEnvironment({ fixtureProjectName: "with-circuits" });

    it("should return a correct compiler binary path", async function () {
      const compilersDir = getNormalizedFullPath(this.hre.config.paths.root, "compilers");
      await fsExtra.ensureDir(compilersDir);

      const platform = CircomCompilerDownloader.getCompilerPlatformBinary();

      const circomCompilerDownloader = CircomCompilerDownloader.getCircomCompilerDownloader(platform, compilersDir);

      expect(await circomCompilerDownloader.getCompilerBinary("2.0.0", false)).to.be.deep.equal({
        binaryPath: `${compilersDir}/${LATEST_SUPPORTED_CIRCOM_VERSION}/${platform}`,
        version: LATEST_SUPPORTED_CIRCOM_VERSION,
        isWasm: false,
      });
    });

    it("should return a correct specific version compiler binary path", async function () {
      const compilersDir = getNormalizedFullPath(this.hre.config.paths.root, "compilers");
      await fsExtra.ensureDir(compilersDir);

      const platform = CompilerPlatformBinary.WASM;

      const circomCompilerDownloader = CircomCompilerDownloader.getCircomCompilerDownloader(platform, compilersDir);

      expect(await circomCompilerDownloader.getCompilerBinary("2.1.8", true)).to.be.deep.equal({
        binaryPath: `${compilersDir}/2.1.8/${platform}`,
        version: "2.1.8",
        isWasm: true,
      });
    });

    it("should throw an error if the correct compiler is not downloaded", async function () {
      const compilersDir = getNormalizedFullPath(this.hre.config.paths.root, "compilers");
      await fsExtra.ensureDir(compilersDir);

      const circomCompilerDownloader = CircomCompilerDownloader.getCircomCompilerDownloader(
        CircomCompilerDownloader.getCompilerPlatformBinary(),
        compilersDir,
      );

      await expect(circomCompilerDownloader.getCompilerBinary("2.1.7", true)).to.be.rejectedWith(
        "Trying to get a Circom compiler v2.1.7 before it was downloaded",
      );
    });

    it("should throw an error if no latest compiler is found", async function () {
      cleanUp(this.hre.config.paths.root);

      const compilersDir = getNormalizedFullPath(this.hre.config.paths.root, "compilers");
      await fsExtra.ensureDir(compilersDir);

      const circomCompilerDownloader = CircomCompilerDownloader.getCircomCompilerDownloader(
        CircomCompilerDownloader.getCompilerPlatformBinary(),
        compilersDir,
      );

      await expect(circomCompilerDownloader.getCompilerBinary("2.1.6", false)).to.be.rejectedWith(
        "No latest compiler found",
      );
    });
  });

  describe("downloadCompiler", () => {
    useEnvironment({ fixtureProjectName: "with-circuits", withCleanUp: true });

    it("should download the latest available compiler properly", async function () {
      const compilersDir = getNormalizedFullPath(this.hre.config.paths.root, "compilers");
      await fsExtra.ensureDir(compilersDir);

      const platform = CircomCompilerDownloader.getCompilerPlatformBinary();

      const circomCompilerDownloader = CircomCompilerDownloader.getCircomCompilerDownloader(platform, compilersDir);

      await circomCompilerDownloader.downloadCompiler("2.0.0", false, true);

      expect(fsExtra.readdirSync(`${compilersDir}/${LATEST_SUPPORTED_CIRCOM_VERSION}`)).to.be.deep.equal([platform]);
      expect(await circomCompilerDownloader.isCompilerDownloaded(LATEST_SUPPORTED_CIRCOM_VERSION, true)).to.be.true;
    });

    it("should download the specific compiler version properly", async function () {
      const compilersDir = getNormalizedFullPath(this.hre.config.paths.root, "compilers");
      await fsExtra.ensureDir(compilersDir);

      const platform = CompilerPlatformBinary.WASM;

      const circomCompilerDownloader = CircomCompilerDownloader.getCircomCompilerDownloader(platform, compilersDir);

      await circomCompilerDownloader.downloadCompiler("2.1.8", true, true);

      expect(fsExtra.readdirSync(`${compilersDir}/2.1.8`)).to.be.deep.equal([platform]);
      expect(await circomCompilerDownloader.isCompilerDownloaded("2.1.8", true)).to.be.true;
    });

    it("should return without downloading if the needed compiler is downloaded", async function () {
      const compilersDir = getNormalizedFullPath(this.hre.config.paths.root, "compilers");
      await fsExtra.ensureDir(compilersDir);

      const circomCompilerDownloader = CircomCompilerDownloader.getCircomCompilerDownloader(
        CircomCompilerDownloader.getCompilerPlatformBinary(),
        compilersDir,
      );
      await circomCompilerDownloader.downloadCompiler("2.1.9", true, true);

      const reporterSpy = spy(Reporter!, "reportCircomCompilerDownloadingInfo");

      await circomCompilerDownloader.downloadCompiler("2.1.9", true, true);

      expect(reporterSpy.called).to.be.false;
    });

    it("should throw an error if pass unsupported WASM compiler version", async function () {
      const compilersDir = getNormalizedFullPath(this.hre.config.paths.root, "compilers");
      await fsExtra.ensureDir(compilersDir);

      const platform = CompilerPlatformBinary.WASM;
      const circomCompilerDownloader = CircomCompilerDownloader.getCircomCompilerDownloader(platform, compilersDir);

      await expect(circomCompilerDownloader.downloadCompiler("2.0.5", true, true)).to.be.rejectedWith(
        "Unsupported WASM version - 2.0.5",
      );
    });

    it("should throw an error if the downloaded compiler is not working", async function () {
      const compilersDir = getNormalizedFullPath(this.hre.config.paths.root, "compilers");
      await fsExtra.ensureDir(compilersDir);

      const targetPlatform =
        os.platform() === "win32" ? CompilerPlatformBinary.MACOS_ARM : CompilerPlatformBinary.WINDOWS_ARM;

      const circomCompilerDownloader = CircomCompilerDownloader.getCircomCompilerDownloader(
        targetPlatform,
        compilersDir,
      );

      await expect(circomCompilerDownloader.downloadCompiler("2.0.0", false, true)).to.be.rejectedWith(
        "Downloaded compiler is not working",
      );
    });

    it("should throw an error if compiler downloading was not successful", async function () {
      const compilersDir = getNormalizedFullPath(this.hre.config.paths.root, "compilers");
      await fsExtra.ensureDir(compilersDir);

      const circomCompilerDownloader = CircomCompilerDownloader.getCircomCompilerDownloader(
        CompilerPlatformBinary.MACOS_ARM,
        compilersDir,
      );

      await expect(circomCompilerDownloader.downloadCompiler("2.0.0", true, true)).to.be.rejectedWith(
        "Failed to download Circom compiler v2.0.0. Please try again or download manually.",
      );
    });
  });
});
