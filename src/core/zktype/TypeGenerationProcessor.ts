import { HardhatRuntimeEnvironment } from "hardhat/types";
import { localPathToSourceName } from "hardhat/utils/source-names";
import { willRunWithTypescript } from "hardhat/internal/core/typescript-support";

import { CircuitTypesGenerator } from "@solarity/zktype";

import { Reporter } from "../../reporter";

import { ZKitConfig } from "../../types/zkit-config";
import { ICircuitArtifacts } from "../../types/artifacts/circuit-artifacts";

/**
 * A class responsible for generating TypeScript types for compiled circuits.
 * It uses the {@link https://github.com/dl-solarity/zktype | ZKType} library to create all the necessary
 * types for developers, based on the information from the circuit artifact files.
 *
 * This process ensures that the generated types are aligned with the compiled circuits, making it easier
 * for developers to work with them in a type-safe manner.
 *
 * In addition to generating types, overloaded versions of the `getCircuit` function are also generated,
 * which are added to the `hardhat/types/runtime` module. These extensions simplify the writing of tests
 * by providing more intuitive type definitions for the circuits.
 */
export class TypeGenerationProcessor {
  private readonly _zkitConfig: ZKitConfig;
  private readonly _circuitArtifacts: ICircuitArtifacts;
  private readonly _root: string;
  private readonly _isTSProject: boolean;

  constructor(hre: HardhatRuntimeEnvironment) {
    this._circuitArtifacts = hre.zkit.circuitArtifacts;
    this._zkitConfig = hre.config.zkit;
    this._root = hre.config.paths.root;
    this._isTSProject = willRunWithTypescript(hre.hardhatArguments.config);
  }

  /**
   * Generates TypeScript types and overloaded `getCircuit` functions for all existing circuit artifacts.
   *
   * The generation process follows these steps:
   * 1. Retrieve an array of paths to all existing artifacts
   *    using the {@link ICircuitArtifacts | CircuitArtifacts} interface
   * 2. Convert the retrieved paths into the format required by the {@link CircuitTypesGenerator}
   * 3. Create an instance of the {@link CircuitTypesGenerator} class with the necessary parameters
   * 4. Generate the types based on the provided circuit artifacts
   */
  public async generateAllTypes() {
    if (!this._isTSProject) {
      return;
    }

    const circuitsArtifactsPaths: string[] = await Promise.all(
      (await this._circuitArtifacts.getCircuitArtifactPaths()).map(async (fullPath: string) => {
        return localPathToSourceName(this._root, fullPath);
      }),
    );

    const typesGenerator: CircuitTypesGenerator = new CircuitTypesGenerator({
      basePath: this._zkitConfig.circuitsDir,
      projectRoot: this._root,
      outputTypesDir: this._zkitConfig.typesDir,
      circuitsArtifactsPaths,
    });

    await typesGenerator.generateTypes();

    Reporter!.verboseLog("type-generation-processor", "Created CircuitTypesGenerator with params: %O", [
      {
        basePath: this._zkitConfig.circuitsDir,
        projectRoot: this._root,
        outputTypesDir: this._zkitConfig.typesDir,
        circuitsArtifactsPaths,
      },
    ]);
  }
}
