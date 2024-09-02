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

import { CompilerPath, CompilerPlatformBinary, ICircomCompiler, NativeCompiler } from "../../types/core";

// eslint-disable-next-line
const { Context } = require("@distributedlab/circom2");

export class CircomCompilerFactory {
  public static async createBinaryCircomCompiler(version: string, isVersionStrict: boolean): Promise<ICircomCompiler> {
    if (!isVersionHigherOrEqual(LATEST_SUPPORTED_CIRCOM_VERSION, version)) {
      throw new HardhatZKitError(`Unsupported Circom compiler version - ${version}. Please provide another version.`);
    }

    if (
      isVersionStrict &&
      os.arch() === "arm64" &&
      !isVersionHigherOrEqual(version, OLDEST_SUPPORTED_ARM_CIRCOM_VERSION)
    ) {
      throw new HardhatZKitError(
        `Circom compiler v${version} is not supported for ARM. Please provide a version not prior to ${OLDEST_SUPPORTED_ARM_CIRCOM_VERSION}.`,
      );
    }

    const nativeCompiler = await this._getNativeCompiler();

    if (nativeCompiler) {
      const isValidVersion = isVersionStrict
        ? nativeCompiler.version === version
        : isVersionHigherOrEqual(nativeCompiler.version, version);

      if (isValidVersion) {
        Reporter!.reportCompilerVersion(nativeCompiler.version);

        return new BinaryCircomCompiler(nativeCompiler.binaryPath);
      }
    }

    try {
      const compilerPlatformBinary = CompilerDownloader.getCompilerPlatformBinary();

      const compilerPath = await this._getCircomCompilerPath(compilerPlatformBinary, version, isVersionStrict);

      if (compilerPath.isWasm) {
        return new WASMCircomCompiler(this._getCircomWasmCompiler(compilerPath.binaryPath));
      }

      return new BinaryCircomCompiler(compilerPath.binaryPath);
    } catch (error: any) {
      const wasmCompilerPath = await this._getCircomCompilerPath(CompilerPlatformBinary.WASM, version, isVersionStrict);

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

  private static async _getCircomCompilerPath(
    platform: CompilerPlatformBinary,
    version: string,
    isVersionStrict: boolean,
  ): Promise<CompilerPath> {
    const compilersDir = await this._getCompilersDir();

    const downloader = CompilerDownloader.getConcurrencySafeDownloader(platform, compilersDir);

    return isVersionStrict
      ? this._getCircomCompilerPathStrict(version, downloader)
      : this._getCompatibleCircomCompilerPath(version, downloader);
  }

  private static async _getCompatibleCircomCompilerPath(
    version: string,
    downloader: CompilerDownloader,
  ): Promise<CompilerPath> {
    if (await downloader.isCompatibleCompilerDownloaded(version)) {
      Reporter!.reportCompilerVersion(await downloader.getLatestDownloadedCircomVersion());

      const compilerBinaryPath = await downloader.getLatestCompilerBinary();

      return { binaryPath: compilerBinaryPath.binaryPath, isWasm: compilerBinaryPath.isWasm };
    }

    await downloader.downloadCompiler(version, false);

    Reporter!.reportCompilerVersion(version);

    const compilerBinaryPath = await downloader.getLatestCompilerBinary();

    return { binaryPath: compilerBinaryPath.binaryPath, isWasm: compilerBinaryPath.isWasm };
  }

  private static async _getCircomCompilerPathStrict(
    version: string,
    downloader: CompilerDownloader,
  ): Promise<CompilerPath> {
    if (downloader.isCompilerDownloaded(version)) {
      Reporter!.reportCompilerVersion(version);

      const compilerBinaryPath = await downloader.getCompilerBinary(version);

      return { binaryPath: compilerBinaryPath.binaryPath, isWasm: compilerBinaryPath.isWasm };
    }

    await downloader.downloadCompiler(version, true);

    Reporter!.reportCompilerVersion(version);

    const compilerBinaryPath = await downloader.getCompilerBinary(version);

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
