import fsExtra from "fs-extra";

import { BaseCacheType, BaseCacheEntry } from "@src/types/cache/base-cache";

/**
 * Generic class that manages a cache of file-related entries.
 *
 * This` class is designed to manage a collection of cache entries for files, where each entry
 * holds metadata or other relevant data associated with a file. It offers functionality to add, retrieve,
 * and remove entries from the cache, as well as utilities to write the cache state to a file and clean
 * up stale entries for files that no longer exist on the filesystem.
 *
 * The cache operates on two generic types:
 * - `T` extends `BaseCacheType`: Represents the structure of the cache, which includes a collection of files.
 * - `E` extends `BaseCacheEntry`: Represents the individual cache entry for each file, storing metadata or other details.
 *
 * Usage:
 * Extend this class and specify the appropriate cache and entry types to implement specific caching logic.
 */
export class BaseCache<T extends BaseCacheType, E extends BaseCacheEntry> {
  constructor(private _cache: T) {}

  /**
   * Removes cache entries for files that no longer exist.
   *
   * This method helps keep the cache up-to-date by deleting references
   * to non-existent files, ensuring that the cache remains valid.
   */
  public async removeNonExistingFiles() {
    await Promise.all(
      Object.keys(this._cache.files).map(async (absolutePath) => {
        if (!(await fsExtra.pathExists(absolutePath))) {
          this.removeEntry(absolutePath);
        }
      }),
    );
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
  public addFile(absolutePath: string, entry: E) {
    this._cache.files[absolutePath] = entry;
  }

  /**
   * Returns all stored cache entries
   *
   * @returns An array of all stored cache entries
   */
  public getEntries(): E[] {
    return Object.values(this._cache.files);
  }

  /**
   * Returns the cache entry for the specified file path, or undefined if no entry exists
   *
   * @param file The absolute path to the circuit file
   * @returns The stored cache entry or undefined if no entry is found
   */
  public getEntry(file: string): E | undefined {
    return this._cache.files[file] as E | undefined;
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
