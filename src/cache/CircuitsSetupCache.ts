import fsExtra from "fs-extra";
import { isEqual } from "lodash";

import { SetupCacheSchema } from "./schemas";
import { CIRCUIT_SETUP_CACHE_VERSION } from "../constants";

import { BaseCache } from "@src/cache/BaseCache";
import { SetupCache, SetupCacheEntry } from "../types/cache";
import { ContributionSettings } from "../types/core";

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
class BaseCircuitsSetupCache extends BaseCache<SetupCache, SetupCacheEntry> {
  /**
   * Creates an empty instance of the {@link BaseCircuitsSetupCache} class
   *
   * @returns A new instance of the {@link BaseCircuitsSetupCache} with empty cache data
   */
  public static createEmpty(): BaseCircuitsSetupCache {
    return new BaseCircuitsSetupCache({
      _format: CIRCUIT_SETUP_CACHE_VERSION,
      files: {},
    });
  }

  /**
   * Creates an instance of {@link BaseCircuitsSetupCache} using the data read from the specified cache file
   *
   * @param circuitsSetupCachePath The full path to the setup cache file from which to read the data
   * @returns A promise that resolves to an instance of {@link BaseCircuitsSetupCache} populated with the read data
   */
  public static async readFromFile(circuitsSetupCachePath: string): Promise<BaseCircuitsSetupCache> {
    let cacheRaw: SetupCache = {
      _format: CIRCUIT_SETUP_CACHE_VERSION,
      files: {},
    };

    if (await fsExtra.pathExists(circuitsSetupCachePath)) {
      cacheRaw = await fsExtra.readJson(circuitsSetupCachePath);
    }

    // Validate the correctness of the data read from the file using the Zod schema
    const result = SetupCacheSchema.safeParse(cacheRaw);

    if (result.success) {
      const circuitsSetupCache = new BaseCircuitsSetupCache(result.data);
      await circuitsSetupCache.removeNonExistingFiles();

      return circuitsSetupCache;
    }

    return new BaseCircuitsSetupCache({
      _format: CIRCUIT_SETUP_CACHE_VERSION,
      files: {},
    });
  }

  /**
   * Checks if the specified file has changed since the last check.
   *
   * This method compares the current state of the file, identified by its absolute path,
   * with the content hash and contribution settings recorded in the cache. If any of these
   * values differ, it indicates the file has been modified.
   *
   * @param artifactAbsolutePath The absolute path of the artifact file to check
   * @param r1csContentHash The content hash of the R1CS file to compare
   * @param contributionSettings The contribution settings to compare
   * @returns True if the file has changed, false otherwise.
   */
  public hasFileChanged(
    artifactAbsolutePath: string,
    r1csContentHash: string,
    contributionSettings: ContributionSettings,
  ): boolean {
    const cacheEntry = this.getEntry(artifactAbsolutePath);

    if (cacheEntry === undefined) {
      return true;
    }

    if (cacheEntry.r1csContentHash !== r1csContentHash) {
      return true;
    }

    if (!isEqual(cacheEntry.contributionSettings, contributionSettings)) {
      return true;
    }

    return false;
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

  if (circuitsSetupCachePath) {
    CircuitsSetupCache = await BaseCircuitsSetupCache.readFromFile(circuitsSetupCachePath);
  } else {
    CircuitsSetupCache = BaseCircuitsSetupCache.createEmpty();
  }
}

/**
 * @remark Used only in test environments to ensure test atomicity
 */
export function resetCircuitsSetupCache() {
  CircuitsSetupCache = null;
}
