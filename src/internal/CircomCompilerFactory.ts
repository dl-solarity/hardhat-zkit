import fs from "fs";

import { CircomCompiler } from "./CircomCompiler";
import { ICircomCompiler } from "../types/internal/circom-compiler";
import { CompilerVersion } from "../types/internal/circom-compiler-factory";
import { HardhatZKitError } from "../tasks/errors";

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
