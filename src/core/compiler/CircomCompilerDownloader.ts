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

import { CompilerInfo, CompilerPlatformBinary } from "../../types/core";

import { downloadFile } from "../../utils/utils";
import { getHighestVersion, isVersionHigherOrEqual } from "./versioning";

import { MultiProcessMutex } from "hardhat/internal/util/multi-process-mutex";

export class CircomCompilerDownloader {
  private static _downloaderPerPlatform: Map<string, CircomCompilerDownloader> = new Map();

  private readonly _mutex = new MultiProcessMutex("compiler-download");

  public static getCompilerPlatformBinary(arch = os.arch()): CompilerPlatformBinary {
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

  public static getCircomCompilerDownloader(platform: CompilerPlatformBinary, compilersDir: string) {
    const key = platform + compilersDir;

    if (!this._downloaderPerPlatform.has(key)) {
      this._downloaderPerPlatform.set(key, new CircomCompilerDownloader(platform, compilersDir));
    }

    return this._downloaderPerPlatform.get(key)!;
  }

  private constructor(
    private readonly _platform: CompilerPlatformBinary,
    private readonly _compilersDir: string,
  ) {}

  public async isCompilerDownloaded(version: string, isVersionStrict: boolean): Promise<boolean> {
    if (isVersionStrict) {
      const downloadPath = this._getCompilerDownloadPath(version);
      const downloadPathWasm = this._getWasmCompilerDownloadPath(version);

      return (await fs.pathExists(downloadPath)) || fs.pathExists(downloadPathWasm);
    }

    const latestDownloadedVersion = await this._getLatestDownloadedCircomVersion();

    return isVersionHigherOrEqual(latestDownloadedVersion, version);
  }

  public async getCompilerBinary(version: string, isVersionStrict: boolean): Promise<CompilerInfo> {
    if (!isVersionStrict) {
      version = await this._getLatestDownloadedCircomVersion();

      if (!version || version === "0.0.0") {
        throw new HardhatZKitError("No latest compiler found");
      }
    }

    const compilerBinaryPath = this._getCompilerDownloadPath(version);
    const wasmCompilerBinaryPath = this._getWasmCompilerDownloadPath(version);

    if (await fs.pathExists(wasmCompilerBinaryPath)) {
      return { binaryPath: wasmCompilerBinaryPath, version: version, isWasm: true };
    }

    if (await fs.pathExists(compilerBinaryPath)) {
      return { binaryPath: compilerBinaryPath, version: version, isWasm: false };
    }

    throw new HardhatZKitError(`Trying to get a Circom compiler v${version} before it was downloaded`);
  }

  public async downloadCompiler(version: string, isVersionStrict: boolean): Promise<void> {
    await this._mutex.use(async () => {
      const versionToDownload = isVersionStrict ? version : await this._getLatestCircomVersion();

      if (await this.isCompilerDownloaded(versionToDownload, isVersionStrict)) {
        return;
      }

      Reporter!.reportCircomCompilerDownloadingInfo(versionToDownload, this._platform === CompilerPlatformBinary.WASM);

      let downloadPath: string;

      try {
        downloadPath = await this._downloadCompiler(versionToDownload);
      } catch (error: any) {
        throw new HardhatZKitError(error.message);
      }

      await this._postProcessCompilerDownload(downloadPath);
    });
  }

  private async _getLatestDownloadedCircomVersion(): Promise<string> {
    try {
      const entries = await fs.promises.readdir(this._compilersDir, { withFileTypes: true });

      const versions = entries
        .filter(async (entry) => {
          if (!entry.isDirectory()) {
            return false;
          }

          const dirPath = path.join(this._compilersDir, entry.name);
          const files = await fs.promises.readdir(dirPath);

          return files.includes(this._platform) || files.includes("circom.wasm");
        })
        .map((entry) => entry.name);

      if (versions.length === 0) {
        return "0.0.0";
      }

      return getHighestVersion(versions);
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
    const downloadPath = this._getCompilerDownloadPath(version);

    let url: string;

    switch (this._platform) {
      case CompilerPlatformBinary.LINUX_AMD:
      case CompilerPlatformBinary.WINDOWS_AMD:
      case CompilerPlatformBinary.MACOS_AMD:
        url = `${COMPILER_AMD_REPOSITORY_URL}/v${version}/${this._platform}`;
        break;
      case CompilerPlatformBinary.LINUX_ARM:
      case CompilerPlatformBinary.WINDOWS_ARM:
      case CompilerPlatformBinary.MACOS_ARM:
        url = `${COMPILER_ARM_REPOSITORY_URL}/v${version}/${this._platform}`;
        break;
      default:
        url = `${COMPILER_WASM_REPOSITORY_URL}/v${WASM_COMPILER_VERSIONING[version]}/circom.wasm`;
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
      await fs.chmod(downloadPath, 0o755);
    }

    if (this._platform !== CompilerPlatformBinary.WASM && !(await this._checkCompilerWork(downloadPath))) {
      await fs.unlink(downloadPath);

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
