import os from "os";
import path from "path";
import fs from "fs-extra";
import https from "https";
import { promisify } from "util";
import { execFile } from "child_process";

import {
  COMPILER_AMD_REPOSITORY_URL,
  COMPILER_ARM_REPOSITORY_URL,
  COMPILER_WASM_REPOSITORY_URL,
  LATEST_CIRCOM_COMPILER_URL,
  WASM_COMPILER_VERSIONING,
} from "../../constants";
import { Reporter } from "../../reporter";
import { HardhatZKitError } from "../../errors";

import { CompilerPlatformBinary } from "../../types/core";

import { downloadFile } from "../../utils/utils";
import { getHighestCircomVersion, isVersionHigherOrEqual } from "../utils/versioning";

import { MultiProcessMutex } from "hardhat/internal/util/multi-process-mutex";

export class CompilerDownloader {
  public static getCompilerPlatformBinary(): CompilerPlatformBinary {
    const arch = os.arch();

    if (arch !== "x64" && arch !== "arm64") {
      return CompilerPlatformBinary.WASM;
    }

    switch (os.platform()) {
      case "win32":
        return arch === "arm64" ? CompilerPlatformBinary.WINDOWS_ARM : CompilerPlatformBinary.WINDOWS_AMD;
      case "linux":
        return arch === "arm64" ? CompilerPlatformBinary.LINUX_ARM : CompilerPlatformBinary.LINUX_AMD;
      case "darwin":
        return arch === "arm64" ? CompilerPlatformBinary.MACOS_ARM : CompilerPlatformBinary.MACOS_AMD;
      default:
        return CompilerPlatformBinary.WASM;
    }
  }

  private readonly _mutex = new MultiProcessMutex("compiler-download");

  constructor(
    private readonly _platform: CompilerPlatformBinary,
    private readonly _compilersDir: string,
  ) {}

  public isCompilerDownloaded(version: string): boolean {
    const downloadPath = this._getCompilerDownloadPath(version);
    const downloadPathWasm = this._getWasmCompilerDownloadPath(version);

    return fs.pathExistsSync(downloadPath) || fs.pathExistsSync(downloadPathWasm);
  }

  public async isCompatibleCompilerDownloaded(highestVersion: string): Promise<boolean> {
    const latestDownloadedVersion = await this.getLatestDownloadedCircomVersion();

    const isVersionCompatible = isVersionHigherOrEqual(latestDownloadedVersion, highestVersion);

    if (!isVersionCompatible) {
      return false;
    }

    const downloadPath = this._getCompilerDownloadPath(latestDownloadedVersion);
    const downloadPathWasm = this._getWasmCompilerDownloadPath(latestDownloadedVersion);

    return isVersionCompatible && (fs.pathExistsSync(downloadPath) || fs.pathExistsSync(downloadPathWasm));
  }

  public async getCompilerBinary(version: string): Promise<{ binaryPath: string; isWasm: boolean }> {
    const compilerBinaryPath = this._getCompilerDownloadPath(version);
    const wasmCompilerBinaryPath = this._getWasmCompilerDownloadPath(version);

    if (!(await fs.pathExists(compilerBinaryPath))) {
      if (!(await fs.pathExists(wasmCompilerBinaryPath))) {
        throw new HardhatZKitError(`Trying to get a Circom compiler v${version} before it was downloaded`);
      }

      return { binaryPath: wasmCompilerBinaryPath, isWasm: true };
    }

    return { binaryPath: compilerBinaryPath, isWasm: false };
  }

  public async getLatestCompilerBinary(): Promise<{ binaryPath: string; isWasm: boolean }> {
    const latestDownloadedCompilerVersion = await this.getLatestDownloadedCircomVersion();
    if (!latestDownloadedCompilerVersion || latestDownloadedCompilerVersion === "0.0.0") {
      throw new HardhatZKitError("No latest compiler found");
    }

    const compilerBinaryPath = this._getCompilerDownloadPath(latestDownloadedCompilerVersion);

    if (!fs.existsSync(compilerBinaryPath)) {
      return { binaryPath: this._getWasmCompilerDownloadPath(latestDownloadedCompilerVersion), isWasm: true };
    }

    return { binaryPath: compilerBinaryPath, isWasm: false };
  }

