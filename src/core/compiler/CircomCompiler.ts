import fs from "fs";

import { HardhatZKitError } from "../../errors";
import { execCall } from "../../utils/utils";

import { ICircomCompiler, CompileConfig, BaseCompileConfig } from "../../types/core";
import { MAGIC_DESCRIPTOR } from "../../constants";

// eslint-disable-next-line
const { Context, CircomRunner, bindings } = require("@distributedlab/circom2");

abstract class BaseCircomCompiler implements ICircomCompiler {
  abstract compile(config: CompileConfig): Promise<void>;

  public getCompilationArgs(config: CompileConfig): string[] {
    const args: string[] = this._getBaseCompilationArgs(config);

    for (const [key, value] of Object.entries(config.compileFlags)) {
      value && args.push(`--${key}`);
    }

    return args;
  }

  protected _getBaseCompilationArgs(baseConfig: BaseCompileConfig): string[] {
    const args = [baseConfig.circuitFullPath, "-o", baseConfig.artifactsFullPath];

    for (const linkLibrary of baseConfig.linkLibraries) {
      args.push("-l", linkLibrary);
    }

    return args;
  }
}

export class BinaryCircomCompiler extends BaseCircomCompiler {
  constructor(private readonly _compiler: string) {
    super();
  }

  public async compile(config: CompileConfig) {
    const compilationArgs: string[] = this.getCompilationArgs(config);

    try {
      await execCall(this._compiler, compilationArgs);
    } catch (err) {
      throw new HardhatZKitError(`Compilation failed.\n${err}`);
    }
  }
}

export class WASMCircomCompiler extends BaseCircomCompiler {
  constructor(private readonly _compiler: typeof Context) {
    super();
  }

  public async compile(config: CompileConfig) {
    const errorFileDescriptor: number = fs.openSync(config.errorFileFullPath, "w");
    const compilationArgs: string[] = this.getCompilationArgs(config);
    const circomRunner: typeof CircomRunner = this._getCircomRunner(compilationArgs, config.quiet, errorFileDescriptor);

    try {
      await circomRunner.execute(this._compiler);
    } catch (err) {
      throw new HardhatZKitError(`Compilation failed.\n${err}`);
    } finally {
      fs.closeSync(errorFileDescriptor);
    }
  }

  private _getCircomRunner(callArgs: string[], quiet: boolean, errDescriptor: number): typeof CircomRunner {
    return new CircomRunner({
      args: callArgs,
      preopens: { "/": "/" },
      bindings: {
        ...bindings,
        exit(code: number) {
          throw new HardhatZKitError(`Error during compiler execution. Exit code: ${code}.`);
        },
        fs,
      },
      descriptors: { stdout: MAGIC_DESCRIPTOR, stderr: quiet ? MAGIC_DESCRIPTOR : errDescriptor },
    });
  }
}
