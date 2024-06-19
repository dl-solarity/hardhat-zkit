import os from "os";
import path from "path";
import fsExtra from "fs-extra";

import { HardhatConfig, ProjectPathsConfig } from "hardhat/types";
import { getAllFilesMatching } from "hardhat/internal/util/fs-utils";
import { localPathToSourceName } from "hardhat/utils/source-names";

import { FileFilterSettings, ZKitConfig } from "../../types/zkit-config";
import { CompileFlags, CompilationFilesManagerConfig, ResolvedFileWithDependencies } from "../../types/compile";
import { CircomCircuitsCache, DependencyGraph, Parser, ResolvedFile, Resolver } from "../utils";

import { getNormalizedFullPath } from "../../utils/path-utils";
import { MAIN_COMPONENT_REG_EXP } from "../../constants";
import { HardhatZKitError } from "../../errors";

export class CompilationFilesManager {
  private readonly _zkitConfig: ZKitConfig;
  private readonly _projectPaths: ProjectPathsConfig;

  constructor(
    private readonly _config: CompilationFilesManagerConfig,
    private readonly _readFile: (absolutePath: string) => Promise<string>,
    private _circuitFilesCache: CircomCircuitsCache,
    hardhatConfig: HardhatConfig,
  ) {
    this._zkitConfig = hardhatConfig.zkit;
    this._projectPaths = hardhatConfig.paths;
  }

  public async getResolvedFilesToCompile(
    compileFlags: CompileFlags,
    force: boolean,
  ): Promise<ResolvedFileWithDependencies[]> {
    const circuitsSourcePaths: string[] = await getAllFilesMatching(this.getCircuitsDirFullPath(), (f) =>
      f.endsWith(".circom"),
    );

    const filteredCircuitsSourcePaths: string[] = this._filterSourcePaths(
      circuitsSourcePaths,
      this._zkitConfig.compilationSettings,
    );

    const sourceNames: string[] = await this._getSourceNamesFromSourcePaths(filteredCircuitsSourcePaths);

    const dependencyGraph: DependencyGraph = await this._getDependencyGraph(sourceNames, this._circuitFilesCache);

    const resolvedFilesToCompile: ResolvedFile[] = this._filterResolvedFiles(
      dependencyGraph.getResolvedFiles(),
      sourceNames,
      true,
    );

    this._validateResolvedFiles(resolvedFilesToCompile);
    this._invalidateCacheMissingArtifacts(this._circuitFilesCache, resolvedFilesToCompile);

    let resolvedFilesWithDependencies: ResolvedFileWithDependencies[] = [];

    for (const file of resolvedFilesToCompile) {
      resolvedFilesWithDependencies.push({
        resolvedFile: file,
        dependencies: dependencyGraph.getTransitiveDependencies(file).map((dep) => dep.dependency),
      });
    }

    if (!force) {
      resolvedFilesWithDependencies = resolvedFilesWithDependencies.filter((file) =>
        this._needsCompilation(file, this._circuitFilesCache, compileFlags),
      );
    }

    return resolvedFilesWithDependencies;
  }

  public getCircuitsDirFullPath(): string {
    return getNormalizedFullPath(this._projectPaths.root, this._zkitConfig.circuitsDir);
  }

  public getArtifactsDirFullPath(): string {
    return getNormalizedFullPath(
      this._projectPaths.root,
      this._config.artifactsDir ?? this._zkitConfig.compilationSettings.artifactsDir,
    );
  }

  public getPtauDirFullPath(): string {
    const ptauDir = this._config.ptauDir ?? this._zkitConfig.ptauDir;

    if (ptauDir) {
      return path.isAbsolute(ptauDir) ? ptauDir : getNormalizedFullPath(this._projectPaths.root, ptauDir);
    } else {
      return path.join(os.homedir(), ".zkit", ".ptau");
    }
  }

