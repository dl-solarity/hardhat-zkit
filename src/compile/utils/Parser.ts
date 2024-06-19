import { ParsedData } from "../../types/compile";

import { CircomCircuitsCache } from "./CircomCircuitsCache";
import { INCLUDE_REG_EXP, PRAGMA_VERSION_REG_EXP } from "../../constants";

export class Parser {
  private _cache = new Map<string, ParsedData>();
  private _circomCircuitsCache: CircomCircuitsCache;

  constructor(_circomCircuitsCache?: CircomCircuitsCache) {
    this._circomCircuitsCache = _circomCircuitsCache ?? CircomCircuitsCache.createEmpty();
  }

  public parse(fileContent: string, absolutePath: string, contentHash: string): ParsedData {
    const cacheResult = this._getFromCache(absolutePath, contentHash);

    if (cacheResult !== null) {
      return cacheResult;
    }

    const result: ParsedData = {
      imports: this._getImports(fileContent),
      versionPragmas: this._getPragmaVersions(fileContent),
    };

    this._cache.set(contentHash, result);

    return result;
  }

  private _getFromCache(absolutePath: string, contentHash: string): ParsedData | null {
    const internalCacheEntry = this._cache.get(contentHash);

    if (internalCacheEntry !== undefined) {
      return internalCacheEntry;
    }

    const circuitsFilesCacheEntry = this._circomCircuitsCache.getEntry(absolutePath);

    if (circuitsFilesCacheEntry === undefined) {
      return null;
    }

    const { imports, versionPragmas } = circuitsFilesCacheEntry;

    if (circuitsFilesCacheEntry.contentHash !== contentHash) {
      return null;
    }

    return { imports, versionPragmas };
  }

  private _getImports(fileContent: string): string[] {
    const imports: string[] = [];

    const res = fileContent.matchAll(INCLUDE_REG_EXP);

    for (const match of res) {
      imports.push(match[1]);
    }

    return imports;
  }

  private _getPragmaVersions(fileContent: string): string[] {
    const versions: string[] = [];

    const res = fileContent.matchAll(PRAGMA_VERSION_REG_EXP);

    for (const match of res) {
      versions.push(match[1]);
    }

    return versions;
  }
}
