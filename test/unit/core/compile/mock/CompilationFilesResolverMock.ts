import { CompilationFilesResolver } from "../../../../../src/core/compile/CompilationFilesResolver.js";
import { CircomFilesResolver, CircomResolvedFile } from "../../../../../src/core/resolve/CircomFilesResolver.js";
import { DependencyGraph } from "../../../../../src/core/resolve/DependencyGraph.js";
import { CircomResolvedFileInfo } from "../../../../../src/types/core/compile/compilation-files-resolver.js";
import { CompileFlags } from "../../../../../src/types/core/compiler/circom-compiler.js";

export class CompilationFilesResolverMock extends CompilationFilesResolver {
  public filterResolvedFiles(
    resolvedFiles: CircomResolvedFile[],
    sourceNames: string[],
    dependencyGraph: DependencyGraph,
  ): CircomResolvedFileInfo[] {
    return this._filterResolvedFilesWithMainComponent(resolvedFiles, sourceNames, dependencyGraph);
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
