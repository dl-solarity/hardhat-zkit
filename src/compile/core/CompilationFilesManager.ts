import os from "os";
import path from "path";
import fsExtra from "fs-extra";

import { HardhatConfig, ProjectPathsConfig } from "hardhat/types";
import { getAllFilesMatching } from "hardhat/internal/util/fs-utils";
import { localPathToSourceName } from "hardhat/utils/source-names";
import { ResolvedFile } from "hardhat/types/builtin-tasks";

import { FileFilterSettings, ZKitConfig } from "../../types/zkit-config";
import { CompileFlags, CompilationFilesManagerConfig, ResolvedFileWithDependencies } from "../../types/compile";
import { DependencyGraph, Parser, Resolver } from "../dependencies";
import { CircomCircuitsCache } from "../../cache/CircomCircuitsCache";

import { getNormalizedFullPath } from "../../utils/path-utils";
import { MAIN_COMPONENT_REG_EXP } from "../../constants";
import { HardhatZKitError } from "../../errors";
import { Reporter } from "../../reporter/Reporter";

export class CompilationFilesManager {
  private readonly _zkitConfig: ZKitConfig;
  private readonly _projectPaths: ProjectPathsConfig;

  constructor(
    private readonly _config: CompilationFilesManagerConfig,
    private readonly _readFile: (absolutePath: string) => Promise<string>,
    hardhatConfig: HardhatConfig,
  ) {
    this._zkitConfig = hardhatConfig.zkit;
    this._projectPaths = hardhatConfig.paths;
  }

  public async getResolvedFilesToCompile(
    compileFlags: CompileFlags,
    force: boolean,
    quiet: boolean = true,
  ): Promise<ResolvedFileWithDependencies[]> {
    const circuitsSourcePaths: string[] = await getAllFilesMatching(this.getCircuitsDirFullPath(), (f) =>
      f.endsWith(".circom"),
    );

    const filteredCircuitsSourcePaths: string[] = this._filterSourcePaths(
      circuitsSourcePaths,
      this._zkitConfig.compilationSettings,
    );

    const sourceNames: string[] = await this._getSourceNamesFromSourcePaths(filteredCircuitsSourcePaths);

    const dependencyGraph: DependencyGraph = await this._getDependencyGraph(sourceNames);

    const resolvedFilesToCompile: ResolvedFile[] = this._filterResolvedFiles(
      dependencyGraph.getResolvedFiles(),
      sourceNames,
      true,
    );

    this._validateResolvedFiles(resolvedFilesToCompile);
    this._invalidateCacheMissingArtifacts(resolvedFilesToCompile);

    let resolvedFilesWithDependencies: ResolvedFileWithDependencies[] = [];

    for (const file of resolvedFilesToCompile) {
      resolvedFilesWithDependencies.push({
        resolvedFile: file,
        dependencies: dependencyGraph.getTransitiveDependencies(file).map((dep) => dep.dependency),
      });
    }

    if (!force) {
      resolvedFilesWithDependencies = resolvedFilesWithDependencies.filter((file) =>
        this._needsCompilation(file, compileFlags),
      );
    }

    if (!quiet) {
      Reporter!.reportCircuitsListToCompile(
        resolvedFilesToCompile,
        resolvedFilesWithDependencies.map((file) => file.resolvedFile),
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

  protected _filterSourcePaths(sourcePaths: string[], filterSettings: FileFilterSettings): string[] {
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

  protected _filterResolvedFiles(
    resolvedFiles: ResolvedFile[],
    sourceNames: string[],
    withMainComponent: boolean,
  ): ResolvedFile[] {
    return resolvedFiles.filter((file: ResolvedFile) => {
      return (!withMainComponent || this._hasMainComponent(file)) && sourceNames.includes(file.sourceName);
    });
  }

  protected async _getSourceNamesFromSourcePaths(sourcePaths: string[]): Promise<string[]> {
    return Promise.all(sourcePaths.map((p) => localPathToSourceName(this._projectPaths.root, p)));
  }

  protected async _getDependencyGraph(sourceNames: string[]): Promise<DependencyGraph> {
    const parser = new Parser();
    const remappings = this._getRemappings();
    const resolver = new Resolver(this._projectPaths.root, parser, remappings, this._readFile);

    const resolvedFiles = await Promise.all(sourceNames.map((sn) => resolver.resolveSourceName(sn)));

    return DependencyGraph.createFromResolvedFiles(resolver, resolvedFiles);
  }

  protected _hasMainComponent(resolvedFile: ResolvedFile): boolean {
    return new RegExp(MAIN_COMPONENT_REG_EXP).test(resolvedFile.content.rawContent);
  }

  protected _getRemappings(): Record<string, string> {
    return {};
  }

  protected _validateResolvedFiles(resolvedFiles: ResolvedFile[]) {
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

  protected _invalidateCacheMissingArtifacts(resolvedFiles: ResolvedFile[]) {
    const circuitsDirFullPath = this.getCircuitsDirFullPath();
    const artifactsDirFullPath = this.getArtifactsDirFullPath();

    for (const file of resolvedFiles) {
      const cacheEntry = CircomCircuitsCache!.getEntry(file.absolutePath);

      if (cacheEntry === undefined) {
        continue;
      }

      if (!fsExtra.existsSync(file.absolutePath.replace(circuitsDirFullPath, artifactsDirFullPath))) {
        CircomCircuitsCache!.removeEntry(file.absolutePath);
      }
    }
  }

  protected _needsCompilation(
    resolvedFilesWithDependencies: ResolvedFileWithDependencies,
    compileFlags: CompileFlags,
  ): boolean {
    for (const file of [resolvedFilesWithDependencies.resolvedFile, ...resolvedFilesWithDependencies.dependencies]) {
      const hasChanged = CircomCircuitsCache!.hasFileChanged(file.absolutePath, file.contentHash, compileFlags);

      if (hasChanged) {
        return true;
      }
    }

    return false;
  }
}