  private _filterSourcePaths(sourcePaths: string[], filterSettings: FileFilterSettings): string[] {
    const contains = (circuitsRoot: string, pathList: string[], source: any) => {
      const isSubPath = (parent: string, child: string) => {
        const parentTokens = parent.split(path.posix.sep).filter((i) => i.length);
        const childTokens = child.split(path.posix.sep).filter((i) => i.length);

        return parentTokens.every((t, i) => childTokens[i] === t);
      };

      return pathList.some((p: any) => {
        return isSubPath(getNormalizedFullPath(circuitsRoot, p), source);
      });
    };

    const circuitsRoot = this.getCircuitsDirFullPath();

    return sourcePaths.filter((sourceName: string) => {
      return (
        (filterSettings.onlyFiles.length == 0 || contains(circuitsRoot, filterSettings.onlyFiles, sourceName)) &&
        !contains(circuitsRoot, filterSettings.skipFiles, sourceName)
      );
    });
  }

  private _filterResolvedFiles(
    resolvedFiles: ResolvedFile[],
    sourceNames: string[],
    withMainComponent: boolean,
  ): ResolvedFile[] {
    return resolvedFiles.filter((file: ResolvedFile) => {
      return (!withMainComponent || this._hasMainComponent(file)) && sourceNames.includes(file.sourceName);
    });
  }

  private async _getSourceNamesFromSourcePaths(sourcePaths: string[]): Promise<string[]> {
    return Promise.all(sourcePaths.map((p) => localPathToSourceName(this._projectPaths.root, p)));
  }

  private async _getDependencyGraph(
    sourceNames: string[],
    circuitFilesCache: CircomCircuitsCache,
  ): Promise<DependencyGraph> {
    const parser = new Parser(circuitFilesCache);
    const remappings = this._getRemappings();
    const resolver = new Resolver(this._projectPaths.root, parser, remappings, this._readFile);

    const resolvedFiles = await Promise.all(sourceNames.map((sn) => resolver.resolveSourceName(sn)));

    return DependencyGraph.createFromResolvedFiles(resolver, resolvedFiles);
  }

  private _hasMainComponent(resolvedFile: ResolvedFile): boolean {
    return new RegExp(MAIN_COMPONENT_REG_EXP).test(resolvedFile.content.rawContent);
  }

  private _getRemappings(): Record<string, string> {
    return {};
  }

  private _validateResolvedFiles(resolvedFiles: ResolvedFile[]) {
    const circuitsNameCount = {} as Record<string, ResolvedFile>;

    resolvedFiles.forEach((file: ResolvedFile) => {
      const circuitName = path.parse(file.absolutePath).name;

      if (circuitsNameCount[circuitName]) {
        throw new HardhatZKitError(
          `Circuit ${file.sourceName} duplicated ${circuitsNameCount[circuitName].sourceName} circuit`,
        );
      }

      circuitsNameCount[circuitName] = file;
    });
  }

  private _invalidateCacheMissingArtifacts(solidityFilesCache: CircomCircuitsCache, resolvedFiles: ResolvedFile[]) {
    const circuitsDirFullPath = this.getCircuitsDirFullPath();
    const artifactsDirFullPath = this.getArtifactsDirFullPath();

    for (const file of resolvedFiles) {
      const cacheEntry = solidityFilesCache.getEntry(file.absolutePath);

      if (cacheEntry === undefined) {
        continue;
      }

      if (!fsExtra.existsSync(file.absolutePath.replace(circuitsDirFullPath, artifactsDirFullPath))) {
        solidityFilesCache.removeEntry(file.absolutePath);
      }
    }

    return solidityFilesCache;
  }

  private _needsCompilation(
    resolvedFilesWithDependencies: ResolvedFileWithDependencies,
    cache: CircomCircuitsCache,
    compileFlags: CompileFlags,
  ): boolean {
    for (const file of [resolvedFilesWithDependencies.resolvedFile, ...resolvedFilesWithDependencies.dependencies]) {
      const hasChanged = cache.hasFileChanged(file.absolutePath, file.contentHash, compileFlags);

      if (hasChanged) {
        return true;
      }
    }

    return false;
  }
}
