import os from "os";
import path from "path";
import fs from "fs-extra";
import { promisify } from "util";
import { exec } from "child_process";

import { Reporter } from "../../reporter";
import { HardhatZKitError } from "../../errors";
import { LATEST_SUPPORTED_CIRCOM_VERSION, OLDEST_SUPPORTED_ARM_CIRCOM_VERSION } from "../../constants";

import { BinaryCircomCompiler, WASMCircomCompiler } from "./CircomCompiler";
import { CompilerDownloader } from "./CircomCompilerDownloader";

import { isVersionHigherOrEqual } from "../utils/versioning";

import { ICircomCompiler, NativeCompiler, CompilerPlatformBinary } from "../../types/core";

// eslint-disable-next-line
const { Context } = require("@distributedlab/circom2");

export class CircomCompilerFactory {
  public static async createBinaryCircomCompiler(
    configVersion: string | undefined,
    highestVersion: string,
  ): Promise<ICircomCompiler> {
    if (!isVersionHigherOrEqual(LATEST_SUPPORTED_CIRCOM_VERSION, highestVersion)) {
      throw new HardhatZKitError(
        `Unsupported Circom compiler version - ${highestVersion} specified inside a circuit. Please provide another version.`,
      );
    }

    if (configVersion && !isVersionHigherOrEqual(LATEST_SUPPORTED_CIRCOM_VERSION, configVersion)) {
      throw new HardhatZKitError(
        `Unsupported Circom compiler version - ${configVersion} specified in config. Please provide another version.`,
      );
    }

    if (
      configVersion &&
      os.arch() === "arm64" &&
      !isVersionHigherOrEqual(configVersion, OLDEST_SUPPORTED_ARM_CIRCOM_VERSION)
    ) {
      throw new HardhatZKitError(
        `Circom compiler v${highestVersion} is not supported for ARM. Please provide a version not prior to ${OLDEST_SUPPORTED_ARM_CIRCOM_VERSION}.`,
      );
    }

    const nativeCompiler = await this._getNativeCompiler();

    if (nativeCompiler) {
      const isValidVersion = configVersion
        ? nativeCompiler.version === configVersion
        : isVersionHigherOrEqual(nativeCompiler.version, highestVersion);

      if (isValidVersion) {
        Reporter!.reportCompilerVersion(nativeCompiler.version);

        return new BinaryCircomCompiler(nativeCompiler.binaryPath);
      }
    }

    try {
      const compilerPath = await this._getCircomCompiler(configVersion, highestVersion);

      if (compilerPath.isWasm) {
        return new WASMCircomCompiler(this._getCircomWasmCompiler(compilerPath.binaryPath));
      }

      return new BinaryCircomCompiler(compilerPath.binaryPath);
    } catch (error: any) {
      const wasmCompilerPath = await this._getCircomCompiler(configVersion, highestVersion, true);

      return new WASMCircomCompiler(this._getCircomWasmCompiler(wasmCompilerPath.binaryPath));
    }
  }

  private static async _getNativeCompiler(): Promise<NativeCompiler | undefined> {
    const execP = promisify(exec);

    try {
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
    } catch (error) {
      return undefined;
    }
  }

  private static async _getCircomCompiler(
    configVersion: string | undefined,
    highestVersion: string,
    isWasm: boolean = false,
  ): Promise<{ binaryPath: string; isWasm: boolean }> {
    const compilersDir = await this._getCompilersDir();

    const compilerPlatformBinary = isWasm
      ? CompilerPlatformBinary.WASM
      : CompilerDownloader.getCompilerPlatformBinary();
    const downloader = new CompilerDownloader(compilerPlatformBinary, compilersDir);

    const isCompilerDownloaded = configVersion
      ? downloader.isCompilerDownloaded(configVersion)
      : await downloader.isCompatibleCompilerDownloaded(highestVersion);

    if (isCompilerDownloaded) {
      Reporter!.reportCompilerVersion(configVersion || (await downloader.getLatestDownloadedCircomVersion()));

      const compilerBinaryPath = configVersion
        ? await downloader.getCompilerBinary(configVersion)
        : await downloader.getLatestCompilerBinary();

      return { binaryPath: compilerBinaryPath.binaryPath, isWasm: compilerBinaryPath.isWasm };
    }

    await downloader.downloadCompiler(configVersion);

    Reporter!.reportCompilerVersion(configVersion || (await downloader.getLatestDownloadedCircomVersion()));

    const compilerBinaryPath = configVersion
      ? await downloader.getCompilerBinary(configVersion)
      : await downloader.getLatestCompilerBinary();

    return { binaryPath: compilerBinaryPath.binaryPath, isWasm: compilerBinaryPath.isWasm };
  }

  private static _getCircomWasmCompiler(compilerPath: string): typeof Context {
    return fs.readFileSync(require.resolve(compilerPath));
  }

  private static async _getCompilersDir(): Promise<string> {
    const compilersDir = path.join(os.homedir(), ".zkit", "compilers");

    await fs.ensureDir(compilersDir);

    return compilersDir;
  }
}
