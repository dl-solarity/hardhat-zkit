import os from "os";
import path from "path";
import fs from "fs-extra";
import { promisify } from "util";
import { exec } from "child_process";

import { Reporter } from "../../reporter";
import { HardhatZKitError } from "../../errors";
import { LATEST_SUPPORTED_CIRCOM_VERSION, OLDEST_SUPPORTED_ARM_CIRCOM_VERSION } from "../../constants";

import { BinaryCircomCompiler, WASMCircomCompiler } from "./CircomCompiler";
import { CircomCompilerDownloader } from "./CircomCompilerDownloader";

import { isVersionHigherOrEqual } from "./versioning";

import { CompilerInfo, CompilerPlatformBinary, ICircomCompiler, NativeCompiler } from "../../types/core";

// eslint-disable-next-line
const { Context } = require("@distributedlab/circom2");

export class BaseCircomCompilerFactory {
  public async createCircomCompiler(version: string, isVersionStrict: boolean): Promise<ICircomCompiler> {
    if (!isVersionHigherOrEqual(LATEST_SUPPORTED_CIRCOM_VERSION, version)) {
      throw new HardhatZKitError(`Unsupported Circom compiler version - ${version}. Please provide another version.`);
    }

    let compiler = await this._tryCreateNativeCompiler(version, isVersionStrict);

    if (compiler) {
      return compiler;
    }

    let compilerPlatformBinary = CircomCompilerDownloader.getCompilerPlatformBinary();

    // Utilize binary translators like Rosetta (macOS) or Prism (Windows)
    // to run x64 binaries on arm64 systems when no arm64 versions are available.
    if (
      isVersionStrict &&
      os.arch() === "arm64" &&
      !isVersionHigherOrEqual(version, OLDEST_SUPPORTED_ARM_CIRCOM_VERSION)
    ) {
      compilerPlatformBinary = CircomCompilerDownloader.getCompilerPlatformBinary("x64");
    }

    if (compilerPlatformBinary !== CompilerPlatformBinary.WASM) {
      compiler = await this._tryCreateBinaryCompiler(compilerPlatformBinary, version, isVersionStrict);

      if (compiler) {
        return compiler;
      }
    }

    return this._createWasmCompiler(version, isVersionStrict);
  }

  private async _tryCreateNativeCompiler(
    version: string,
    isVersionStrict: boolean,
  ): Promise<ICircomCompiler | undefined> {
    const nativeCompiler = await this._getNativeCompiler();

    if (!nativeCompiler) {
      return undefined;
    }

    const isValidVersion = isVersionStrict
      ? nativeCompiler.version === version
      : isVersionHigherOrEqual(nativeCompiler.version, version);

    if (isValidVersion) {
      Reporter!.reportCompilerVersion(nativeCompiler.version);

      return new BinaryCircomCompiler(nativeCompiler.binaryPath);
    }
  }

  private async _tryCreateBinaryCompiler(
    platform: CompilerPlatformBinary,
    version: string,
    isVersionStrict: boolean,
  ): Promise<ICircomCompiler | undefined> {
    try {
      const compilerInfo = await this._getBinaryCompiler(platform, version, isVersionStrict);

      if (compilerInfo.isWasm) {
        return new WASMCircomCompiler(this._getWasmCompiler(compilerInfo.binaryPath));
      }

      return new BinaryCircomCompiler(compilerInfo.binaryPath);
    } catch (error: any) {
      return undefined;
    }
  }

  private async _createWasmCompiler(version: string, isVersionStrict: boolean): Promise<ICircomCompiler> {
    const compilerInfo = await this._getBinaryCompiler(CompilerPlatformBinary.WASM, version, isVersionStrict);

    return new WASMCircomCompiler(this._getWasmCompiler(compilerInfo.binaryPath));
  }

  private async _getNativeCompiler(): Promise<NativeCompiler | undefined> {
    try {
      const execP = promisify(exec);

      const { stdout: circomLocation } = await execP("whereis circom");

      const trimmedBinaryPath = circomLocation.trim().split(" ");

      if (trimmedBinaryPath.length !== 2) {
        return undefined;
      }

      const nativeCircomBinaryPath = trimmedBinaryPath[1];

      const { stdout: versionOutput } = await execP(`circom --version`);

      const versionParts = versionOutput.trim().split(" ");
      const version = versionParts[versionParts.length - 1];

      return {
        binaryPath: nativeCircomBinaryPath,
        version,
      };
    } catch (error: any) {
      return undefined;
    }
  }

  private async _getBinaryCompiler(
    platform: CompilerPlatformBinary,
    version: string,
    isVersionStrict: boolean,
  ): Promise<CompilerInfo> {
    const compilersDir = await this._getCompilersDir();
    const downloader = CircomCompilerDownloader.getCircomCompilerDownloader(platform, compilersDir);

    if (!(await downloader.isCompilerDownloaded(version, isVersionStrict))) {
      await downloader.downloadCompiler(version, isVersionStrict);
    }

    const compilerBinaryInfo = await downloader.getCompilerBinary(version, isVersionStrict);

    Reporter!.reportCompilerVersion(compilerBinaryInfo.version);

    return compilerBinaryInfo;
  }

  private _getWasmCompiler(compilerPath: string): typeof Context {
    return fs.readFileSync(require.resolve(compilerPath));
  }

  private async _getCompilersDir(): Promise<string> {
    const compilersDir = path.join(os.homedir(), ".zkit", "compilers");

    await fs.ensureDir(compilersDir);

    return compilersDir;
  }
}

export let CircomCompilerFactory: BaseCircomCompilerFactory | null = null;

export function createCircomCompilerFactory() {
  if (CircomCompilerFactory) {
    return;
  }

  CircomCompilerFactory = new BaseCircomCompilerFactory();
}

/**
 * Used only in test environments to ensure test atomicity
 */
export function resetCircomCompilerFactory() {
  CircomCompilerFactory = null;
}
