import { getCircomParser, ParserError } from "@distributed-lab/circom-parser";

import { CircomFilesVisitor } from "./CircomFilesVisitor";
import { CircomFileData } from "../../types/core";

export class CircomFilesParser {
  private _cache = new Map<string, CircomFileData>();

  public parse(fileContent: string, absolutePath: string, contentHash: string): CircomFileData {
    const cacheResult = this._getFromCache(contentHash);

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

  private _getFromCache(contentHash: string): CircomFileData | null {
    const internalCacheEntry = this._cache.get(contentHash);

    if (internalCacheEntry !== undefined) {
      return internalCacheEntry;
    }

    return null;
  }
}
