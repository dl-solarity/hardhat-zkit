import fsExtra from "fs-extra";
import * as t from "io-ts";
import { isEqual } from "lodash";

import { FORMAT_VERSION } from "../constants";
import { Cache, CacheEntry, CompileFlags } from "../types/compile";

const CompileFlagsCodec = t.type({
  r1cs: t.boolean,
  wasm: t.boolean,
  sym: t.boolean,
  json: t.boolean,
  c: t.boolean,
});

const CacheEntryCodec = t.type({
  lastModificationDate: t.number,
  contentHash: t.string,
  sourceName: t.string,
  compileFlags: CompileFlagsCodec,
  imports: t.array(t.string),
  versionPragmas: t.array(t.string),
});

const CacheCodec = t.type({
  _format: t.string,
  files: t.record(t.string, CacheEntryCodec),
});

class BaseCircomCircuitsCache {
  public static createEmpty(): BaseCircomCircuitsCache {
    return new BaseCircomCircuitsCache({
      _format: FORMAT_VERSION,
      files: {},
    });
  }

  public static async readFromFile(circuitsFilesCachePath: string): Promise<BaseCircomCircuitsCache> {
    let cacheRaw: Cache = {
      _format: FORMAT_VERSION,
      files: {},
    };

    if (await fsExtra.pathExists(circuitsFilesCachePath)) {
      cacheRaw = await fsExtra.readJson(circuitsFilesCachePath);
    }

    const result = CacheCodec.decode(cacheRaw);

    if (result.isRight()) {
      const solidityFilesCache = new BaseCircomCircuitsCache(result.value);
      await solidityFilesCache.removeNonExistingFiles();
      return solidityFilesCache;
    }

    return new BaseCircomCircuitsCache({
      _format: FORMAT_VERSION,
      files: {},
    });
  }

  constructor(private _cache: Cache) {}

  public async removeNonExistingFiles() {
    await Promise.all(
      Object.keys(this._cache.files).map(async (absolutePath) => {
        if (!(await fsExtra.pathExists(absolutePath))) {
          this.removeEntry(absolutePath);
        }
      }),
    );
  }

  public async writeToFile(solidityFilesCachePath: string) {
    await fsExtra.outputJson(solidityFilesCachePath, this._cache, {
      spaces: 2,
    });
  }

  public addFile(absolutePath: string, entry: CacheEntry) {
    this._cache.files[absolutePath] = entry;
  }

  public getEntries(): CacheEntry[] {
    return Object.values(this._cache.files);
  }

  public getEntry(file: string): CacheEntry | undefined {
    return this._cache.files[file];
  }

  public removeEntry(file: string) {
    delete this._cache.files[file];
  }

  public hasFileChanged(absolutePath: string, contentHash: string, compileFlags: CompileFlags): boolean {
    const cacheEntry = this.getEntry(absolutePath);

    if (cacheEntry === undefined) {
      return true;
    }

    if (cacheEntry.contentHash !== contentHash) {
      return true;
    }

    if (!isEqual(cacheEntry.compileFlags, compileFlags)) {
      return true;
    }

    return false;
  }
}

export let CircomCircuitsCache: BaseCircomCircuitsCache | null = null;

export async function createCircuitsCache(circuitsFilesCachePath?: string) {
  if (CircomCircuitsCache) {
    return;
  }

  if (circuitsFilesCachePath) {
    CircomCircuitsCache = await BaseCircomCircuitsCache.readFromFile(circuitsFilesCachePath);
  } else {
    CircomCircuitsCache = BaseCircomCircuitsCache.createEmpty();
  }
}

/**
 * Used only in test environments to ensure test atomicity
 */
export function resetCircuitsCache() {
  CircomCircuitsCache = null;
}
