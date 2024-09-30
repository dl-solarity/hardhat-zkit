import fsExtra from "fs-extra";
import { isEqual } from "lodash";

import { SetupCacheSchema } from "./schemas";
import { CIRCUIT_SETUP_CACHE_VERSION } from "../constants";

import { SetupCache, SetupCacheEntry } from "../types/cache";
import { ContributionSettings } from "../types/core";

class BaseCircuitsSetupCache {
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

  constructor(private _setupCache: SetupCache) {}

  /**
   * Removes cache entries for files that no longer exist.
   *
   * This method helps keep the cache up-to-date by deleting references
   * to non-existent files, ensuring that the cache remains valid.
   */
  public async removeNonExistingFiles() {
    await Promise.all(
      Object.keys(this._setupCache.files).map(async (absolutePath) => {
        if (!(await fsExtra.pathExists(absolutePath))) {
          this.removeEntry(absolutePath);
        }
      }),
    );
  }

  /**
   * Writes the current cache state to a specified file
   *
   * @param circuitsCompileCachePath The full path to the cache file where the state will be written
   */
  public async writeToFile(circuitsCompileCachePath: string) {
    await fsExtra.outputJson(circuitsCompileCachePath, this._setupCache, {
      spaces: 2,
    });
  }

  /**
   * Adds a file cache entry to the cache data using the specified absolute path
   *
   * @param absolutePath The absolute path to the circuit file
   * @param entry The cache entry to be added for the specified file path
   */
  public addFile(absolutePath: string, entry: SetupCacheEntry) {
    this._setupCache.files[absolutePath] = entry;
  }

  /**
   * Returns all stored cache entries
   *
   * @returns An array of all stored cache entries
   */
  public getEntries(): SetupCacheEntry[] {
    return Object.values(this._setupCache.files);
  }

  /**
   * Returns the cache entry for the specified file path, or undefined if no entry exists
   *
   * @param file The absolute path to the circuit file
   * @returns The stored cache entry or undefined if no entry is found
   */
  public getEntry(file: string): SetupCacheEntry | undefined {
    return this._setupCache.files[file];
  }

  /**
   * Removes the cache entry for the specified file path from the cache
   *
   * @param file The absolute path to the circuit file
   */
  public removeEntry(file: string) {
    delete this._setupCache.files[file];
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
