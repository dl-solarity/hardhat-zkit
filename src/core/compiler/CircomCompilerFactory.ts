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

export class CircomCompilerFactory {
  private static instance: CircomCompilerFactory;

  private constructor() {}

  public static getInstance(): CircomCompilerFactory {
    if (!CircomCompilerFactory.instance) {
      CircomCompilerFactory.instance = new CircomCompilerFactory();
    }

    return CircomCompilerFactory.instance;
  }

  public async createBinaryCircomCompiler(version: string, isVersionStrict: boolean): Promise<ICircomCompiler> {
    if (!isVersionHigherOrEqual(LATEST_SUPPORTED_CIRCOM_VERSION, version)) {
      throw new HardhatZKitError(`Unsupported Circom compiler version - ${version}. Please provide another version.`);
    }

    try {
      const nativeCompiler = await this._getNativeCompiler();

      const isValidVersion = isVersionStrict
        ? nativeCompiler.version === version
        : isVersionHigherOrEqual(nativeCompiler.version, version);

      if (isValidVersion) {
        Reporter!.reportCompilerVersion(nativeCompiler.version);

        return new BinaryCircomCompiler(nativeCompiler.binaryPath);
      }
    } catch (error: any) {
      Reporter!.verboseLog("compiler-creation", `No native compiler compatible with version ${version} found`);
    }

    let compilerPlatformBinary: CompilerPlatformBinary;
    if (
      isVersionStrict &&
      os.arch() === "arm64" &&
      !isVersionHigherOrEqual(version, OLDEST_SUPPORTED_ARM_CIRCOM_VERSION)
    ) {
      compilerPlatformBinary = CircomCompilerDownloader.getCompilerPlatformBinary("x64");
    } else {
      compilerPlatformBinary = CircomCompilerDownloader.getCompilerPlatformBinary();
    }

    let compilerInfo: CompilerInfo;
    try {
      compilerInfo = await this._getCircomCompilerInfo(compilerPlatformBinary, version, isVersionStrict);
    } catch (error: any) {
      if (compilerPlatformBinary !== CompilerPlatformBinary.WASM) {
        compilerInfo = await this._getCircomCompilerInfo(CompilerPlatformBinary.WASM, version, isVersionStrict);
      } else {
        throw new HardhatZKitError(error);
      }
    }

    if (compilerInfo.isWasm) {
      return new WASMCircomCompiler(this._getCircomWasmCompiler(compilerInfo.binaryPath));
    }

    return new BinaryCircomCompiler(compilerInfo.binaryPath);
  }

  private async _getNativeCompiler(): Promise<NativeCompiler> {
    const execP = promisify(exec);

    const { stdout: circomLocation } = await execP("whereis circom");

    const trimmedBinaryPath = circomLocation.trim().split(" ");

    if (trimmedBinaryPath.length !== 2) {
      throw new HardhatZKitError("Unable to find native Circom compiler");
    }

    const nativeCircomBinaryPath = trimmedBinaryPath[1];

    const { stdout: versionOutput } = await execP(`circom --version`);

    const versionParts = versionOutput.trim().split(" ");
    const version = versionParts[versionParts.length - 1];

    return {
      binaryPath: nativeCircomBinaryPath,
      version,
    };
  }

  private async _getCircomCompilerInfo(
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

  private _getCircomWasmCompiler(compilerPath: string): typeof Context {
    return fs.readFileSync(require.resolve(compilerPath));
  }

  private async _getCompilersDir(): Promise<string> {
    const compilersDir = path.join(os.homedir(), ".zkit", "compilers");

    await fs.ensureDir(compilersDir);

    return compilersDir;
  }
}
