import os from "os";
import path from "path";
import fsExtra from "fs-extra";
import semver from "semver";
import { promisify } from "util";
import { exec } from "child_process";

import { Reporter } from "../../reporter";
import { HardhatZKitError } from "../../errors";
import { LATEST_SUPPORTED_CIRCOM_VERSION, OLDEST_SUPPORTED_CIRCOM_VERSION } from "../../constants";

import { BinaryCircomCompiler, WASMCircomCompiler } from "./CircomCompiler";
import { CircomCompilerDownloader } from "./CircomCompilerDownloader";

import { CompilerInfo, CompilerPlatformBinary, ICircomCompiler, NativeCompiler } from "../../types/core";

// eslint-disable-next-line
const { Context } = require("@distributedlab/circom2");

/**
 * Abstract factory class responsible for creating instances of Circom compilers.
 *
 * This class provides a method to instantiate different types of Circom compilers
 * based on the specified version and platform. It includes logic to handle versioning,
 * ensure compatibility with supported architectures, and determine the appropriate
 * compiler to use (native, binary, or WASM) for the compilation process.
 *
 * The factory also includes error handling for unsupported versions and facilitates
 * the use of binary translators on ARM architectures when necessary. This allows
 * developers to seamlessly work with various Circom compiler versions while
 * managing dependencies and ensuring optimal performance during circuit compilation.
 */
export class BaseCircomCompilerFactory {
  /**
   * Creates an instance of a Circom compiler based on the specified version and architecture.
   *
   * This method first checks if the requested Circom compiler version is supported. If the version
   * exceeds the latest supported version, an error is thrown. The method attempts to create a native
   * compiler first; if successful, the instance is returned immediately.
   *
   * If the native compiler cannot be created, the method determines the appropriate compiler binary
   * for the current platform. If the requested version is strictly enforced and the system architecture
   * is arm64, but the version is older than the supported arm64 version, it falls back to using the
   * x64 binary.
   *
   * The method then attempts to create a binary compiler if the platform binary is not WASM. If this
   * also fails, it defaults to creating a WASM compiler instance. This provides flexibility in compiler
   * selection, accommodating various system architectures and version requirements.
   *
   * @param version The version of the Circom compiler to create
   * @param isVersionStrict Indicates whether strict version matching is required
   * @param verifyCompiler Optional flag indicating if the downloaded compiler should be verified
   * @returns An instance of `ICircomCompiler` for the specified version
   *
   * @throws `HardhatZKitError` error if the specified compiler version is unsupported
   */
  public async createCircomCompiler(
    version: string,
    isVersionStrict: boolean,
    verifyCompiler: boolean = true,
  ): Promise<ICircomCompiler> {
    const supportedVersionsRange = semver.validRange(
      `${OLDEST_SUPPORTED_CIRCOM_VERSION} - ${LATEST_SUPPORTED_CIRCOM_VERSION}`,
    );

    if (isVersionStrict && !semver.satisfies(version, supportedVersionsRange!)) {
      throw new HardhatZKitError(
        `Unsupported Circom compiler version - ${version}. Please provide another version from the range ${supportedVersionsRange}.`,
      );
    }

    let compiler = await this._tryCreateNativeCompiler(version, isVersionStrict);

    if (compiler) {
      return compiler;
    }

    const compilerPlatformBinary = CircomCompilerDownloader.getCompilerPlatformBinary();

    if (compilerPlatformBinary !== CompilerPlatformBinary.WASM) {
      compiler = await this._tryCreateBinaryCompiler(compilerPlatformBinary, version, isVersionStrict, verifyCompiler);

      if (compiler) {
        return compiler;
      }
    }

    return this._createWasmCompiler(version, isVersionStrict, verifyCompiler);
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
      : semver.gte(nativeCompiler.version, version);

    if (isValidVersion) {
      Reporter!.reportCompilerVersion(nativeCompiler.version);

      return new BinaryCircomCompiler(nativeCompiler.binaryPath);
    }
  }

  private async _tryCreateBinaryCompiler(
    platform: CompilerPlatformBinary,
    version: string,
    isVersionStrict: boolean,
    verifyCompiler: boolean,
  ): Promise<ICircomCompiler | undefined> {
    try {
      const compilerInfo = await this._getBinaryCompiler(platform, version, isVersionStrict, verifyCompiler);

      if (compilerInfo.isWasm) {
        return new WASMCircomCompiler(this._getWasmCompiler(compilerInfo.binaryPath));
      }

      return new BinaryCircomCompiler(compilerInfo.binaryPath);
    } catch (error: any) {
      return undefined;
    }
  }

  private async _createWasmCompiler(
    version: string,
    isVersionStrict: boolean,
    verifyCompiler: boolean,
  ): Promise<ICircomCompiler> {
    const compilerInfo = await this._getBinaryCompiler(
      CompilerPlatformBinary.WASM,
      version,
      isVersionStrict,
      verifyCompiler,
    );

    return new WASMCircomCompiler(this._getWasmCompiler(compilerInfo.binaryPath));
  }

  private async _getNativeCompiler(): Promise<NativeCompiler | undefined> {
    try {
      const execP = promisify(exec);

      // Attempts to locate a globally installed Circom compiler using the `whereis` utility
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
    verifyCompiler: boolean,
  ): Promise<CompilerInfo> {
    const compilersDir = await this._getCompilersDir();
    const downloader = CircomCompilerDownloader.getCircomCompilerDownloader(platform, compilersDir);

    if (!(await downloader.isCompilerDownloaded(version, isVersionStrict))) {
      await downloader.downloadCompiler(version, isVersionStrict, verifyCompiler);
    }

    const compilerBinaryInfo = await downloader.getCompilerBinary(version, isVersionStrict);

    Reporter!.reportCompilerVersion(compilerBinaryInfo.version);

    return compilerBinaryInfo;
  }

  private _getWasmCompiler(compilerPath: string): typeof Context {
    return fsExtra.readFileSync(require.resolve(compilerPath));
  }

  private async _getCompilersDir(): Promise<string> {
    const compilersDir = path.join(os.homedir(), ".zkit", "compilers");

    await fsExtra.ensureDir(compilersDir);

    return compilersDir;
  }
}

/**
 * Singleton instance of the {@link BaseCircomCompilerFactory}.
 *
 * This variable holds a reference to a single instance of the
 * {@link BaseCircomCompilerFactory}. It is initialized when the
 * {@link createCircomCompilerFactory} function is called for the first time.
 * Subsequent calls to this function will not create a new instance,
 * ensuring that there is only one factory managing the creation of
 * Circom compilers throughout the application.
 *
 * This design pattern promotes efficient resource usage and helps
 * maintain consistent state when dealing with compiler instances.
 */
export let CircomCompilerFactory: BaseCircomCompilerFactory | null = null;

/**
 * Creates and initializes the {@link CircomCompilerFactory} singleton.
 *
 * If the {@link CircomCompilerFactory} instance already exists, the function
 * does nothing. Otherwise, it creates a new instance of
 * {@link BaseCircomCompilerFactory}, allowing for the management of
 * Circom compiler instances throughout the application lifecycle.
 */
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
