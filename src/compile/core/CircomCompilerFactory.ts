import fs from "fs";

import { CircomCompiler } from "./CircomCompiler";
import { ICircomCompiler, CompilerVersion } from "../../types/compile";
import { HardhatZKitError } from "../../errors";

// eslint-disable-next-line
const { Context } = require("@distributedlab/circom2");

export class CircomCompilerFactory {
  public static createCircomCompiler(version: CompilerVersion): ICircomCompiler {
    switch (version) {
      case "0.2.18":
        return new CircomCompiler(this._getCircomCompiler("@distributedlab/circom2/circom.wasm"));
      default:
        throw new HardhatZKitError(`Unsupported Circom compiler version - ${version}. Please provide another version.`);
    }
  }

  private static _getCircomCompiler(compilerPath: string): typeof Context {
    return fs.readFileSync(require.resolve(compilerPath));
  }
}
