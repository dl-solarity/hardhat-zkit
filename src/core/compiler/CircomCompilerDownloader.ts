import os from "os";
import path from "path";
import fsExtra from "fs-extra";
import semver from "semver";
import { promisify } from "util";
import { execFile } from "child_process";

import {
  COMPILER_AMD_REPOSITORY_URL,
  COMPILER_ARM_REPOSITORY_URL,
  COMPILER_WASM_REPOSITORY_URL,
  LATEST_SUPPORTED_CIRCOM_VERSION,
  WASM_COMPILER_VERSIONING,
} from "../../constants";
import { Reporter } from "../../reporter";
import { HardhatZKitError } from "../../errors";

import { CompilerInfo, CompilerPlatformBinary } from "../../types/core";

import { downloadFile } from "../../utils/utils";
import { getHighestVersion } from "./versioning";

import { MultiProcessMutex } from "hardhat/internal/util/multi-process-mutex";

/**
 * Handles the downloading of Circom compilers for various platforms.
 *
 * The `CircomCompilerDownloader` class manages the retrieval of the appropriate Circom compiler
 * binaries based on the operating system and architecture. It provides methods to check if a
 * specific version of the compiler has already been downloaded, as well as to download it if
 * necessary. This class also supports version management, allowing for both strict and
 * flexible version downloads.
 *
 * The class employs a mutex to prevent concurrent downloads of the same compiler version,
 * ensuring thread safety during the downloading process. Additionally, it offers functionality
 * to verify downloaded compilers, providing assurance that the binary is valid and functional.
 *
 * Key functionalities include:
 * - Determining the appropriate compiler binary for the current platform
 * - Downloading the specified version of the Circom compiler
 * - Checking if a particular compiler version is already available locally
 * - Retrieving the compiler binary path for a given version
 *
 * This class is essential for automating the setup of the Circom compilation environment,
 * enabling seamless integration within development workflows.
 */
export class CircomCompilerDownloader {
  private static _downloaderPerPlatform: Map<string, CircomCompilerDownloader> = new Map();

  private readonly _mutex = new MultiProcessMutex("compiler-download");

  /**
   * Determines the appropriate compiler binary based on the operating system and architecture.
   *
   * This method checks the current architecture and platform to return the corresponding
   * {@link CompilerPlatformBinary} value. If the architecture is neither "x64" nor "arm64",
   * the function defaults to using the WebAssembly (WASM) binary.
   *
   * @param arch The architecture to check, defaults to the system's architecture
   * @returns The corresponding {@link CompilerPlatformBinary} for the system
   */
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

