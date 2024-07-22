import fsExtra from "fs-extra";

import { HardhatConfig } from "hardhat/types";

import { Reporter } from "../../reporter";
import { HardhatZKitError } from "../../errors";
import { CircuitsSetupCache } from "../../cache";
import { filterCircuitFiles, getNormalizedFullPath } from "../../utils/path-utils";

import { FileFilterSettings, SetupSettings, ZKitConfig } from "../../types/zkit-config";
import { CircuitArtifact, CompilerOutputFileInfo, ICircuitArtifacts } from "../../types/circuit-artifacts";
import { CircuitSetupInfo } from "../../types/core";

export class SetupFilesResolver {
  private readonly _zkitConfig: ZKitConfig;
  private readonly _projectRoot: string;

  constructor(
    private readonly _circuitArtifacts: ICircuitArtifacts,
    hardhatConfig: HardhatConfig,
  ) {
    this._zkitConfig = hardhatConfig.zkit;
    this._projectRoot = hardhatConfig.paths.root;
  }

  public async getCircuitsInfoToSetup(setupSettings: SetupSettings, force: boolean): Promise<CircuitSetupInfo[]> {
    const allFullyQualifiedNames: string[] = await this._circuitArtifacts.getAllCircuitFullyQualifiedNames();

    let circuitSetupInfoArr: CircuitSetupInfo[] = await this._getCircuitSetupInfoArr(allFullyQualifiedNames);

    this._invalidateCacheMissingArtifacts(circuitSetupInfoArr);

    if (!force) {
      Reporter!.verboseLog("setup-file-resolver", "Force flag disabled. Start filtering circuits to setup...");

      circuitSetupInfoArr = circuitSetupInfoArr.filter((setupInfo) =>
        CircuitsSetupCache!.hasFileChanged(
          setupInfo.circuitArtifactFullPath,
          setupInfo.r1csContentHash,
          setupSettings.contributionSettings,
        ),
      );
    }

    const filteredCircuitsSetupInfo: CircuitSetupInfo[] = await this._filterCircuitSetupInfoArr(
      circuitSetupInfoArr,
      setupSettings,
    );

    Reporter!.reportCircuitListToSetup(circuitSetupInfoArr, filteredCircuitsSetupInfo);

    return filteredCircuitsSetupInfo;
  }

  private async _getCircuitSetupInfoArr(fullyQualifiedNames: string[]): Promise<CircuitSetupInfo[]> {
    return Promise.all(
      fullyQualifiedNames.map(async (name: string): Promise<CircuitSetupInfo> => {
        const circuitArtifact: CircuitArtifact = await this._circuitArtifacts.readCircuitArtifact(name);
        const r1csInfo: CompilerOutputFileInfo | undefined = circuitArtifact.compilerOutputFiles.r1cs;

        if (!r1csInfo) {
          throw new HardhatZKitError(`R1CS file for ${name} circuit not found. Compile circuits and try again.`);
        }

        return {
          circuitArtifact,
          r1csSourcePath: r1csInfo.fileSourcePath,
          r1csContentHash: r1csInfo.fileHash,
          circuitArtifactFullPath: this._circuitArtifacts.formCircuitArtifactPathFromFullyQualifiedName(name),
        };
      }),
    );
  }

  private async _filterCircuitSetupInfoArr(
    circuitSetupInfoArr: CircuitSetupInfo[],
    filterSettings: FileFilterSettings,
  ): Promise<CircuitSetupInfo[]> {
    const circuitsRoot = getNormalizedFullPath(this._projectRoot, this._zkitConfig.circuitsDir);

    return filterCircuitFiles<CircuitSetupInfo>(
      circuitSetupInfoArr,
      circuitsRoot,
      filterSettings,
      (circuitSetupInfo: CircuitSetupInfo): string => {
        return getNormalizedFullPath(this._projectRoot, circuitSetupInfo.circuitArtifact.circuitSourceName);
      },
    );
  }

  protected _invalidateCacheMissingArtifacts(circuitSetupInfoArr: CircuitSetupInfo[]) {
    for (const setupInfo of circuitSetupInfoArr) {
      const cacheEntry = CircuitsSetupCache!.getEntry(setupInfo.circuitArtifactFullPath);

      if (cacheEntry === undefined) {
        continue;
      }

      if (
        !fsExtra.existsSync(this._circuitArtifacts.getCircuitArtifactFileFullPath(setupInfo.circuitArtifact, "zkey")) ||
        !fsExtra.existsSync(this._circuitArtifacts.getCircuitArtifactFileFullPath(setupInfo.circuitArtifact, "vkey"))
      ) {
        CircuitsSetupCache!.removeEntry(setupInfo.circuitArtifactFullPath);
      }
    }
  }
}
