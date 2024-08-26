import { HardhatRuntimeEnvironment } from "hardhat/types";
import { localPathToSourceName } from "hardhat/utils/source-names";

import { CircuitTypesGenerator } from "@solarity/zktype";

import { Reporter } from "../../reporter";

import { ZKitConfig } from "../../types/zkit-config";
import { ICircuitArtifacts } from "../../types/artifacts/circuit-artifacts";

export class TypeGenerationProcessor {
  private readonly _zkitConfig: ZKitConfig;
  private readonly _circuitArtifacts: ICircuitArtifacts;
  private readonly _root: string;

  constructor(hre: HardhatRuntimeEnvironment) {
    this._circuitArtifacts = hre.zkit.circuitArtifacts;
    this._zkitConfig = hre.config.zkit;
    this._root = hre.config.paths.root;
  }

  public async generateAllTypes() {
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
