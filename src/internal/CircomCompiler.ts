import fs from "fs";

import { HardhatZKitError } from "../tasks/errors";
import { ICircomCompiler, CompileConfig } from "../types/internal/circom-compiler";

// eslint-disable-next-line
const { Context, CircomRunner, bindings } = require("@distributedlab/circom2");

export class CircomCompiler implements ICircomCompiler {
  constructor(private readonly _compiler: typeof Context) {}

  public async compile(config: CompileConfig) {
    const compilationArgs: string[] = this.getCompilationArgs(config);

    const circomRunner: typeof CircomRunner = new CircomRunner({
      args: compilationArgs,
      preopens: { "/": "/" },
      bindings: {
        ...bindings,
        exit(code: number) {
          throw new HardhatZKitError(`Compilation error. Exit code: ${code}.`);
        },
        fs,
      },
      quiet: config.quiet,
    });

    try {
      await circomRunner.execute(this._compiler);
    } catch (err) {
      const parentErr = new Error(undefined, { cause: err });

      if (config.quiet) {
        throw new HardhatZKitError(
          "Compilation failed with an unknown error. Consider passing 'quiet=false' flag to see the compilation error.",
          parentErr,
        );
      }

      throw new HardhatZKitError("Compilation failed.", parentErr);
    }
  }

  public getCompilationArgs(config: CompileConfig): string[] {
    const args = [config.circuitFullPath, "-o", config.artifactsFullPath];

    for (const [key, value] of Object.entries(config.compileFlags)) {
      value && args.push(`--${key}`);
    }

    return args;
  }
}
