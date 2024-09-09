import fsExtra from "fs-extra";
import { isEqual } from "lodash";

import { SetupCacheSchema } from "./schemas";
import { CIRCUIT_SETUP_CACHE_VERSION } from "../constants";

import { SetupCache, SetupCacheEntry } from "../types/cache";
import { ContributionSettings } from "../types/core";

class BaseCircuitsSetupCache {
  public static createEmpty(): BaseCircuitsSetupCache {
    return new BaseCircuitsSetupCache({
      _format: CIRCUIT_SETUP_CACHE_VERSION,
      files: {},
    });
  }

  public static async readFromFile(circuitsSetupCachePath: string): Promise<BaseCircuitsSetupCache> {
    let cacheRaw: SetupCache = {
      _format: CIRCUIT_SETUP_CACHE_VERSION,
      files: {},
    };

    if (await fsExtra.pathExists(circuitsSetupCachePath)) {
      cacheRaw = await fsExtra.readJson(circuitsSetupCachePath);
    }

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

  public async removeNonExistingFiles() {
    await Promise.all(
      Object.keys(this._setupCache.files).map(async (absolutePath) => {
        if (!(await fsExtra.pathExists(absolutePath))) {
          this.removeEntry(absolutePath);
        }
      }),
    );
  }

  public async writeToFile(circuitsCompileCachePath: string) {
    await fsExtra.outputJson(circuitsCompileCachePath, this._setupCache, {
      spaces: 2,
    });
  }

  public addFile(absolutePath: string, entry: SetupCacheEntry) {
    this._setupCache.files[absolutePath] = entry;
  }

  public getEntries(): SetupCacheEntry[] {
    return Object.values(this._setupCache.files);
  }

  public getEntry(file: string): SetupCacheEntry | undefined {
    return this._setupCache.files[file];
  }

  public removeEntry(file: string) {
    delete this._setupCache.files[file];
  }

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

export let CircuitsSetupCache: BaseCircuitsSetupCache | null = null;

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
 * Used only in test environments to ensure test atomicity
 */
export function resetCircuitsSetupCache() {
  CircuitsSetupCache = null;
}
