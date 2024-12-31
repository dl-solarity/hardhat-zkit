import os from "os";
import path from "path";

import { ActionType, HardhatRuntimeEnvironment } from "hardhat/types";

import { CircuitsSetupCache, createCircuitsSetupCache } from "../cache";
import { TypeGenerationProcessor, SetupProcessor, SetupFilesResolver } from "../core";

import { Reporter, createReporter } from "../reporter";
import { CIRCUITS_SETUP_CACHE_FILENAME } from "../constants";
import { getNormalizedFullPath, getUniqueProvingSystems } from "../utils";

import { SetupTaskConfig } from "../types/tasks";
import { CircuitSetupInfo, SetupContributionSettings } from "../types/core";
import { ProvingSystemData } from "../types/cache";

export const setup: ActionType<SetupTaskConfig> = async (taskArgs: SetupTaskConfig, env: HardhatRuntimeEnvironment) => {
  const circuitsSetupCacheFullPath: string = getNormalizedFullPath(
    env.config.paths.cache,
    CIRCUITS_SETUP_CACHE_FILENAME,
  );

  createReporter(taskArgs.quiet || env.config.zkit.quiet);
  await createCircuitsSetupCache(circuitsSetupCacheFullPath);

  const setupFileResolver: SetupFilesResolver = new SetupFilesResolver(env.zkit.circuitArtifacts, env.config);

  const setupContributionSettings: SetupContributionSettings = {
    provingSystems: getUniqueProvingSystems(env.config.zkit.setupSettings.contributionSettings.provingSystem),
    contributions: env.config.zkit.setupSettings.contributionSettings.contributions,
  };

  const circuitSetupInfoArr: CircuitSetupInfo[] = await setupFileResolver.getCircuitsInfoToSetup(
    setupContributionSettings,
    env.config.zkit.setupSettings,
    taskArgs.force,
  );

  if (circuitSetupInfoArr.length > 0) {
    let ptauDir = env.config.zkit.setupSettings.ptauDir;

    // If `ptauDir` is not specified in the configuration,
    // the `.zkit/ptau` folder in the user's home directory is used as the default location
    if (ptauDir) {
      ptauDir = path.isAbsolute(ptauDir) ? ptauDir : getNormalizedFullPath(env.config.paths.root, ptauDir);
    } else {
      ptauDir = path.join(os.homedir(), ".zkit", "ptau");
    }

    const setupProcessor: SetupProcessor = new SetupProcessor(ptauDir, env.zkit.circuitArtifacts);

    await setupProcessor.setup(circuitSetupInfoArr, setupContributionSettings);

    updateCache(setupContributionSettings, circuitSetupInfoArr);
  } else {
    Reporter!.reportNothingToSetup();
  }

  await new TypeGenerationProcessor(env).generateAllTypes();

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
