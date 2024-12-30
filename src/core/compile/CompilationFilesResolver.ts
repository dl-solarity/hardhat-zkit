import { HardhatConfig } from "hardhat/types";
import { getAllFilesMatching } from "hardhat/internal/util/fs-utils";
import { localPathToSourceName } from "hardhat/utils/source-names";

import {
  DependencyGraph,
  CircomFilesParser,
  CircomFilesResolver,
  CircuitAnalyzer,
  CircomResolvedFile,
} from "../resolve";
import { CircuitsCompileCache } from "../../cache";
import { Reporter } from "../../reporter";
import { filterCircuitFiles, getNormalizedFullPath } from "../../utils/path-utils";

import { ZKitConfig } from "../../types/zkit-config";
import { ICircuitArtifacts } from "../../types/artifacts/circuit-artifacts";
import { CircomResolvedFileInfo, CompileFlags } from "../../types/core";

/**
 * This class is responsible for determining the list of files and circuits that need to be compiled.
 * It selects files by applying various filtering criteria and utilizes cached parameters from previous compilations
 * to determine whether a specific circuit requires recompilation.
 *
 * By leveraging caching and filtering, this class optimizes the compilation process, ensuring only necessary
 * circuits are recompiled, thus improving performance and reducing redundant work.
 */
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

  /**
   * Returns the information about circuit files that need to be compiled based on the compilation flags
   * and whether the circuit files or their dependencies have changed since the last compilation.
   *
   * The function follows these steps to determine the list of files to be compiled:
   * 1. Finds all `.circom` files within the circuits directory specified in the configuration
   * 2. Converts the discovered paths into the `sourceName` format, i.e.,
   *    relative paths with respect to the circuits directory
   * 3. Filters the paths based on the compilation settings filtering parameters provided in the configuration
   * 4. Builds a {@link DependencyGraph} by resolving all dependencies using the {@link CircomFilesResolver}
   * 5. Further filters {@link CircomResolvedFileInfo} objects, excluding files that do not have a main component
   *    or are not located within the specified circuits directory
   * 6. If the `force` flag is not provided, checks whether the compilation is necessary for the identified files
   * 7. Returns an array of {@link CircomResolvedFileInfo} objects representing the files that need to be compiled
   *
   * @param compileFlags The flags to be used during the next compilation
   * @param force Whether to force recompilation
   * @returns An array of {@link CircomResolvedFileInfo} objects
   */
  public async getResolvedFilesToCompile(
    compileFlags: CompileFlags,
    force: boolean,
  ): Promise<CircomResolvedFileInfo[]> {
    const spinnerId: string | null = Reporter!.reportCircuitFilesResolvingStartWithSpinner();

    const allFilteredSourceNames = await this._getAllSourceNames();
    const filesWithMainComponentToCompile = await this._filterAndBuildCircuitsWithMainComponent(
      spinnerId,
      allFilteredSourceNames,
    );

    return this._decideWhichCircuitsToCompile(compileFlags, force, spinnerId, filesWithMainComponentToCompile);
  }

  protected async _getAllSourceNames(): Promise<string[]> {
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

    return allFilteredSourceNames;
  }

  protected async _filterAndBuildCircuitsWithMainComponent(
    spinnerId: string | null,
    allFilteredSourceNames: string[],
  ): Promise<CircomResolvedFileInfo[]> {
    try {
      const parser = new CircomFilesParser();
      const resolver = new CircomFilesResolver(this._projectRoot, parser, this._readFile);
      const analyzer = new CircuitAnalyzer(parser, this._readFile);
      const dependencyGraph: DependencyGraph = await this._getDependencyGraph(allFilteredSourceNames, resolver);

      const filesWithMainComponentToCompile = this._filterResolvedFilesWithMainComponent(
        dependencyGraph.getResolvedFiles(),
        allFilteredSourceNames,
        dependencyGraph,
      );

      Reporter!.verboseLog("compilation-file-resolver", "All circuit source names to compile: %o", [
        filesWithMainComponentToCompile.map((fileInfo) => fileInfo.resolvedFile.sourceName),
      ]);

      for (const fileInfo of filesWithMainComponentToCompile) {
        await analyzer.buildMainComponentData(fileInfo.resolvedFile, fileInfo.dependencies);
      }

      this._invalidateCacheMissingArtifacts(filesWithMainComponentToCompile);

      return filesWithMainComponentToCompile;
    } catch (e) {
      Reporter!.reportCircuitFilesResolvingFail(spinnerId);

      throw e;
    }
  }

  protected _decideWhichCircuitsToCompile(
    compileFlags: CompileFlags,
    force: boolean,
    spinnerId: string | null,
    filesWithMainComponentToCompile: CircomResolvedFileInfo[],
  ): CircomResolvedFileInfo[] {
    let changedFilesToCompile: CircomResolvedFileInfo[];

    if (!force) {
      Reporter!.verboseLog("compilation-file-resolver", "Force flag disabled. Start filtering...");

      changedFilesToCompile = filesWithMainComponentToCompile.filter((fileInfo) =>
        this._needsCompilation(fileInfo, compileFlags),
      );
    } else {
      changedFilesToCompile = filesWithMainComponentToCompile;
    }

    Reporter!.reportAllWarnings(spinnerId);
    Reporter!.reportCircuitFilesResolvingResult(spinnerId);

    const filteredSourceNamesToCompile: string[] = changedFilesToCompile.map((file) => file.resolvedFile.sourceName);

    Reporter!.verboseLog("compilation-file-resolver", "Filtered circuit source names to compile: %o", [
      filteredSourceNamesToCompile,
    ]);
    Reporter!.reportCircuitListToCompile(
      filesWithMainComponentToCompile.map((file) => file.resolvedFile.sourceName),
      filteredSourceNamesToCompile,
    );

    return changedFilesToCompile;
  }

  protected _filterResolvedFilesWithMainComponent(
    circomResolvedFiles: CircomResolvedFile[],
    sourceNames: string[],
    dependencyGraph: DependencyGraph,
  ): CircomResolvedFileInfo[] {
    const resolvedFilesInfo: CircomResolvedFileInfo[] = [];

    for (const file of circomResolvedFiles) {
      if (file.fileData.parsedFileData.mainComponentInfo && sourceNames.includes(file.sourceName)) {
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

  protected _getCircuitsDirFullPath(): string {
    return getNormalizedFullPath(this._projectRoot, this._zkitConfig.circuitsDir);
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
