import { isEqual } from "lodash";

import { CompileCacheSchema } from "./schemas";
import { CIRCUIT_COMPILE_CACHE_VERSION } from "../constants";

import { BaseCache } from "../cache/BaseCache";

import { CompileCacheEntry } from "../types/cache";
import { CompileFlags } from "../types/core";

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
class BaseCircuitsCompileCache extends BaseCache<CompileCacheEntry> {
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

  CircuitsCompileCache = new BaseCircuitsCompileCache(
    CIRCUIT_COMPILE_CACHE_VERSION,
    CompileCacheSchema,
    circuitsCompileCachePath,
  );
}

/**
 * @remark Used only in test environments to ensure test atomicity
 */
export function resetCircuitsCompileCache() {
  CircuitsCompileCache = null;
}