  public async downloadCompiler(version: string | undefined): Promise<void> {
    await this._mutex.use(async () => {
      const versionToDownload = version || (await this._getLatestCircomVersion());

      const isDownloaded = version
        ? this.isCompilerDownloaded(versionToDownload)
        : await this.isCompatibleCompilerDownloaded(versionToDownload);

      if (isDownloaded) {
        return;
      }

      Reporter!.reportCircomCompilerDownloadingInfo(versionToDownload, this._platform === CompilerPlatformBinary.WASM);

      let downloadPath: string;

      try {
        downloadPath = await this._downloadCompiler(versionToDownload);
      } catch (error: any) {
        throw new HardhatZKitError(error);
      }

      await this._postProcessCompilerDownload(downloadPath);
    });
  }

  public async getLatestDownloadedCircomVersion(): Promise<string> {
    try {
      const entries = await fs.promises.readdir(this._compilersDir, { withFileTypes: true });

      const versions = entries
        .filter((entry) => {
          if (!entry.isDirectory()) {
            return false;
          }

          const dirPath = path.join(this._compilersDir, entry.name);

          return fs.readdirSync(dirPath).length > 0;
        })
        .map((entry) => entry.name);

      if (versions.length === 0) {
        return "0.0.0";
      }

      return getHighestCircomVersion(versions);
    } catch (error) {
      throw new HardhatZKitError(`Error reading directory: ${error}`);
    }
  }

  private async _getLatestCircomVersion(): Promise<string> {
    return new Promise((resolve) => {
      https
        .get(LATEST_CIRCOM_COMPILER_URL, (res) => {
          if (res.statusCode === 302 && res.headers.location) {
            const location = res.headers.location;
            const parts = location.split("/");
            const versionTag = parts[parts.length - 1];
            const version = versionTag.startsWith("v") ? versionTag.substring(1) : versionTag;

            resolve(version);
          } else {
            throw new HardhatZKitError("Unable to resolve the latest available circom version");
          }
        })
        .on("error", (error) => {
          throw new HardhatZKitError(`Unable to resolve the latest available circom version: ${error}`);
        });
    });
  }

  private async _downloadCompiler(version: string): Promise<string> {
    const amdUrl = `${COMPILER_AMD_REPOSITORY_URL}/v${version}/${this._platform}`;
    const armUrl = `${COMPILER_ARM_REPOSITORY_URL}/v${version}/${this._platform}`;
    const wasmUrl = `${COMPILER_WASM_REPOSITORY_URL}/v${WASM_COMPILER_VERSIONING[version]}/circom.wasm`;

    const downloadPath = this._getCompilerDownloadPath(version);

    let url: string;

    if (this._platform === CompilerPlatformBinary.WASM) {
      url = wasmUrl;
    } else {
      url = os.arch() === "x64" ? amdUrl : armUrl;
    }

    if (
      !(await downloadFile(
        downloadPath,
        url,
        () => Reporter!.reportCircomCompilerDownloadingFinish(),
        () => Reporter!.reportCircomCompilerDownloadingError(),
      ))
    ) {
      throw new HardhatZKitError(
        `Failed to download Circom compiler v${version}. Please try again or download manually.`,
      );
    }

    return downloadPath;
  }

  private _getCompilerDownloadPath(version: string): string {
    return path.join(this._compilersDir, version, this._platform);
  }

  private _getWasmCompilerDownloadPath(version: string): string {
    return path.join(this._compilersDir, version, "circom.wasm");
  }

  private async _postProcessCompilerDownload(downloadPath: string): Promise<void> {
    if (
      this._platform !== CompilerPlatformBinary.WINDOWS_AMD &&
      this._platform !== CompilerPlatformBinary.WINDOWS_ARM &&
      this._platform !== CompilerPlatformBinary.WASM
    ) {
      fs.chmodSync(downloadPath, 0o755);
    }

    if (this._platform !== CompilerPlatformBinary.WASM && !(await this._checkCompilerWork(downloadPath))) {
      throw new HardhatZKitError("Downloaded compiler is not working");
    }
  }

  private async _checkCompilerWork(compilerBinary: string): Promise<boolean> {
    const execFileP = promisify(execFile);

    try {
      await execFileP(compilerBinary, ["--version"]);
      return true;
    } catch {
      return false;
    }
  }
}
