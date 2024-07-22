import { HardhatRuntimeEnvironment } from "hardhat/types";

import { CircuitTypesGenerator } from "@solarity/zktype";

import { Reporter } from "../../reporter";
import { HardhatZKitError } from "../../errors";

import { ZKitConfig } from "../../types/zkit-config";
import { CircuitArtifact, ICircuitArtifacts } from "../../types/circuit-artifacts";

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
    const circuitsASTPaths: string[] = await Promise.all(
      circuitFullyQualifiedNames.map(async (name: string): Promise<string> => {
        const circuitArtifact: CircuitArtifact = await this._circuitArtifacts.readCircuitArtifact(name);

        const astFilePath: string | undefined = circuitArtifact.compilerOutputFiles.ast?.fileSourcePath;

        if (!astFilePath) {
          throw new HardhatZKitError(
            `AST file for ${circuitArtifact.circuitTemplateName} circuit not found. Compile circuits and try again.`,
          );
        }

        return astFilePath;
      }),
    );

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
