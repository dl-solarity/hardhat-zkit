import path from "path";
import fs from "fs-extra";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import { CompilerPlatformBinary, ICompilerDownloader } from "../../types/core/compiler/circom-compiler-downloader";
import { MultiProcessMutex } from "hardhat/internal/util/multi-process-mutex";
import { HardhatZKitError } from "../../errors";
import { getHighestCircomVersion, isVersionHigherOrEqual } from "../utils/VersionManagement";
import https from "https";
import { downloadFile } from "../../utils/utils";
import {
  COMPILER_AMD_REPOSITORY_URL,
  COMPILER_ARM_REPOSITORY_URL,
  COMPILER_WASM_REPOSITORY_URL,
  WasmCompilerVersioning,
} from "../../constants";
import { Reporter } from "../../reporter";

export class CompilerDownloader implements ICompilerDownloader {
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

  private static _downloaderPerPlatform: Map<string, CompilerDownloader> = new Map();

  public static getConcurrencySafeDownloader(platform: CompilerPlatformBinary, compilersDir: string) {
    const key = platform + compilersDir;

    if (!this._downloaderPerPlatform.has(key)) {
      this._downloaderPerPlatform.set(key, new CompilerDownloader(platform, compilersDir));
    }

    return this._downloaderPerPlatform.get(key)!;
  }

  private readonly _mutex = new MultiProcessMutex("compiler-download");

  /**
   * Use CompilerDownloader.getConcurrencySafeDownloader instead
   */
  constructor(
    private readonly _platform: CompilerPlatformBinary,
    private readonly _compilersDir: string,
  ) {}

  public async isCompatibleCompilerDownloaded(highestVersion: string): Promise<boolean> {
    return (
      isVersionHigherOrEqual(await this._getLatestDownloadedCircomVersion(), highestVersion) &&
      fs.existsSync(this._getCompilerDownloadPath(highestVersion))
    );
  }

  public async getLatestCompilerBinary(): Promise<string> {
    const latestDownloadedCompilerVersion = await this._getLatestDownloadedCircomVersion();
    if (!latestDownloadedCompilerVersion || latestDownloadedCompilerVersion === "0.0.0") {
      throw new HardhatZKitError("No latest compiler found");
    }

    return this._getCompilerDownloadPath(latestDownloadedCompilerVersion);
  }

  public async downloadLatestCompiler(): Promise<void> {
    await this._mutex.use(async () => {
      const latestAvailableVersion = await this._getLatestCircomVersion();

      if (await this.isCompatibleCompilerDownloaded(latestAvailableVersion)) {
        return;
      }

      Reporter!.reportCircomCompilerDownloadingInfo(
        latestAvailableVersion,
        this._platform === CompilerPlatformBinary.WASM,
      );

      let downloadPath: string;

      try {
        downloadPath = await this._downloadCompiler(latestAvailableVersion);
      } catch (error: any) {
        throw new HardhatZKitError(error);
      }

      await this._postProcessCompilerDownload(downloadPath);
    });
  }

  private async _getLatestCircomVersion(): Promise<string> {
    return new Promise((resolve) => {
      https
        .get("https://github.com/iden3/circom/releases/latest/", (res) => {
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

  private async _getLatestDownloadedCircomVersion(): Promise<string> {
    try {
      const entries = await fs.promises.readdir(this._compilersDir, { withFileTypes: true });

      const versions = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

      if (versions.length === 0) {
        return "0.0.0";
      }

      return getHighestCircomVersion(versions);
    } catch (error) {
      throw new HardhatZKitError(`Error reading directory: ${error}`);
    }
  }

  private async _downloadCompiler(version: string): Promise<string> {
    const amdUrl = `${COMPILER_AMD_REPOSITORY_URL}/v${version}/${this._platform}`;
    const armUrl = `${COMPILER_ARM_REPOSITORY_URL}/v${version}/${this._platform}`;
    const wasmUrl = `${COMPILER_WASM_REPOSITORY_URL}/v${WasmCompilerVersioning[version]}/circom.wasm`;

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
