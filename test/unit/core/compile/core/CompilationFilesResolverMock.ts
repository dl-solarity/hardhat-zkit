import { CircomFilesResolver, CompilationFilesResolver, DependencyGraph } from "../../../../../src/core";
import { CompileFlags, CircomResolvedFileInfo, CircomResolvedFile } from "../../../../../src/types/core";

export class CompilationFilesResolverMock extends CompilationFilesResolver {
  public filterResolvedFiles(
    resolvedFiles: CircomResolvedFile[],
    sourceNames: string[],
    dependencyGraph: DependencyGraph,
  ): CircomResolvedFileInfo[] {
    return this._filterResolvedFiles(resolvedFiles, sourceNames, dependencyGraph);
  }

  public getCircuitsDirFullPath(): string {
    return this._getCircuitsDirFullPath();
  }

  public async getSourceNamesFromSourcePaths(sourcePaths: string[]): Promise<string[]> {
    return this._getSourceNamesFromSourcePaths(sourcePaths);
  }

  public async getDependencyGraph(sourceNames: string[], resolver: CircomFilesResolver): Promise<DependencyGraph> {
    return this._getDependencyGraph(sourceNames, resolver);
  }

  public async invalidateCacheMissingArtifacts(resolvedFilesInfo: CircomResolvedFileInfo[]) {
    return this._invalidateCacheMissingArtifacts(resolvedFilesInfo);
  }

  public needsCompilation(resolvedFileInfo: CircomResolvedFileInfo, compileFlags: CompileFlags): boolean {
    return this._needsCompilation(resolvedFileInfo, compileFlags);
  }
}
