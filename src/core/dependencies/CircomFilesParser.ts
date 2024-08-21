import { getCircomParser, ParserError, MainComponent, BigIntOrNestedArray } from "@distributed-lab/circom-parser";

import { CircomFilesVisitor } from "./CircomFilesVisitor";
import { CircomTemplateInputsVisitor } from "./CircomTemplateInputsVisitor";
import { CircuitsCompileCache } from "../../cache";
import { Reporter } from "../../reporter";

import { InputData, ResolvedFileData } from "../../types/core";

export class CircomFilesParser {
  private _cache = new Map<string, ResolvedFileData>();
  private _mainComponentsCache = new Map<string, MainComponent>();

  public parse(fileContent: string, absolutePath: string, contentHash: string): ResolvedFileData {
    const cacheResult = this._getFromCache(absolutePath, contentHash);

    if (cacheResult !== null) {
      return cacheResult;
    }

    const parser = getCircomParser(fileContent);

    const circomFilesVisitor = new CircomFilesVisitor();

    Reporter!.verboseLog("circom-files-parser", "Parsing '%s' file", [absolutePath]);

    const context = parser.circuit();

    if (parser.hasAnyErrors()) {
      throw new ParserError(parser.getAllErrors());
    }

    circomFilesVisitor.visit(context);

    this._cache.set(contentHash, { parsedFileData: circomFilesVisitor.fileData });

    return { parsedFileData: circomFilesVisitor.fileData };
  }

  public parseTemplateInputs(
    absolutePath: string,
    templateName: string,
    parameterValues: Record<string, BigIntOrNestedArray>,
  ): Record<string, InputData> {
    const parser = getCircomParser(absolutePath);

    const circomTemplateInputsVisitor = new CircomTemplateInputsVisitor(templateName, parameterValues);

    const context = parser.circuit();

    if (parser.hasAnyErrors()) {
      throw new ParserError(parser.getAllErrors());
    }

    circomTemplateInputsVisitor.visit(context);

    return circomTemplateInputsVisitor.templateInputs;
  }

  public getMainComponentInfo(absolutePath: string): MainComponent | undefined {
    return this._mainComponentsCache.get(absolutePath);
  }

  private _getFromCache(absolutePath: string, contentHash: string): ResolvedFileData | null {
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
