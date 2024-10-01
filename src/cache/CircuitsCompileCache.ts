import fsExtra from "fs-extra";
import { isEqual } from "lodash";

import { CompileCacheSchema } from "./schemas";
import { CIRCUIT_COMPILE_CACHE_VERSION } from "../constants";

import { CompileCache, CompileCacheEntry } from "../types/cache";
import { CompileFlags } from "../types/core";
import { Reporter } from "../reporter";

/**
 * Class that implements the caching logic for compiling circuits.
 *
 * This class is responsible for managing the cache of compiled circuit information,
 * optimizing the compilation process by storing previously compiled data.
 * It allows for a feature that avoids recompiling circuits that have not changed
 * since the last compilation, significantly reducing unnecessary compilation overhead.
 *
 * The class provides methods to clear, disable, and retrieve cached artifacts,
 * ensuring that only up-to-date and relevant information is used during compilation.
 *
 * The caching mechanism enhances performance and efficiency, especially when dealing
 * with large and complex circuit designs by minimizing redundant compilation efforts.
 */
class BaseCircuitsCompileCache {
  /**
   * Creates an instance of {@link BaseCircuitsCompileCache} with empty cache data
   *
   * @returns An instance of {@link BaseCircuitsCompileCache} initialized with empty cache data
   */
  public static createEmpty(): BaseCircuitsCompileCache {
    return new BaseCircuitsCompileCache({
      _format: CIRCUIT_COMPILE_CACHE_VERSION,
      files: {},
    });
  }

  /**
   * Creates an instance of {@link BaseCircuitsCompileCache} using the data read from the specified cache file
   *
   * @param circuitsCompileCachePath The full path to the compile cache file from which to read the data
   * @returns A promise that resolves to an instance of {@link BaseCircuitsCompileCache} populated with the read data
   */
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

    // Validate the correctness of the data read from the file using the Zod schema
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

  /**
   * Removes cache entries for files that no longer exist.
   *
   * This method helps keep the cache up-to-date by deleting references
   * to non-existent files, ensuring that the cache remains valid.
   */
  public async removeNonExistingFiles() {
    await Promise.all(
      Object.keys(this._compileCache.files).map(async (absolutePath) => {
        if (!(await fsExtra.pathExists(absolutePath))) {
          this.removeEntry(absolutePath);
        }
      }),
    );
  }

  /**
   * Writes the current cache state to the specified file
   *
   * @param circuitsCompileCachePath The full path to the compile cache file where the cache will be saved
   */
  public async writeToFile(circuitsCompileCachePath: string) {
    fsExtra.outputFileSync(
      circuitsCompileCachePath,
      JSON.stringify(this._compileCache, (_key, value) => {
        if (typeof value === "bigint") {
          return { __bigintval__: value.toString() };
        }

        return value;
      }),
    );
  }

  /**
   * Adds a file cache entry to the cache data using the specified absolute path
   *
   * @param absolutePath The absolute path to the circuit file
   * @param entry The cache entry to be added for the specified file path
   */
  public addFile(absolutePath: string, entry: CompileCacheEntry) {
    this._compileCache.files[absolutePath] = entry;
  }

  /**
   * Returns all stored cache entries
   *
   * @returns An array of all stored cache entries
   */
  public getEntries(): CompileCacheEntry[] {
    return Object.values(this._compileCache.files);
  }

  /**
   * Returns the cache entry for the specified file path, or undefined if no entry exists
   *
   * @param file The absolute path to the circuit file
   * @returns The stored cache entry or undefined if no entry is found
   */
  public getEntry(file: string): CompileCacheEntry | undefined {
    return this._compileCache.files[file];
  }

  /**
   * Removes the cache entry for the specified file path from the cache
   *
   * @param file The absolute path to the circuit file
   */
  public removeEntry(file: string) {
    delete this._compileCache.files[file];
  }

  /**
   * Checks if the specified file has changed since the last check based on its content hash and compile flags.
   *
   * This method compares the current state of the file, identified by its absolute path,
   * with the provided content hash and compile flags. If any of these values differ from
   * what was recorded previously, the method returns true, indicating that the file has
   * been modified. Otherwise, it returns false.
   *
   * @param absolutePath The absolute path of the file to compare
   * @param contentHash The hash of the file content for comparison, used to detect changes
   * @param compileFlags The {@link CompileFlags | compile flags} for comparison, which may affect the file's state
   * @returns True if the file has changed since the last check, false otherwise
   */
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

/**
 * Singleton object that serves as the cache for compilation information related to circuits.
 *
 * This cache holds the state of the compilation process and allows for efficient reuse
 * of previously compiled data, thereby avoiding unnecessary recompilation of unchanged circuits.
 *
 * To create and properly initialize this cache object, the {@link createCircuitsCompileCache}
 * function must be invoked. The cache can help improve performance and manage resources effectively
 * during circuit compilation.
 */
export let CircuitsCompileCache: BaseCircuitsCompileCache | null = null;

/**
 * Creates a singleton instance of the {@link BaseCircuitsCompileCache} class
 *
 * @param circuitsCompileCachePath The full path to the compile cache file
 */
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
 * @remark Used only in test environments to ensure test atomicity
 */
export function resetCircuitsCompileCache() {
  CircuitsCompileCache = null;
}
