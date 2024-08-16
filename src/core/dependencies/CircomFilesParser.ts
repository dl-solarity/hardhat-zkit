import { getCircomParser, ParserError } from "@distributed-lab/circom-parser";

import { CircomFilesVisitor } from "./CircomFilesVisitor";
import { CircomFileData } from "../../types/core";
import { CircuitsCompileCache } from "../../cache";

export class CircomFilesParser {
  private _cache = new Map<string, CircomFileData>();

  public parse(fileContent: string, absolutePath: string, contentHash: string): CircomFileData {
    const cacheResult = this._getFromCache(absolutePath, contentHash);

    if (cacheResult !== null) {
      return cacheResult;
    }

    const { parser, errorListener } = getCircomParser(fileContent);

    const circomFilesVisitor = new CircomFilesVisitor();

    circomFilesVisitor.visit(parser.circuit());

    if (errorListener.hasErrors()) {
      throw new ParserError(errorListener.getErrors());
    }

    this._cache.set(contentHash, circomFilesVisitor.fileData);

    return circomFilesVisitor.fileData;
  }

  private _getFromCache(absolutePath: string, contentHash: string): CircomFileData | null {
    const internalCacheEntry = this._cache.get(contentHash);

    if (internalCacheEntry !== undefined) {
      return internalCacheEntry;
    }

    const circuitsFilesCacheEntry = CircuitsCompileCache!.getEntry(absolutePath);

    if (circuitsFilesCacheEntry === undefined) {
      return null;
    }

    if (circuitsFilesCacheEntry.contentHash !== contentHash) {
      return null;
    }

    return circuitsFilesCacheEntry.fileData;
  }
}
