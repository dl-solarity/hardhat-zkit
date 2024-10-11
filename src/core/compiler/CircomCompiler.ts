import fs from "fs";

import { HardhatZKitError } from "../../errors";
import { execCall } from "../../utils/utils";

import { ICircomCompiler, CompileConfig, BaseCompileConfig } from "../../types/core";
import { MAGIC_DESCRIPTOR } from "../../constants";

// eslint-disable-next-line
const { CircomRunner, bindings, preopens } = require("./vendor");

/**
 * An abstract class that serves as the base for all `circom` compiler implementations.
 * This class provides the foundational logic for creating the list of compilation arguments
 * from a {@link CompileConfig} object, which will be passed to the compiler during the compilation process.
 *
 * The `BaseCircomCompiler` class defines the core behavior and structure for all `circom` compilers,
 * ensuring consistency across different compiler implementations. It also offers utility methods
 * for generating base compilation arguments and handling specific flags related to the compilation process.
 *
 * Key responsibilities of the `BaseCircomCompiler` class include:
 *
 * 1. **Abstract Compilation Method**: The `compile` method is abstract and must be implemented by
 *    any subclass. This method is responsible for executing the actual compilation of circuits based on
 *    the provided {@link CompileConfig} parameters
 *
 * 2. **Compilation Argument Generation**: The `getCompilationArgs` method creates a complete list
 *    of command-line arguments that will be passed to the `circom` compiler. It dynamically generates
 *    these arguments based on the compilation flags specified in the config
 *
 * 3. **Base Compilation Arguments**: The `_getBaseCompilationArgs` method provides the essential
 *    arguments, such as the circuit file path and the output directory for the compiled artifacts.
 *    It also includes any linked libraries that may be required during the compilation process
 *
 * 4. **Flag Handling**: For each compilation flag specified in the `CompileConfig`, the class ensures
 *    that the corresponding flag is added to the arguments list if its value is truthy. This allows
 *    flexible control over the compilation process
 */
abstract class BaseCircomCompiler implements ICircomCompiler {
  abstract compile(config: CompileConfig): Promise<void>;

  /**
   * Creates the list of compilation arguments to be passed to the compiler
   *
   * @param config The configuration object with compilation parameters
   * @returns An array of strings representing the compilation parameters that will be passed to the compiler
   */
  public getCompilationArgs(config: CompileConfig): string[] {
    const args: string[] = this._getBaseCompilationArgs(config);

    for (const [key, value] of Object.entries(config.compileFlags)) {
      value && args.push(`--${key}`);
    }

    return args;
  }

  /**
   * Creates the base list of compilation arguments, such as circuit file path and output path
   *
   * @param baseConfig The base configuration object containing the circuit file path,
   *    artifacts path, and linked libraries
   * @returns An array of strings representing the essential compilation arguments
   */
  protected _getBaseCompilationArgs(baseConfig: BaseCompileConfig): string[] {
    const args = [baseConfig.circuitFullPath, "-o", baseConfig.artifactsFullPath];

    for (const linkLibrary of baseConfig.linkLibraries) {
      args.push("-l", linkLibrary);
    }

    return args;
  }
}

/**
 * A concrete implementation of the {@link BaseCircomCompiler} that handles the compilation of `circom` circuits
 * using a binary compiler specified at instantiation. This class is responsible for invoking the compiler
 * with the appropriate arguments derived from the provided {@link CompileConfig} object.
 *
 * The `BinaryCircomCompiler` class encapsulates the logic necessary to execute the compilation process
 * and manage errors that may arise during execution. By leveraging the base functionality provided by
 * {@link BaseCircomCompiler}, this class can easily integrate with different binary compilers while maintaining
 * a consistent interface.
 */
export class BinaryCircomCompiler extends BaseCircomCompiler {
  constructor(private readonly _compiler: string) {
    super();
  }

  /**
   * Executes the compilation of the specified `circom` circuits using the binary compiler.
   *
   * The method retrieves the compilation arguments from the configuration and calls the
   * binary compiler with these arguments. It handles potential errors during the compilation
   * process and throws a specific error if compilation fails.
   *
   * @param config The configuration object containing parameters for compilation
   * @throws HardhatZKitError If the compilation process fails, providing details about the error
   */
  public async compile(config: CompileConfig) {
    const compilationArgs: string[] = this.getCompilationArgs(config);

    try {
      await execCall(this._compiler, compilationArgs);
    } catch (err) {
      throw new HardhatZKitError(`Compilation failed.\n${err}`);
    }
  }
}

/**
 * A concrete implementation of the {@link BaseCircomCompiler} designed to compile `circom` circuits using
 * a WebAssembly (WASM) compiler. This class integrates the WASM execution environment, managing the
 * execution of the compiler and handling error logging efficiently.
 *
 * The `WASMCircomCompiler` is responsible for executing the compiler in a controlled environment,
 * providing a seamless interface for compiling circuits while leveraging the performance advantages
 * of WebAssembly. It manages the intricacies of invoking the compiler, processing arguments, and
 * capturing errors that may arise during execution.
 *
 * This class is designed for developers who require efficient compilation of `circom` circuits
 * within a WASM context, enhancing performance while maintaining robust error management and
 * logging capabilities.
 */
export class WASMCircomCompiler extends BaseCircomCompiler {
  constructor(private readonly _compiler: Buffer) {
    super();
  }

  /**
   * Executes the compilation of the specified `circom` circuits using the WebAssembly compiler.
   *
   * The method manages the creation of an error log file, retrieves the necessary compilation arguments,
   * and initializes the {@link CircomRunner} for executing the compilation. It handles potential errors during
   * execution and ensures proper cleanup of resources after the compilation process.
   *
   * @param config The configuration object containing parameters for compilation
   * @throws HardhatZKitError If the compilation process fails, providing details about the error
   */
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

  /**
   * Configures and creates an instance of the {@link CircomRunner} for executing the compiler
   * with the specified arguments.
   *
   * This method sets up the necessary bindings and descriptors for managing the execution environment of the compiler,
   * ensuring that file system interactions and exit handling are properly defined.
   *
   * @param callArgs The arguments to be passed to the compiler
   * @param quiet A boolean indicating whether to suppress standard error output
   * @param errDescriptor The file descriptor for logging errors during compilation
   * @returns An instance of {@link CircomRunner} configured with the provided parameters
   */
  private _getCircomRunner(callArgs: string[], quiet: boolean, errDescriptor: number): typeof CircomRunner {
    return new CircomRunner({
      args: callArgs,
      preopens,
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
