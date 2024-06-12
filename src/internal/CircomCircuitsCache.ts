import fsExtra from "fs-extra";
import * as t from "io-ts";
import { isEqual } from "lodash";

import { FORMAT_VERSION } from "./constants";
import { Cache, CacheEntry } from "../types/internal/circuits-cache";
import { CompileOptions } from "../types/compile";

const CompileOptionsCodec = t.type({
  sym: t.boolean,
  json: t.boolean,
  c: t.boolean,
  quiet: t.boolean,
});

const CacheEntryCodec = t.type({
  lastModificationDate: t.number,
  contentHash: t.string,
  sourceName: t.string,
  compileOptions: CompileOptionsCodec,
  imports: t.array(t.string),
  versionPragmas: t.array(t.string),
});

const CacheCodec = t.type({
  _format: t.string,
  files: t.record(t.string, CacheEntryCodec),
});

export class CircomCircuitsCache {
  public static createEmpty(): CircomCircuitsCache {
    return new CircomCircuitsCache({
      _format: FORMAT_VERSION,
      files: {},
    });
  }

  public static async readFromFile(solidityFilesCachePath: string): Promise<CircomCircuitsCache> {
    let cacheRaw: Cache = {
      _format: FORMAT_VERSION,
      files: {},
    };

    if (await fsExtra.pathExists(solidityFilesCachePath)) {
      cacheRaw = await fsExtra.readJson(solidityFilesCachePath);
    }

    const result = CacheCodec.decode(cacheRaw);

    if (result.isRight()) {
      const solidityFilesCache = new CircomCircuitsCache(result.value);
      await solidityFilesCache.removeNonExistingFiles();
      return solidityFilesCache;
    }

    return new CircomCircuitsCache({
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

  public hasFileChanged(absolutePath: string, contentHash: string, compileOptions: CompileOptions): boolean {
    const cacheEntry = this.getEntry(absolutePath);

    if (cacheEntry === undefined) {
      return true;
    }

    if (cacheEntry.contentHash !== contentHash) {
      return true;
    }

    if (!isEqual(cacheEntry.compileOptions, compileOptions)) {
      return true;
    }

    return false;
  }
}
