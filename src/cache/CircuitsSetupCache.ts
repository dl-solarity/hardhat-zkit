import fsExtra from "fs-extra";
import * as t from "io-ts";
import { isEqual } from "lodash";

import { CIRCUIT_SETUP_CACHE_VERSION } from "../constants";
import { SetupCache, SetupCacheEntry } from "../types/cache";
import { ContributionSettings } from "../types/setup/setup-processor";

const ContributionTemplateTypeCodec = t.literal("groth16");

const ContributionSettingsCodec = t.type({
  contributionTemplate: ContributionTemplateTypeCodec,
  contributions: t.number,
});

const SetupCacheEntryCodec = t.type({
  circuitSourceName: t.string,
  r1csContentHash: t.string,
  r1csSourcePath: t.string,
  contributionSettings: ContributionSettingsCodec,
});

const SetupCacheCodec = t.type({
  _format: t.string,
  files: t.record(t.string, SetupCacheEntryCodec),
});

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

    const result = SetupCacheCodec.decode(cacheRaw);

    if (result.isRight()) {
      const solidityFilesCache = new BaseCircuitsSetupCache(result.value);
      await solidityFilesCache.removeNonExistingFiles();

      return solidityFilesCache;
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

  public async writeToFile(solidityFilesCachePath: string) {
    await fsExtra.outputJson(solidityFilesCachePath, this._setupCache, {
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
