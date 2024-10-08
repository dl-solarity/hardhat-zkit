import fsExtra from "fs-extra";

import { Reporter } from "../reporter";

import { BaseCacheSchema, BaseCacheType } from "../types/cache/base-cache";

/**
 * Generic class that manages a cache of file-related entries.
 *
 * This class is designed to manage a collection of cache entries for files, where each entry
 * holds metadata or other relevant data associated with a file. It offers functionality to add, retrieve,
 * and remove entries from the cache, as well as utilities to write the cache state to a file and clean
 * up stale entries for files that no longer exist on the filesystem.
 *
 * The cache operates on a single generic type:
 * - `T`: Represents the individual cache entry for each file, storing metadata or other details.
 *
 * Usage:
 * Extend this class and specify the appropriate cache entry type to implement specific caching logic.
 */
export class BaseCache<T> {
  private _cache!: BaseCacheType<T>;

  constructor(
    private _cacheVersion: string,
    private _cacheSchema: BaseCacheSchema,
    cachePath?: string,
  ) {
    if (cachePath) {
      this.readFromFile(cachePath);
    } else {
      this._cache = {
        _format: this._cacheVersion,
        files: {},
      };
    }
  }

  /**
   * Clears the current cache data, resetting it to an empty state.
   *
   * This method initializes the cache with the version format and an empty file collection.
   */
  public clearCache() {
    this._cache = {
      _format: this._cacheVersion,
      files: {},
    };
  }

  /**
   * Reads cache data from the specified file and populates the cache with the loaded data.
   *
   * This method attempts to read the cache file from the given `cachePath`. If the file exists, it parses
   * the content and validates it against the defined cache schema. If the data is valid, the cache is updated.
   * If the data is invalid, an error is logged using the Reporter.
   *
   * @param cachePath The full path to the cache file from which to read the data.
   */
  public readFromFile(cachePath: string) {
    let cacheRaw: BaseCacheType<T> = {
      _format: this._cacheVersion,
      files: {},
    };

    if (fsExtra.pathExistsSync(cachePath)) {
      cacheRaw = fsExtra.readJsonSync(cachePath, {
        reviver: (_key: string, value: any): any => {
          if (value != null && typeof value === "object" && "__bigintval__" in value) {
            return BigInt(value["__bigintval__"]);
          }

          return value;
        },
      });
    }

    // Validate the correctness of the data read from the file using the Zod schema
    const result = this._cacheSchema.safeParse(cacheRaw);

    if (result.success) {
      this._cache = result.data;
      this.removeNonExistingFiles();

      return;
    }

    this._cache = {
      _format: this._cacheVersion,
      files: {},
    };

    Reporter!.verboseLog("cache", "Errors during ZOD schema parsing: %o", [result.error]);
  }

  /**
   * Removes cache entries for files that no longer exist.
   *
   * This method helps keep the cache up-to-date by deleting references
   * to non-existent files, ensuring that the cache remains valid.
   */
  public removeNonExistingFiles() {
    Object.keys(this._cache.files).map((absolutePath) => {
      if (!fsExtra.pathExistsSync(absolutePath)) {
        this.removeEntry(absolutePath);
      }
    });
  }

  /**
   * Writes the current cache state to the specified file.
   *
   * @param cacheFilePath The full path to the cache file where the state will be written.
   */
  public async writeToFile(cacheFilePath: string) {
    const jsonContent = JSON.stringify(
      this._cache,
      (_key, value) => {
        if (typeof value === "bigint") {
          return { __bigintval__: value.toString() };
        }

        return value;
      },
      2,
    );

    await fsExtra.outputFile(cacheFilePath, jsonContent);
  }

  /**
   * Adds a file cache entry to the cache data using the specified absolute path
   *
   * @param absolutePath The absolute path to the circuit file
   * @param entry The cache entry to be added for the specified file path
   */
  public addFile(absolutePath: string, entry: T) {
    this._cache.files[absolutePath] = entry;
  }

  /**
   * Returns all stored cache entries
   *
   * @returns An array of all stored cache entries
   */
  public getEntries(): T[] {
    return Object.values(this._cache.files);
  }

  /**
   * Returns the cache entry for the specified file path, or undefined if no entry exists
   *
   * @param file The absolute path to the circuit file
   * @returns The stored cache entry or undefined if no entry is found
   */
  public getEntry(file: string): T | undefined {
    return this._cache.files[file];
  }

  /**
   * Removes the cache entry for the specified file path from the cache
   *
   * @param file The absolute path to the circuit file
   */
  public removeEntry(file: string) {
    delete this._cache.files[file];
  }
}
