import fsExtra from "fs-extra";

import { spy } from "sinon";
import { expect } from "chai";

import { cleanUp, useEnvironment } from "../../../../helpers";
import { getNormalizedFullPath } from "../../../../../src/utils/path-utils";

import { CompilerPlatformBinary } from "../../../../../src/types/core";
import { createReporter, Reporter } from "../../../../../src/reporter";
import { LATEST_SUPPORTED_CIRCOM_VERSION } from "../../../../../src/constants";
import { CircomCompilerDownloader } from "../../../../../src/core/compiler/CircomCompilerDownloader";

describe("CircomCompilerDownloader", () => {
  createReporter(true);

  describe("isCompilerDownloaded", () => {
    useEnvironment("with-circuits");

    it("should correctly identify whether the latest compatible compiler is downloaded", async function () {
      this.timeout(30000);

      cleanUp(this.hre.config.paths.root);

      const compilersDir = getNormalizedFullPath(this.hre.config.paths.root, "compilers");
      await fsExtra.ensureDir(compilersDir);

      const circomCompilerDownloader = CircomCompilerDownloader.getCircomCompilerDownloader(
        CircomCompilerDownloader.getCompilerPlatformBinary(),
        compilersDir,
      );

      expect(await circomCompilerDownloader.isCompilerDownloaded("2.1.1", false)).to.be.false;

      await circomCompilerDownloader.downloadCompiler("2.1.1", false);

      expect(await circomCompilerDownloader.isCompilerDownloaded("2.1.1", false)).to.be.true;
    });

    it("should correctly identify whether the specific compiler version is downloaded", async function () {
      this.timeout(30000);

      const compilersDir = getNormalizedFullPath(this.hre.config.paths.root, "compilers");
      await fsExtra.ensureDir(compilersDir);

      const circomCompilerDownloader = CircomCompilerDownloader.getCircomCompilerDownloader(
        CompilerPlatformBinary.WASM,
        compilersDir,
      );

      expect(await circomCompilerDownloader.isCompilerDownloaded("2.1.8", true)).to.be.false;

      await circomCompilerDownloader.downloadCompiler("2.1.8", true);

      expect(await circomCompilerDownloader.isCompilerDownloaded("2.1.8", true)).to.be.true;
    });
  });

  describe("getCompilerBinary", () => {
    useEnvironment("with-circuits");

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
    useEnvironment("with-circuits", true);

    it("should download the latest available compiler properly", async function () {
      const compilersDir = getNormalizedFullPath(this.hre.config.paths.root, "compilers");
      await fsExtra.ensureDir(compilersDir);

      const platform = CircomCompilerDownloader.getCompilerPlatformBinary();

      const circomCompilerDownloader = CircomCompilerDownloader.getCircomCompilerDownloader(platform, compilersDir);

      await circomCompilerDownloader.downloadCompiler("2.0.0", false);

      expect(fsExtra.readdirSync(`${compilersDir}/${LATEST_SUPPORTED_CIRCOM_VERSION}`)).to.be.deep.equal([platform]);
      expect(await circomCompilerDownloader.isCompilerDownloaded(LATEST_SUPPORTED_CIRCOM_VERSION, true)).to.be.true;
    });

    it("should download the specific compiler version properly", async function () {
      const compilersDir = getNormalizedFullPath(this.hre.config.paths.root, "compilers");
      await fsExtra.ensureDir(compilersDir);

      const platform = CompilerPlatformBinary.WASM;

      const circomCompilerDownloader = CircomCompilerDownloader.getCircomCompilerDownloader(platform, compilersDir);

      await circomCompilerDownloader.downloadCompiler("2.1.8", true);

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
      await circomCompilerDownloader.downloadCompiler("2.1.9", true);

      const reporterSpy = spy(Reporter!, "reportCircomCompilerDownloadingInfo");

      await circomCompilerDownloader.downloadCompiler("2.1.9", true);

      expect(reporterSpy.called).to.be.false;
    });

    it("should throw an error if the downloaded compiler is not working", async function () {
      this.timeout(30000);

      const compilersDir = getNormalizedFullPath(this.hre.config.paths.root, "compilers");
      await fsExtra.ensureDir(compilersDir);

      // this test will fail if ran on Windows
      const circomCompilerDownloader = CircomCompilerDownloader.getCircomCompilerDownloader(
        CompilerPlatformBinary.WINDOWS_ARM,
        compilersDir,
      );

      await expect(circomCompilerDownloader.downloadCompiler("2.0.0", false)).to.be.rejectedWith(
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

      await expect(circomCompilerDownloader.downloadCompiler("2.1.8", true)).to.be.rejectedWith(
        "Failed to download Circom compiler v2.1.8. Please try again or download manually.",
      );
    });
  });
});
