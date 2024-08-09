import { HardhatConfig } from "hardhat/types";
import { ResolvedFile } from "hardhat/types/builtin-tasks";
import { getAllFilesMatching } from "hardhat/internal/util/fs-utils";
import { localPathToSourceName } from "hardhat/utils/source-names";

import { DependencyGraph, Parser, Resolver } from "../dependencies";
import { MAIN_COMPONENT_REG_EXP } from "../../constants";
import { HardhatZKitError } from "../../errors";
import { CircuitsCompileCache } from "../../cache";
import { Reporter } from "../../reporter/Reporter";
import { filterCircuitFiles, getNormalizedFullPath } from "../../utils/path-utils";

import { ZKitConfig } from "../../types/zkit-config";
import { ICircuitArtifacts } from "../../types/artifacts/circuit-artifacts";
import { CompileFlags, ResolvedFileInfo } from "../../types/core";

export class CompilationFilesResolver {
  private readonly _zkitConfig: ZKitConfig;
  private readonly _projectRoot: string;

  constructor(
    private readonly _readFile: (absolutePath: string) => Promise<string>,
    private readonly _circuitArtifacts: ICircuitArtifacts,
    hardhatConfig: HardhatConfig,
  ) {
    this._zkitConfig = hardhatConfig.zkit;
    this._projectRoot = hardhatConfig.paths.root;
  }

  public async getResolvedFilesToCompile(compileFlags: CompileFlags, force: boolean): Promise<ResolvedFileInfo[]> {
    const circuitsSourcePaths: string[] = await getAllFilesMatching(this._getCircuitsDirFullPath(), (f) =>
      f.endsWith(".circom"),
    );

    const sourceNames: string[] = await this._getSourceNamesFromSourcePaths(circuitsSourcePaths);

    Reporter!.verboseLog("compilation-file-resolver", "All circuit source names: %o", [sourceNames]);

    const allFilteredSourceNames: string[] = filterCircuitFiles<string>(
      sourceNames,
      this._getCircuitsDirFullPath(),
      this._zkitConfig.compilationSettings,
      (sourceName: string): string => {
        return getNormalizedFullPath(this._projectRoot, sourceName);
      },
    );

    Reporter!.verboseLog("compilation-file-resolver", "All filtered circuit source names: %o", [
      allFilteredSourceNames,
    ]);

    const dependencyGraph: DependencyGraph = await this._getDependencyGraph(allFilteredSourceNames);

    const resolvedFilesInfoToCompile: ResolvedFileInfo[] = this._filterResolvedFiles(
      dependencyGraph.getResolvedFiles(),
      allFilteredSourceNames,
      dependencyGraph,
    );

    Reporter!.verboseLog("compilation-file-resolver", "All circuit source names to compile: %o", [
      resolvedFilesInfoToCompile.map((fileInfo) => fileInfo.resolvedFile.sourceName),
    ]);

    this._invalidateCacheMissingArtifacts(resolvedFilesInfoToCompile);

    let filteredResolvedFilesInfo: ResolvedFileInfo[];

    if (!force) {
      Reporter!.verboseLog("compilation-file-resolver", "Force flag disabled. Start filtering...");

      filteredResolvedFilesInfo = resolvedFilesInfoToCompile.filter((fileInfo) =>
        this._needsCompilation(fileInfo, compileFlags),
      );
    } else {
      filteredResolvedFilesInfo = resolvedFilesInfoToCompile;
    }

    const filteredSourceNamesToCompile: string[] = filteredResolvedFilesInfo.map(
      (file) => file.resolvedFile.sourceName,
    );

    Reporter!.verboseLog("compilation-file-resolver", "Filtered circuit source names to compile: %o", [
      filteredSourceNamesToCompile,
    ]);
    Reporter!.reportCircuitListToCompile(
      resolvedFilesInfoToCompile.map((file) => file.resolvedFile.sourceName),
      filteredSourceNamesToCompile,
    );

    return filteredResolvedFilesInfo;
  }

  protected _getCircuitsDirFullPath(): string {
    return getNormalizedFullPath(this._projectRoot, this._zkitConfig.circuitsDir);
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
          circuitFullyQualifiedName: this._circuitArtifacts.getCircuitFullyQualifiedName(file.sourceName, matches[0]),
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
    return Promise.all(sourcePaths.map((p) => localPathToSourceName(this._projectRoot, p)));
  }

  protected async _getDependencyGraph(sourceNames: string[]): Promise<DependencyGraph> {
    const parser = new Parser();
    const resolver = new Resolver(this._projectRoot, parser, this._readFile);

    const resolvedFiles = await Promise.all(sourceNames.map((sn) => resolver.resolveSourceName(sn)));

    return DependencyGraph.createFromResolvedFiles(resolver, resolvedFiles);
  }

  protected async _invalidateCacheMissingArtifacts(resolvedFilesInfo: ResolvedFileInfo[]) {
    for (const fileInfo of resolvedFilesInfo) {
      const cacheEntry = CircuitsCompileCache!.getEntry(fileInfo.resolvedFile.absolutePath);

      if (cacheEntry === undefined) {
        continue;
      }

      if (
        !(await this._circuitArtifacts.circuitArtifactExists(
          this._circuitArtifacts.getCircuitFullyQualifiedName(fileInfo.resolvedFile.sourceName, fileInfo.circuitName),
        ))
      ) {
        CircuitsCompileCache!.removeEntry(fileInfo.resolvedFile.absolutePath);
      }
    }
  }

  protected _needsCompilation(resolvedFileInfo: ResolvedFileInfo, compileFlags: CompileFlags): boolean {
    for (const file of [resolvedFileInfo.resolvedFile, ...resolvedFileInfo.dependencies]) {
      const hasChanged = CircuitsCompileCache!.hasFileChanged(file.absolutePath, file.contentHash, compileFlags);

      if (hasChanged) {
        return true;
      }
    }

    return false;
  }
}
