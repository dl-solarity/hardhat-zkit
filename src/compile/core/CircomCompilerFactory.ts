import fs from "fs";

import { WASMCircomCompiler, NativeCircomCompiler } from "./CircomCompiler";
import { ICircomCompiler, IWASMCircomCompiler, CompilerVersion } from "../../types/compile";
import { HardhatZKitError } from "../../errors";
import { execCall } from "../../utils/utils";

// eslint-disable-next-line
const { Context } = require("@distributedlab/circom2");

export class CircomCompilerFactory {
  public static createWASMCircomCompiler(version: CompilerVersion): IWASMCircomCompiler {
    switch (version) {
      case "0.2.18":
        return new WASMCircomCompiler(this._getCircomCompiler("@distributedlab/circom2/circom.wasm"));
      default:
        throw new HardhatZKitError(`Unsupported Circom compiler version - ${version}. Please provide another version.`);
    }
  }

  public static async createNativeCircomCompiler(version: CompilerVersion): Promise<ICircomCompiler> {
    switch (version) {
      case "0.2.18":
        return new NativeCircomCompiler();
      default:
        throw new HardhatZKitError(`Unsupported Circom compiler version - ${version}. Please provide another version.`);
    }
  }

  public static async checkNativeCompilerExistence() {
    try {
      await execCall("circom", ["--version"]);
    } catch (e) {
      throw new HardhatZKitError(
        "Native Circom compiler was not found. Set the compiler globally or change the 'nativeCompiler' flag to false",
      );
    }
  }

  private static _getCircomCompiler(compilerPath: string): typeof Context {
    return fs.readFileSync(require.resolve(compilerPath));
  }
}
