import fs from "fs";

import { HardhatZKitError } from "../../errors";
import {
  ICircomCompiler,
  IWASMCircomCompiler,
  CompileConfig,
  BaseCompileConfig,
} from "../../types/compile/core/circom-compiler";
import { execCall } from "../../utils/utils";

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

export class NativeCircomCompiler extends BaseCircomCompiler {
  public async compile(config: CompileConfig) {
    const compilationArgs: string[] = this.getCompilationArgs(config);

    try {
      await execCall("circom", compilationArgs);
    } catch (err) {
      if (config.quiet) {
        throw new HardhatZKitError(
          "Compilation failed with an unknown error. Use '--verbose' hardhat flag to see the compilation error.",
        );
      }

      throw new HardhatZKitError(`Compilation failed.\n${err}`);
    }
  }
}

export class WASMCircomCompiler extends BaseCircomCompiler implements IWASMCircomCompiler {
  constructor(private readonly _compiler: typeof Context) {
    super();
  }

  public async compile(config: CompileConfig) {
    const compilationArgs: string[] = this.getCompilationArgs(config);
    const circomRunner: typeof CircomRunner = this._getCircomRunner(compilationArgs, config.quiet);

    try {
      await circomRunner.execute(this._compiler);
    } catch (err) {
      if (config.quiet) {
        throw new HardhatZKitError(
          "Compilation failed with an unknown error. Use '--verbose' hardhat flag to see the compilation error.",
        );
      }

      throw new HardhatZKitError(`Compilation failed.\n${err}`);
    }
  }

  public async generateAST(config: BaseCompileConfig) {
    const generationArgs: string[] = this.getASTGenerationArgs(config);
    const circomRunner: typeof CircomRunner = this._getCircomRunner(generationArgs, config.quiet);

    try {
      await circomRunner.execute(this._compiler);
    } catch (err) {
      if (config.quiet) {
        throw new HardhatZKitError(
          "AST generation failed with an unknown error. Use '--verbose' hardhat flag to see the generation error.",
        );
      }

      throw new HardhatZKitError(`AST generation failed.\n${err}`);
    }
  }

  public getASTGenerationArgs(config: BaseCompileConfig): string[] {
    const args: string[] = this._getBaseCompilationArgs(config);

    args.push("--save_ast", config.artifactsFullPath, "--dry_run");

    return args;
  }

  private _getCircomRunner(callArgs: string[], quiet: boolean): typeof CircomRunner {
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
      quiet,
    });
  }
}
