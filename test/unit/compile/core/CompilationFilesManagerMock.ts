import { ResolvedFile } from "hardhat/types/builtin-tasks";

import { CompilationFilesResolver } from "../../../../src/compile/core";
import { DependencyGraph } from "../../../../src/compile/dependencies";
import { CompileFlags, ResolvedFileInfo } from "../../../../src/types/compile";

export class CompilationFilesManagerMock extends CompilationFilesResolver {
  public filterResolvedFiles(
    resolvedFiles: ResolvedFile[],
    sourceNames: string[],
    dependencyGraph: DependencyGraph,
  ): ResolvedFileInfo[] {
    return this._filterResolvedFiles(resolvedFiles, sourceNames, dependencyGraph);
  }

  public getCircuitsDirFullPath(): string {
    return this._getCircuitsDirFullPath();
  }

  public async getSourceNamesFromSourcePaths(sourcePaths: string[]): Promise<string[]> {
    return this._getSourceNamesFromSourcePaths(sourcePaths);
  }

  public async getDependencyGraph(sourceNames: string[]): Promise<DependencyGraph> {
    return this._getDependencyGraph(sourceNames);
  }

  public invalidateCacheMissingArtifacts(resolvedFilesInfo: ResolvedFileInfo[]) {
    return this._invalidateCacheMissingArtifacts(resolvedFilesInfo);
  }

  public needsCompilation(resolvedFileInfo: ResolvedFileInfo, compileFlags: CompileFlags): boolean {
    return this._needsCompilation(resolvedFileInfo, compileFlags);
  }
}
