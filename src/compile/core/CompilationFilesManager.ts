import os from "os";
import path from "path";
import fsExtra from "fs-extra";

import { HardhatConfig, ProjectPathsConfig } from "hardhat/types";
import { getAllFilesMatching } from "hardhat/internal/util/fs-utils";
import { localPathToSourceName } from "hardhat/utils/source-names";
import { ResolvedFile } from "hardhat/types/builtin-tasks";

import { FileFilterSettings, ZKitConfig } from "../../types/zkit-config";
import { CompileFlags, CompilationFilesManagerConfig, ResolvedFileInfo } from "../../types/compile";
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

  public async getResolvedFilesToCompile(compileFlags: CompileFlags, force: boolean): Promise<ResolvedFileInfo[]> {
    const circuitsSourcePaths: string[] = await getAllFilesMatching(this.getCircuitsDirFullPath(), (f) =>
      f.endsWith(".circom"),
    );

    const sourceNames: string[] = await this._getSourceNamesFromSourcePaths(circuitsSourcePaths);

    Reporter!.verboseLog("compilation-files-manager", "All circuits source names: %o", [sourceNames]);

    const dependencyGraph: DependencyGraph = await this._getDependencyGraph(sourceNames);

    let resolvedFilesInfoToCompile: ResolvedFileInfo[] = this._filterResolvedFiles(
      dependencyGraph.getResolvedFiles(),
      sourceNames,
      dependencyGraph,
    );

    Reporter!.verboseLog("compilation-files-manager", "All circuit source names to compile: %o", [
      resolvedFilesInfoToCompile.map((fileInfo) => fileInfo.resolvedFile.sourceName),
    ]);

    this._invalidateCacheMissingArtifacts(resolvedFilesInfoToCompile);

    if (!force) {
      Reporter!.verboseLog("compilation-files-manager", "Force flag disabled. Start filtering...");

      resolvedFilesInfoToCompile = resolvedFilesInfoToCompile.filter((fileInfo) =>
        this._needsCompilation(fileInfo, compileFlags),
      );
    }

    const filteredResolvedFilesInfo: ResolvedFileInfo[] = this._filterResolvedFilesToCompile(
      resolvedFilesInfoToCompile,
      this._zkitConfig.compilationSettings,
    );

    const filteredResolvedFilesToCompile: ResolvedFile[] = filteredResolvedFilesInfo.map((file) => file.resolvedFile);

    Reporter!.verboseLog("compilation-files-manager", "Filtered circuit source names to compile: %o", [
      filteredResolvedFilesToCompile.map((file) => file.sourceName),
    ]);
    Reporter!.reportCircuitListToCompile(
      resolvedFilesInfoToCompile.map((file) => file.resolvedFile),
      filteredResolvedFilesToCompile,
    );

    return filteredResolvedFilesInfo;
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
      return path.join(os.homedir(), ".zkit", "ptau");
    }
  }

  protected _filterResolvedFilesToCompile(
    resolvedFilesInfo: ResolvedFileInfo[],
    filterSettings: FileFilterSettings,
  ): ResolvedFileInfo[] {
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

    return resolvedFilesInfo.filter((fileInfo: ResolvedFileInfo) => {
      const circuitPath: string = fileInfo.resolvedFile.absolutePath;

      return (
        (filterSettings.onlyFiles.length == 0 || contains(circuitsRoot, filterSettings.onlyFiles, circuitPath)) &&
        !contains(circuitsRoot, filterSettings.skipFiles, circuitPath)
      );
    });
  }

  protected _filterResolvedFiles(
    resolvedFiles: ResolvedFile[],
    sourceNames: string[],
    dependencyGraph: DependencyGraph,
  ): ResolvedFileInfo[] {
    const resolvedFilesInfo: ResolvedFileInfo[] = [];

    for (const file of resolvedFiles) {
      const res = file.content.rawContent.matchAll(MAIN_COMPONENT_REG_EXP);
      const matches: string[] = [];

      for (const match of res) {
        matches.push(match[1]);
      }

      if (matches.length == 1 && sourceNames.includes(file.sourceName)) {
        resolvedFilesInfo.push({
          circuitName: matches[0],
          resolvedFile: file,
          dependencies: dependencyGraph.getTransitiveDependencies(file).map((dep) => dep.dependency),
        });
      } else if (matches.length > 1) {
        throw new HardhatZKitError(`Multiple definition of 'main component' in the file ${file.sourceName}.`);
      }
    }

    return resolvedFilesInfo;
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

  protected _getRemappings(): Record<string, string> {
    return {};
  }

  protected _invalidateCacheMissingArtifacts(resolvedFilesInfo: ResolvedFileInfo[]) {
    const circuitsDirFullPath = this.getCircuitsDirFullPath();
    const artifactsDirFullPath = this.getArtifactsDirFullPath();

    for (const fileInfo of resolvedFilesInfo) {
      const cacheEntry = CircomCircuitsCache!.getEntry(fileInfo.resolvedFile.absolutePath);

      if (cacheEntry === undefined) {
        continue;
      }

      if (!fsExtra.existsSync(fileInfo.resolvedFile.absolutePath.replace(circuitsDirFullPath, artifactsDirFullPath))) {
        CircomCircuitsCache!.removeEntry(fileInfo.resolvedFile.absolutePath);
      }
    }
  }

  protected _needsCompilation(resolvedFileInfo: ResolvedFileInfo, compileFlags: CompileFlags): boolean {
    for (const file of [resolvedFileInfo.resolvedFile, ...resolvedFileInfo.dependencies]) {
      const hasChanged = CircomCircuitsCache!.hasFileChanged(file.absolutePath, file.contentHash, compileFlags);

      if (hasChanged) {
        return true;
      }
    }

    return false;
  }
}
