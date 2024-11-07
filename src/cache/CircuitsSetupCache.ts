import { ProvingSystemType } from "@solarity/zkit";

import { SetupCacheSchema } from "./schemas";
import { CIRCUIT_SETUP_CACHE_VERSION } from "../constants";

import { BaseCache } from "../cache/BaseCache";

import { ProvingSystemData, SetupCacheEntry } from "../types/cache";
import { SetupContributionSettings } from "../types/core";

/**
 * Class that implements the caching logic for setting up circuits.
 *
 * This class is responsible for managing the cache of circuit setup information, ensuring
 * efficient reuse of previously stored setup data. By storing the setup details, the class
 * helps prevent unnecessary reconfiguration of circuits that have not changed since the last setup.
 *
 * The class provides methods to clear, disable, and retrieve cached setup data, which can
 * significantly reduce the overhead of repeated setups for large and complex circuit configurations.
 *
 * The caching mechanism enhances performance and resource management during the setup process,
 * especially when dealing with multiple iterations of circuit configurations or contributions.
 */
class BaseCircuitsSetupCache extends BaseCache<SetupCacheEntry> {
  /**
   * Checks if the specified file has changed since the last check.
   *
   * This method compares the current state of the file, identified by its absolute path,
   * with the content hash and contribution settings recorded in the cache. If any of these
   * values differ, it indicates the file has been modified.
   *
   * @param artifactAbsolutePath The absolute path of the artifact file to check
   * @param r1csContentHash The content hash of the R1CS file to compare
   * @param contributionSettings The setup contribution settings to compare
   * @returns An array of {@link ProvingSystemType | proving systems} that were modified or required for setup
   */
  public hasFileChanged(
    artifactAbsolutePath: string,
    r1csContentHash: string,
    contributionSettings: SetupContributionSettings,
  ): ProvingSystemType[] {
    const cacheEntry = this.getEntry(artifactAbsolutePath);

    if (cacheEntry === undefined) {
      return contributionSettings.provingSystems;
    }

    const obsoleteProvingSystems: ProvingSystemType[] = [];

    for (const provingSystem of contributionSettings.provingSystems) {
      const provingSystemData: ProvingSystemData | undefined = cacheEntry.provingSystemsData.find(
        (data: ProvingSystemData) => data.provingSystem === provingSystem,
      );

      if (!provingSystemData) {
        obsoleteProvingSystems.push(provingSystem);

        continue;
      }

      if (
        provingSystemData.lastR1CSFileHash !== r1csContentHash ||
        (provingSystem === "groth16" && cacheEntry.contributionsNumber !== contributionSettings.contributions)
      ) {
        obsoleteProvingSystems.push(provingSystem);
      }
    }

    return obsoleteProvingSystems;
  }
}

/**
 * Singleton object that serves as the cache for setup information related to circuits.
 *
 * This cache maintains the state of the setup process and allows for efficient reuse
 * of previously stored setup data, thereby avoiding unnecessary reconfiguration of unchanged circuits.
 *
 * To create and properly initialize this cache object, the {@link createCircuitsSetupCache}
 * function must be invoked. The cache helps improve performance and manage resources effectively
 * during the setup of circuit configurations.
 */
export let CircuitsSetupCache: BaseCircuitsSetupCache | null = null;

/**
 * Creates and initializes a singleton instance of the {@link BaseCircuitsSetupCache} class
 *
 * @param circuitsSetupCachePath The full path to the setup cache file to load
 */
export async function createCircuitsSetupCache(circuitsSetupCachePath?: string) {
  if (CircuitsSetupCache) {
    return;
  }

  CircuitsSetupCache = new BaseCircuitsSetupCache(
    CIRCUIT_SETUP_CACHE_VERSION,
    SetupCacheSchema,
    circuitsSetupCachePath,
  );
}

/**
 * @remark Used only in test environments to ensure test atomicity
 */
export function resetCircuitsSetupCache() {
  CircuitsSetupCache = null;
}
