import os from "os";
import path from "path";
import fs from "fs-extra";
import { promisify } from "util";
import { exec } from "child_process";

import { HardhatZKitError } from "../../errors";

import { BinaryCircomCompiler, WASMCircomCompiler } from "./CircomCompiler";
import { CompilerDownloader } from "./CircomCompilerDownloader";

import { ICircomCompiler, IWASMCircomCompiler, NativeCompiler } from "../../types/core";
import { CompilerPlatformBinary } from "../../types/core/compiler/circom-compiler-downloader";

import { isVersionHigherOrEqual } from "../utils/VersionManagement";

// eslint-disable-next-line
const { Context } = require("@distributedlab/circom2");

export class CircomCompilerFactory {
  public static createWASMCircomCompiler(highestVersion: string): IWASMCircomCompiler {
    if (!isVersionHigherOrEqual("2.1.9", highestVersion)) {
      throw new HardhatZKitError(
        `Unsupported Circom compiler version - ${highestVersion}. Please provide another version.`,
      );
    }

    return new WASMCircomCompiler(this._getCircomWasmCompiler("@distributedlab/circom2/circom.wasm"));
  }

  public static async createBinaryCircomCompiler(
    highestVersion: string,
  ): Promise<ICircomCompiler | IWASMCircomCompiler> {
    if (!isVersionHigherOrEqual("2.1.9", highestVersion)) {
      throw new HardhatZKitError(
        `Unsupported Circom compiler version - ${highestVersion}. Please provide another version.`,
      );
    }

    const nativeCompiler = await this._getNativeCompiler();

    if (nativeCompiler && isVersionHigherOrEqual(nativeCompiler.version, highestVersion)) {
      return new BinaryCircomCompiler(nativeCompiler.binaryPath);
    }

    const { compilerPath, isWasm } = await this._getCircomCompiler(highestVersion);

    if (isWasm) {
      return new WASMCircomCompiler(this._getCircomWasmCompiler(compilerPath));
    }

    return new BinaryCircomCompiler(compilerPath);
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
    highestVersion: string,
    isWasm: boolean = false,
  ): Promise<{ compilerPath: string; isWasm: boolean }> {
    const compilersDir = await this._getCompilersDir();

    const compilerPlatformBinary = isWasm
      ? CompilerPlatformBinary.WASM
      : CompilerDownloader.getCompilerPlatformBinary();
    const downloader = CompilerDownloader.getConcurrencySafeDownloader(compilerPlatformBinary, compilersDir);

    if (await downloader.isCompatibleCompilerDownloaded(highestVersion)) {
      const compilerPath = await downloader.getLatestCompilerBinary();
      return { compilerPath, isWasm: this._isCompilerWasm(compilerPlatformBinary) };
    } else {
      try {
        await downloader.downloadLatestCompiler();

        const compilerPath = await downloader.getLatestCompilerBinary();

        return { compilerPath, isWasm: this._isCompilerWasm(compilerPlatformBinary) };
      } catch (error: any) {
        if (this._isCompilerWasm(compilerPlatformBinary)) {
          throw new HardhatZKitError(error);
        }

        return this._getCircomCompiler(highestVersion, true);
      }
    }
  }

  private static _isCompilerWasm(compilerPlatformBinary: string): boolean {
    return compilerPlatformBinary === CompilerPlatformBinary.WASM;
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
