import fsExtra from "fs-extra";
import { isEqual } from "lodash";

import { CompileCacheSchema } from "./schemas";
import { CIRCUIT_COMPILE_CACHE_VERSION } from "../constants";

import { CompileCache, CompileCacheEntry } from "../types/cache";
import { CompileFlags } from "../types/core";
import { Reporter } from "../reporter";

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
      cacheRaw = await fsExtra.readJson(circuitsCompileCachePath, {
        reviver: (_key: string, value: any): any => {
          if (value != null && typeof value === "object" && "__bigintval__" in value) {
            return BigInt(value["__bigintval__"]);
          }

          return value;
        },
      });
    }

    const result = CompileCacheSchema.safeParse(cacheRaw);

    if (result.success) {
      const circuitsCompileCache = new BaseCircuitsCompileCache(result.data);
      await circuitsCompileCache.removeNonExistingFiles();

      return circuitsCompileCache;
    } else {
      Reporter!.verboseLog("circuits-compile-cache", "Errors during ZOD schema parsing: %o", [result.error]);
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

  public async writeToFile(circuitsCompileCachePath: string) {
    fsExtra.writeFileSync(
      circuitsCompileCachePath,
      JSON.stringify(this._compileCache, (_key, value) => {
        if (typeof value === "bigint") {
          return { __bigintval__: value.toString() };
        }

        return value;
      }),
    );
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
