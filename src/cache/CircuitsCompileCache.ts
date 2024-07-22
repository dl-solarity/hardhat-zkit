import fsExtra from "fs-extra";
import * as t from "io-ts";
import { isEqual } from "lodash";

import { CIRCUIT_COMPILE_CACHE_VERSION } from "../constants";

import { CompileCache, CompileCacheEntry } from "../types/cache";
import { CompileFlags } from "../types/core";

const CompileFlagsCodec = t.type({
  r1cs: t.boolean,
  wasm: t.boolean,
  sym: t.boolean,
  json: t.boolean,
  c: t.boolean,
});

const CompileCacheEntryCodec = t.type({
  lastModificationDate: t.number,
  contentHash: t.string,
  sourceName: t.string,
  compileFlags: CompileFlagsCodec,
  imports: t.array(t.string),
  versionPragmas: t.array(t.string),
});

const CompileCacheCodec = t.type({
  _format: t.string,
  files: t.record(t.string, CompileCacheEntryCodec),
});

class BaseCircuitsCompileCache {
  public static createEmpty(): BaseCircuitsCompileCache {
    return new BaseCircuitsCompileCache({
      _format: CIRCUIT_COMPILE_CACHE_VERSION,
      files: {},
    });
  }

  public static async readFromFile(circuitsCompileCachePath: string): Promise<BaseCircuitsCompileCache> {
    let cacheRaw: CompileCache = {
      _format: CIRCUIT_COMPILE_CACHE_VERSION,
      files: {},
    };

    if (await fsExtra.pathExists(circuitsCompileCachePath)) {
      cacheRaw = await fsExtra.readJson(circuitsCompileCachePath);
    }

    const result = CompileCacheCodec.decode(cacheRaw);

    if (result.isRight()) {
      const solidityFilesCache = new BaseCircuitsCompileCache(result.value);
      await solidityFilesCache.removeNonExistingFiles();

      return solidityFilesCache;
    }

    return new BaseCircuitsCompileCache({
      _format: CIRCUIT_COMPILE_CACHE_VERSION,
      files: {},
    });
  }

  constructor(private _compileCache: CompileCache) {}

  public async removeNonExistingFiles() {
    await Promise.all(
      Object.keys(this._compileCache.files).map(async (absolutePath) => {
        if (!(await fsExtra.pathExists(absolutePath))) {
          this.removeEntry(absolutePath);
        }
      }),
    );
  }

  public async writeToFile(solidityFilesCachePath: string) {
    await fsExtra.outputJson(solidityFilesCachePath, this._compileCache, {
      spaces: 2,
    });
  }

  public addFile(absolutePath: string, entry: CompileCacheEntry) {
    this._compileCache.files[absolutePath] = entry;
  }

  public getEntries(): CompileCacheEntry[] {
    return Object.values(this._compileCache.files);
  }

  public getEntry(file: string): CompileCacheEntry | undefined {
    return this._compileCache.files[file];
  }

  public removeEntry(file: string) {
    delete this._compileCache.files[file];
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

export let CircuitsCompileCache: BaseCircuitsCompileCache | null = null;

export async function createCircuitsCompileCache(circuitsCompileCachePath?: string) {
  if (CircuitsCompileCache) {
    return;
  }

  if (circuitsCompileCachePath) {
    CircuitsCompileCache = await BaseCircuitsCompileCache.readFromFile(circuitsCompileCachePath);
  } else {
    CircuitsCompileCache = BaseCircuitsCompileCache.createEmpty();
  }
}

/**
 * Used only in test environments to ensure test atomicity
 */
export function resetCircuitsCompileCache() {
  CircuitsCompileCache = null;
}
