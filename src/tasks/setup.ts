import os from "os";
import path from "path";

import { CircuitsSetupCache, createCircuitsSetupCache } from "../cache/CircuitsSetupCache.js";
import { SetupFilesResolver } from "../core/setup/SetupFilesResolver.js";
import { SetupProcessor } from "../core/setup/SetupProcessor.js";
import { TypeGenerationProcessor } from "../core/index.js";
import { createReporter, Reporter } from "../reporter/ReporterFacade.js";
import { SetupContributionSettings } from "../types/core/setup/setup-processor.js";
import { CircuitSetupInfo } from "../types/core/setup/setup-files-resolver.js";
import { ProvingSystemData } from "../types/cache/circuits-setup-cache.js";
import { getNormalizedFullPath } from "../utils/path-utils.js";
import { getUniqueProvingSystems } from "../utils/utils.js";
import { SetupTaskConfig } from "../types/tasks/setup.js";
import { CIRCUITS_SETUP_CACHE_FILENAME } from "../constants.js";
import { NewTaskActionFunction } from "hardhat/types/tasks";

const setupAction: NewTaskActionFunction<SetupTaskConfig> = async (taskArgs, hre) => {
  const circuitsSetupCacheFullPath: string = getNormalizedFullPath(
    hre.config.paths.cache,
    CIRCUITS_SETUP_CACHE_FILENAME,
  );

  createReporter(taskArgs.quiet || hre.config.zkit.quiet);
  await createCircuitsSetupCache(circuitsSetupCacheFullPath);

  const setupFileResolver: SetupFilesResolver = new SetupFilesResolver(hre.zkit.circuitArtifacts, hre.config);

  const setupContributionSettings: SetupContributionSettings = {
    provingSystems: getUniqueProvingSystems(hre.config.zkit.setupSettings.contributionSettings.provingSystem),
    contributions: hre.config.zkit.setupSettings.contributionSettings.contributions,
  };

  const circuitSetupInfoArr: CircuitSetupInfo[] = await setupFileResolver.getCircuitsInfoToSetup(
    setupContributionSettings,
    hre.config.zkit.setupSettings,
    taskArgs.force,
  );

  if (circuitSetupInfoArr.length > 0) {
    let ptauDir = hre.config.zkit.setupSettings.ptauDir;

    // If `ptauDir` is not specified in the configuration,
    // the `.zkit/ptau` folder in the user's home directory is used as the default location
    if (ptauDir) {
      ptauDir = path.isAbsolute(ptauDir) ? ptauDir : getNormalizedFullPath(hre.config.paths.root, ptauDir);
    } else {
      ptauDir = path.join(os.homedir(), ".zkit", "ptau");
    }

    const setupProcessor: SetupProcessor = new SetupProcessor(ptauDir, hre.zkit.circuitArtifacts);

    await setupProcessor.setup(circuitSetupInfoArr, setupContributionSettings);

    updateCache(setupContributionSettings, circuitSetupInfoArr);
  } else {
    Reporter!.reportNothingToSetup();
  }

  await new TypeGenerationProcessor(hre).generateAllTypes();

  await CircuitsSetupCache!.writeToFile(circuitsSetupCacheFullPath);
};

function updateCache(setupContributionSettings: SetupContributionSettings, circuitSetupInfoArr: CircuitSetupInfo[]) {
  for (const setupInfo of circuitSetupInfoArr) {
    const currentSetupCacheEntry = CircuitsSetupCache!.getEntry(setupInfo.circuitArtifactFullPath);

    let currentProvingSystemsData: ProvingSystemData[] = [];

    if (currentSetupCacheEntry) {
      // Getting untouched proving systems data
      currentProvingSystemsData = currentSetupCacheEntry.provingSystemsData.filter((data: ProvingSystemData) => {
        return !setupInfo.provingSystems.includes(data.provingSystem);
      });
    }

    CircuitsSetupCache!.addFile(setupInfo.circuitArtifactFullPath, {
      circuitSourceName: setupInfo.circuitArtifact.circuitSourceName,
      r1csSourcePath: setupInfo.r1csSourcePath,
      provingSystemsData: [
        ...currentProvingSystemsData,
        ...setupContributionSettings.provingSystems.map((provingSystem) => {
          return {
            provingSystem,
            lastR1CSFileHash: setupInfo.r1csContentHash,
          };
        }),
      ],
      contributionsNumber: setupContributionSettings.contributions,
    });
  }
}

export default setupAction;
