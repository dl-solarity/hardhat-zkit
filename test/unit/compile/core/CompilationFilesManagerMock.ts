import { ResolvedFile } from "hardhat/types/builtin-tasks";

import { CompilationFilesManager } from "../../../../src/compile/core";
import { DependencyGraph } from "../../../../src/compile/dependencies";
import { CircomCircuitsCache } from "../../../../src/cache/CircomCircuitsCache";
import { FileFilterSettings } from "../../../../src/types/zkit-config";
import { CompileFlags, ResolvedFileWithDependencies } from "../../../../src/types/compile";

export class CompilationFilesManagerMock extends CompilationFilesManager {
  public filterSourcePaths(sourcePaths: string[], filterSettings: FileFilterSettings): string[] {
    return this._filterSourcePaths(sourcePaths, filterSettings);
  }

  public filterResolvedFiles(
    resolvedFiles: ResolvedFile[],
    sourceNames: string[],
    withMainComponent: boolean,
  ): ResolvedFile[] {
    return this._filterResolvedFiles(resolvedFiles, sourceNames, withMainComponent);
  }

  public async getSourceNamesFromSourcePaths(sourcePaths: string[]): Promise<string[]> {
    return this._getSourceNamesFromSourcePaths(sourcePaths);
  }

  public async getDependencyGraph(
    sourceNames: string[],
    circuitFilesCache: CircomCircuitsCache,
  ): Promise<DependencyGraph> {
    return this._getDependencyGraph(sourceNames, circuitFilesCache);
  }

  public hasMainComponent(resolvedFile: ResolvedFile): boolean {
    return this._hasMainComponent(resolvedFile);
  }

  public validateResolvedFiles(resolvedFiles: ResolvedFile[]) {
    this._validateResolvedFiles(resolvedFiles);
  }

  public invalidateCacheMissingArtifacts(
    solidityFilesCache: CircomCircuitsCache,
    resolvedFiles: ResolvedFile[],
  ): CircomCircuitsCache {
    return this._invalidateCacheMissingArtifacts(solidityFilesCache, resolvedFiles);
  }

  public needsCompilation(
    resolvedFilesWithDependencies: ResolvedFileWithDependencies,
    cache: CircomCircuitsCache,
    compileFlags: CompileFlags,
  ): boolean {
    return this._needsCompilation(resolvedFilesWithDependencies, cache, compileFlags);
  }
}