  /**
   * Retrieves or creates a {@link CircomCompilerDownloader} instance
   * for the specified platform and compilers directory.
   *
   * This method checks if a downloader for the given platform and directory already exists in the cache.
   * If not, it creates a new instance and stores it for future use. This helps to manage multiple
   * downloaders efficiently and ensures that only one instance is created per platform-directory pair.
   *
   * @param platform The platform for which the compiler downloader is needed
   * @param compilersDir The directory where the compilers are stored
   * @returns The {@link CircomCompilerDownloader} instance for the specified platform and directory
   */
  public static getCircomCompilerDownloader(
    platform: CompilerPlatformBinary,
    compilersDir: string,
  ): CircomCompilerDownloader {
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

  /**
   * Checks if the specified compiler version is downloaded.
   *
   * The method verifies the existence of the compiler files based on the provided version and
   * whether strict version matching is required. If `isVersionStrict` is true, it checks for the
   * exact version in both standard and WASM download paths. If false, it compares the latest
   * downloaded version with the requested version using semantic versioning to determine if it
   * meets or exceeds the requested version.
   *
   * @param version The version of the compiler to check for
   * @param isVersionStrict Indicates whether to enforce strict version matching
   * @returns true if the compiler is downloaded, false otherwise
   */
  public async isCompilerDownloaded(version: string, isVersionStrict: boolean): Promise<boolean> {
    if (isVersionStrict) {
      const downloadPath = this._getCompilerDownloadPath(version);
      const downloadPathWasm = this._getWasmCompilerDownloadPath(version);

      return (await fsExtra.pathExists(downloadPath)) || fsExtra.pathExists(downloadPathWasm);
    }

    const latestDownloadedVersion = this._getLatestDownloadedCircomVersion();

    return semver.gte(latestDownloadedVersion, version);
  }

  /**
   * Retrieves the binary path of the specified Circom compiler version.
   *
   * The method checks for the availability of the compiler binary based on the provided version
   * and whether strict version matching is enforced. If strict matching is not required, it
   * defaults to the latest downloaded version. The function then checks for the existence of
   * both standard and WASM compiler binaries. If found, it returns the binary path along with
   * the version and a flag indicating whether it is a WASM binary. If neither binary is found,
   * it throws an error indicating that the compiler needs to be downloaded.
   *
   * @param version The version of the compiler to retrieve
   * @param isVersionStrict Indicates whether to enforce strict version matching
   * @returns An object containing the binary path, version, and a boolean indicating if it is a WASM binary
   * @throws `HardhatZKitError` If the specified compiler version is not downloaded
   */
  public async getCompilerBinary(version: string, isVersionStrict: boolean): Promise<CompilerInfo> {
    if (!isVersionStrict) {
      version = this._getLatestDownloadedCircomVersion();

      if (!version || version === "0.0.0") {
        throw new HardhatZKitError("No latest compiler found");
      }
    }

    const compilerBinaryPath = this._getCompilerDownloadPath(version);
    const wasmCompilerBinaryPath = this._getWasmCompilerDownloadPath(version);

    if (await fsExtra.pathExists(wasmCompilerBinaryPath)) {
      return { binaryPath: wasmCompilerBinaryPath, version: version, isWasm: true };
    }

    if (await fsExtra.pathExists(compilerBinaryPath)) {
      return { binaryPath: compilerBinaryPath, version: version, isWasm: false };
    }

    throw new HardhatZKitError(`Trying to get a Circom compiler v${version} before it was downloaded`);
  }

  /**
   * Downloads the specified version of the Circom compiler if it is not already downloaded.
   *
   * This method utilizes a mutex to ensure that concurrent calls do not lead to multiple
   * downloads of the same compiler version. It determines the version to download based on
   * whether strict version matching is enforced. If the compiler is already downloaded, the
   * function exits early. If not, it initiates the download process and reports the
   * downloading information. After downloading, it optionally verifies the downloaded compiler.
   *
   * @param version The version of the compiler to download
   * @param isVersionStrict Indicates whether to enforce strict version matching
   * @param verifyCompiler Indicates whether to perform verification on the downloaded compiler
   *
   * @throws `HardhatZKitError` If an error occurs during the download, verification process
   * or getting WASM download URL for the specific version
   */
  public async downloadCompiler(version: string, isVersionStrict: boolean, verifyCompiler: boolean): Promise<void> {
    await this._mutex.use(async () => {
      const versionToDownload = isVersionStrict ? version : LATEST_SUPPORTED_CIRCOM_VERSION;

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

      if (verifyCompiler) {
        await this._postProcessCompilerDownload(downloadPath);
      }
    });
  }

  private _getLatestDownloadedCircomVersion(): string {
    try {
      const entries = fsExtra.readdirSync(this._compilersDir, { withFileTypes: true });

      const versions = entries
        .filter((entry) => {
          if (!entry.isDirectory()) {
            return false;
          }

          const dirPath = path.join(this._compilersDir, entry.name);
          const files = fsExtra.readdirSync(dirPath);

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
        url = this._getWasmDownloadURL(version);
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

  private _getWasmDownloadURL(version: string): string {
    const wasmVersion = WASM_COMPILER_VERSIONING[version];
    if (!wasmVersion) {
      throw new HardhatZKitError(`Unsupported WASM version - ${version}`);
    }

    return `${COMPILER_WASM_REPOSITORY_URL}/v${wasmVersion}/circom.wasm`;
  }

  private async _postProcessCompilerDownload(downloadPath: string): Promise<void> {
    if (
      this._platform !== CompilerPlatformBinary.WINDOWS_AMD &&
      this._platform !== CompilerPlatformBinary.WINDOWS_ARM &&
      this._platform !== CompilerPlatformBinary.WASM
    ) {
      await fsExtra.chmod(downloadPath, 0o755);
    }

    if (this._platform !== CompilerPlatformBinary.WASM && !(await this._checkCompilerWork(downloadPath))) {
      await fsExtra.unlink(downloadPath);

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
