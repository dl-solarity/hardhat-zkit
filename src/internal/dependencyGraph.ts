import * as taskTypes from "hardhat/types/builtin-tasks";

import { ResolvedFile, Resolver } from "./Resolver";
import { HardhatError } from "hardhat/internal/core/errors";
import { ERRORS } from "hardhat/internal/core/errors-list";

export class DependencyGraph {
  public static async createFromResolvedFiles(
    resolver: Resolver,
    resolvedFiles: ResolvedFile[],
  ): Promise<DependencyGraph> {
    const graph = new DependencyGraph();

    // TODO refactor this to make the results deterministic
    await Promise.all(resolvedFiles.map((resolvedFile) => graph._addDependenciesFrom(resolver, resolvedFile)));

    return graph;
  }

  private _resolvedFiles = new Map<string, ResolvedFile>();
  private _dependenciesPerFile = new Map<string, Set<ResolvedFile>>();

  // map absolute paths to source names
  private readonly _visitedFiles = new Map<string, string>();

  private constructor() {}

  public getResolvedFiles(): ResolvedFile[] {
    return Array.from(this._resolvedFiles.values());
  }

  public has(file: ResolvedFile): boolean {
    return this._resolvedFiles.has(file.sourceName);
  }

  public isEmpty(): boolean {
    return this._resolvedFiles.size === 0;
  }

  public entries(): Array<[ResolvedFile, Set<ResolvedFile>]> {
    return Array.from(this._dependenciesPerFile.entries()).map(([key, value]) => [
      this._resolvedFiles.get(key)!,
      value,
    ]);
  }

  public getDependencies(file: ResolvedFile): ResolvedFile[] {
    const dependencies = this._dependenciesPerFile.get(file.sourceName) ?? new Set();

    return [...dependencies];
  }

  public getTransitiveDependencies(file: ResolvedFile): taskTypes.TransitiveDependency[] {
    const visited = new Set<ResolvedFile>();

    const transitiveDependencies = this._getTransitiveDependencies(file, visited, []);

    return [...transitiveDependencies];
  }

  private _getTransitiveDependencies(
    file: ResolvedFile,
    visited: Set<ResolvedFile>,
    path: ResolvedFile[],
  ): Set<taskTypes.TransitiveDependency> {
    if (visited.has(file)) {
      return new Set();
    }
    visited.add(file);

    const directDependencies: taskTypes.TransitiveDependency[] = this.getDependencies(file).map((dependency) => ({
      dependency,
      path,
    }));

    const transitiveDependencies = new Set<taskTypes.TransitiveDependency>(directDependencies);

    for (const { dependency } of transitiveDependencies) {
      this._getTransitiveDependencies(dependency, visited, path.concat(dependency)).forEach((x) =>
        transitiveDependencies.add(x),
      );
    }

    return transitiveDependencies;
  }

  private async _addDependenciesFrom(resolver: Resolver, file: ResolvedFile): Promise<void> {
    const sourceName = this._visitedFiles.get(file.absolutePath);

    if (sourceName !== undefined) {
      if (sourceName !== file.sourceName) {
        throw new HardhatError(ERRORS.RESOLVER.AMBIGUOUS_SOURCE_NAMES, {
          sourcenames: `'${sourceName}' and '${file.sourceName}'`,
          file: file.absolutePath,
        });
      }

      return;
    }

    this._visitedFiles.set(file.absolutePath, file.sourceName);

    const dependencies = new Set<ResolvedFile>();

    this._resolvedFiles.set(file.sourceName, file);
    this._dependenciesPerFile.set(file.sourceName, dependencies);

    // TODO refactor this to make the results deterministic
    await Promise.all(
      file.content.imports.map(async (imp) => {
        const dependency = await resolver.resolveImport(file, imp);
        dependencies.add(dependency);

        await this._addDependenciesFrom(resolver, dependency);
      }),
    );
  }
}
