import { HardhatConfig } from "hardhat/types";
import { getAllFilesMatching } from "hardhat/internal/util/fs-utils";
import { localPathToSourceName } from "hardhat/utils/source-names";

import { DependencyGraph, CircomFilesParser, CircomFilesResolver, CircomResolvedFile } from "../dependencies";
import { CircuitsCompileCache } from "../../cache";
import { Reporter } from "../../reporter/Reporter";
import { filterCircuitFiles, getNormalizedFullPath } from "../../utils/path-utils";

import { ZKitConfig } from "../../types/zkit-config";
import { ICircuitArtifacts } from "../../types/artifacts/circuit-artifacts";
import { CircomResolvedFileInfo, CompileFlags } from "../../types/core";

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

  public async getResolvedFilesToCompile(
    compileFlags: CompileFlags,
    force: boolean,
  ): Promise<CircomResolvedFileInfo[]> {
    const spinnerId: string | null = Reporter!.reportCircuitFilesResolvingStartWithSpinner();

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

    let resolvedFilesInfoToCompile: CircomResolvedFileInfo[];

    try {
      const resolver = new CircomFilesResolver(this._projectRoot, new CircomFilesParser(), this._readFile);
      const dependencyGraph: DependencyGraph = await this._getDependencyGraph(allFilteredSourceNames, resolver);

      resolvedFilesInfoToCompile = this._filterResolvedFiles(
        dependencyGraph.getResolvedFiles(),
        allFilteredSourceNames,
        dependencyGraph,
      );

      Reporter!.verboseLog("compilation-file-resolver", "All circuit source names to compile: %o", [
        resolvedFilesInfoToCompile.map((fileInfo) => fileInfo.resolvedFile.sourceName),
      ]);

      for (const fileInfo of resolvedFilesInfoToCompile) {
        await resolver.resolveMainComponentData(fileInfo.resolvedFile, fileInfo.dependencies);
      }

      this._invalidateCacheMissingArtifacts(resolvedFilesInfoToCompile);
    } catch (e) {
      Reporter!.reportCircuitFilesResolvingFail(spinnerId);

      throw e;
    }

    let filteredResolvedFilesInfo: CircomResolvedFileInfo[];

    if (!force) {
      Reporter!.verboseLog("compilation-file-resolver", "Force flag disabled. Start filtering...");

      filteredResolvedFilesInfo = resolvedFilesInfoToCompile.filter((fileInfo) =>
        this._needsCompilation(fileInfo, compileFlags),
      );
    } else {
      filteredResolvedFilesInfo = resolvedFilesInfoToCompile;
    }

    Reporter!.reportCircuitFilesResolvingResult(spinnerId);

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
    circomResolvedFiles: CircomResolvedFile[],
    sourceNames: string[],
    dependencyGraph: DependencyGraph,
  ): CircomResolvedFileInfo[] {
    const resolvedFilesInfo: CircomResolvedFileInfo[] = [];

    for (const file of circomResolvedFiles) {
      if (file.fileData.parsedFileData.mainComponentInfo.templateName && sourceNames.includes(file.sourceName)) {
        resolvedFilesInfo.push({
          circuitName: file.fileData.parsedFileData.mainComponentInfo.templateName,
          circuitFullyQualifiedName: this._circuitArtifacts.getCircuitFullyQualifiedName(
            file.sourceName,
            file.fileData.parsedFileData.mainComponentInfo.templateName,
          ),
          resolvedFile: file,
          dependencies: dependencyGraph.getTransitiveDependencies(file).map((dep) => dep.dependency),
        });
      }
    }

    return resolvedFilesInfo;
  }

  protected async _getSourceNamesFromSourcePaths(sourcePaths: string[]): Promise<string[]> {
    return Promise.all(sourcePaths.map((p) => localPathToSourceName(this._projectRoot, p)));
  }

  protected async _getDependencyGraph(sourceNames: string[], resolver: CircomFilesResolver): Promise<DependencyGraph> {
    const resolvedFiles = await Promise.all(sourceNames.map((sn) => resolver.resolveSourceName(sn)));

    return DependencyGraph.createFromResolvedFiles(resolver, resolvedFiles);
  }

  protected async _invalidateCacheMissingArtifacts(resolvedFilesInfo: CircomResolvedFileInfo[]) {
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

  protected _needsCompilation(resolvedFileInfo: CircomResolvedFileInfo, compileFlags: CompileFlags): boolean {
    for (const file of [resolvedFileInfo.resolvedFile, ...resolvedFileInfo.dependencies]) {
      const hasChanged = CircuitsCompileCache!.hasFileChanged(file.absolutePath, file.contentHash, compileFlags);

      if (hasChanged) {
        return true;
      }
    }

    return false;
  }
}
