import { ResolvedFile } from "hardhat/types/builtin-tasks";

import { CompilationFilesManager } from "../../../../src/compile/core";
import { DependencyGraph } from "../../../../src/compile/dependencies";
import { FileFilterSettings } from "../../../../src/types/zkit-config";
import { CompileFlags, ResolvedFileWithDependencies } from "../../../../src/types/compile";

export class CompilationFilesManagerMock extends CompilationFilesManager {
  public filterSourcePaths(
    resolvedFilesWithDependencies: ResolvedFileWithDependencies[],
    filterSettings: FileFilterSettings,
  ): ResolvedFileWithDependencies[] {
    return this._filterResolvedFilesToCompile(resolvedFilesWithDependencies, filterSettings);
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

  public async getDependencyGraph(sourceNames: string[]): Promise<DependencyGraph> {
    return this._getDependencyGraph(sourceNames);
  }

  public hasMainComponent(resolvedFile: ResolvedFile): boolean {
    return this._hasMainComponent(resolvedFile);
  }

  public validateResolvedFiles(resolvedFiles: ResolvedFile[]) {
    this._validateResolvedFiles(resolvedFiles);
  }

  public invalidateCacheMissingArtifacts(resolvedFiles: ResolvedFile[]) {
    return this._invalidateCacheMissingArtifacts(resolvedFiles);
  }

  public needsCompilation(
    resolvedFilesWithDependencies: ResolvedFileWithDependencies,
    compileFlags: CompileFlags,
  ): boolean {
    return this._needsCompilation(resolvedFilesWithDependencies, compileFlags);
  }
}
