import fsExtra from "fs-extra";

import { HardhatConfig } from "hardhat/types";

import { ProvingSystemType } from "@solarity/zkit";

import { Reporter } from "../../reporter";
import { HardhatZKitError } from "../../errors";
import { CircuitsSetupCache } from "../../cache";
import { filterCircuitFiles, getNormalizedFullPath } from "../../utils/path-utils";

import { FileFilterSettings, ZKitConfig } from "../../types/zkit-config";
import { CircuitArtifact, CompilerOutputFileInfo, ICircuitArtifacts } from "../../types/artifacts/circuit-artifacts";
import { CircuitSetupInfo, SetupContributionSettings } from "../../types/core";

/**
 * Class responsible for resolving setup files for circuits in a given project.
 *
 * The SetupFilesResolver manages the retrieval and filtering of circuit setup information based on
 * the specified setup settings. It interacts with circuit artifacts to gather necessary data,
 * ensuring that the setup process is efficient and up-to-date. The class provides methods to determine
 * which circuits require setup and handles caching to optimize performance. It integrates with the
 * circuit setup cache to track changes in files and determine if a setup is necessary.
 */
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

  /**
   * Retrieves information about circuits that need to be set up based on the provided setup settings.
   *
   * This method follows the execution flow:
   * 1. Gathers all fully qualified names of the circuits from the circuit artifacts
   * 2. Creates an array of circuit setup information by fetching the setup info for all circuits
   * 3. If the force flag is not set, filters out circuits that have not changed since the last setup
   *    based on their content hash and contribution settings
   * 4. Applies additional filtering based on the provided setup settings to finalize the list of circuits
   * 5. Returns an array of {@link CircuitSetupInfo} objects
   *
   * @param setupSettings The settings that dictate how the circuit setup should be performed
   * @param force A boolean flag that, when true, skips filtering by file changes during setup
   * @returns An array of {@link CircuitSetupInfo} objects containing information about the circuits to be set up
   */
  public async getCircuitsInfoToSetup(
    contributionSettings: SetupContributionSettings,
    setupFilterSettings: FileFilterSettings,
    force: boolean,
  ): Promise<CircuitSetupInfo[]> {
    const allFullyQualifiedNames: string[] = await this._circuitArtifacts.getAllCircuitFullyQualifiedNames();

    let circuitSetupInfoArr: CircuitSetupInfo[] = await this._getCircuitSetupInfoArr(
      allFullyQualifiedNames,
      contributionSettings.provingSystems,
    );

    this._invalidateCacheMissingArtifacts(circuitSetupInfoArr, contributionSettings.provingSystems);

    if (!force) {
      Reporter!.verboseLog("setup-file-resolver", "Force flag disabled. Start filtering circuits to setup...");

      circuitSetupInfoArr = circuitSetupInfoArr.filter((setupInfo, index) => {
        const changedProvingSystems: ProvingSystemType[] = CircuitsSetupCache!.hasFileChanged(
          setupInfo.circuitArtifactFullPath,
          setupInfo.r1csContentHash,
          contributionSettings,
        );

        circuitSetupInfoArr[index].provingSystems = changedProvingSystems;

        return changedProvingSystems.length > 0;
      });
    }

    const filteredCircuitsSetupInfo: CircuitSetupInfo[] = await this._filterCircuitSetupInfoArr(
      circuitSetupInfoArr,
      setupFilterSettings,
    );

    Reporter!.reportCircuitListToSetup(circuitSetupInfoArr, filteredCircuitsSetupInfo);

    return filteredCircuitsSetupInfo;
  }

  private async _getCircuitSetupInfoArr(
    fullyQualifiedNames: string[],
    provingSystems: ProvingSystemType[],
  ): Promise<CircuitSetupInfo[]> {
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
          provingSystems,
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

  protected _invalidateCacheMissingArtifacts(
    circuitSetupInfoArr: CircuitSetupInfo[],
    provingSystems: ProvingSystemType[],
  ) {
    for (const setupInfo of circuitSetupInfoArr) {
      const cacheEntry = CircuitsSetupCache!.getEntry(setupInfo.circuitArtifactFullPath);

      if (cacheEntry === undefined) {
        continue;
      }

      const provingSystemsToRemove: ProvingSystemType[] = [];

      for (const provingSystem of provingSystems) {
        if (
          !fsExtra.existsSync(
            this._circuitArtifacts.getCircuitArtifactFileFullPath(setupInfo.circuitArtifact, "zkey", provingSystem),
          ) ||
          !fsExtra.existsSync(
            this._circuitArtifacts.getCircuitArtifactFileFullPath(setupInfo.circuitArtifact, "vkey", provingSystem),
          )
        ) {
          provingSystemsToRemove.push(provingSystem);
        }
      }

      cacheEntry.provingSystemsData = cacheEntry.provingSystemsData.filter(
        (data) => !provingSystemsToRemove.includes(data.provingSystem),
      );

      if (cacheEntry.provingSystemsData.length > 0) {
        CircuitsSetupCache!.addFile(setupInfo.circuitArtifactFullPath, cacheEntry);
      } else {
        CircuitsSetupCache!.removeEntry(setupInfo.circuitArtifactFullPath);
      }
    }
  }
}
