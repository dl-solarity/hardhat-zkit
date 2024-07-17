import { HardhatRuntimeEnvironment } from "hardhat/types";

import { CircuitTypesGenerator } from "@solarity/zktype";

import { Reporter } from "../../reporter";
import { ICircuitArtifacts } from "../../types/circuit-artifacts";
import { ZKitConfig } from "../../types/zkit-config";

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
    const allFullyQualifiedNames: string[] = await this._circuitArtifacts.getAllCircuitFullyQualifiedNames();

    await this.generateTypes(allFullyQualifiedNames);
  }

  public async generateTypes(circuitFullyQualifiedNames: string[]) {
    const circuitsASTPaths: string[] = circuitFullyQualifiedNames.map((name: string) => {
      return this._circuitArtifacts.formCircuitArtifactPathFromFullyQualifiedName(name);
    });

    const typesGenerator: CircuitTypesGenerator = new CircuitTypesGenerator({
      basePath: this._zkitConfig.circuitsDir,
      projectRoot: this._root,
      outputArtifactsDir: this._zkitConfig.typesSettings.typesArtifactsDir,
      outputTypesDir: this._zkitConfig.typesSettings.typesDir,
      circuitsASTPaths,
    });

    Reporter!.verboseLog("type-generation-processor", "Created CircuitTypesGenerator with params: %O", [
      {
        basePath: this._zkitConfig.circuitsDir,
        projectRoot: this._root,
        outputArtifactsDir: this._zkitConfig.typesSettings.typesArtifactsDir,
        outputTypesDir: this._zkitConfig.typesSettings.typesDir,
        circuitsASTPaths,
      },
    ]);

    await typesGenerator.generateTypes();
  }
}
