import path from "path";
import fsExtra from "fs-extra";

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { FileNotFoundError, getAllFilesMatching, getFileTrueCase } from "hardhat/internal/util/fs-utils";
import { isFullyQualifiedName } from "hardhat/utils/contract-names";
import { replaceBackslashes } from "hardhat/utils/source-names";
import { ERRORS } from "hardhat/internal/core/errors-list";
import { HardhatError, NomicLabsHardhatPluginError } from "hardhat/internal/core/errors";

import { ProvingSystemType } from "@solarity/zkit";

import { HardhatZKitError } from "../errors";
import { CIRCUIT_ARTIFACTS_SUFFIX } from "../constants";
import { Reporter } from "../reporter";
import { getFileHash, getNormalizedFullPath } from "../utils";

import {
  CircuitArtifact,
  ICircuitArtifacts,
  ArtifactsCache,
  ArtifactsFileType,
} from "../types/artifacts/circuit-artifacts";

/**
 * A class for easily managing circuit artifacts, including retrieving existing artifacts,
 * creating new ones, and removing outdated artifacts.
 *
 * This class simplifies the process of handling circuit-related artifacts by providing
 * methods for fetching, generating, and cleaning up artifacts that are no longer needed.
 */
export class CircuitArtifacts implements ICircuitArtifacts {
  private readonly _artifactsPath: string;

  // Undefined means that the cache is disabled.
  private _cache?: ArtifactsCache = {
    artifactNameToArtifactPathCache: new Map(),
  };

  constructor(hre: HardhatRuntimeEnvironment) {
    this._artifactsPath = getNormalizedFullPath(
      hre.config.paths.root,
      hre.config.zkit.compilationSettings.artifactsDir,
    );
  }

  /**
   * Generates a unique artifact file key using the specified {@link ArtifactsFileType | fileType}
   * and {@link ProvingSystemType | provingSystem}
   *
   * @param fileType The type of the artifact file
   * @param provingSystem The type of the proving system
   * @returns A generated key for the artifact file
   */
  public static getArtifactOutputFileKey(fileType: ArtifactsFileType, provingSystem?: ProvingSystemType): string {
    if (fileType === "zkey" || fileType === "vkey") {
      if (!provingSystem) {
        throw new HardhatZKitError("Undefined proving system is passed. Please provide valid proving system.");
      }

      return `${provingSystem}.${fileType}`;
    }

    return fileType;
  }

  /**
   * Retrieves a {@link CircuitArtifact} object based on the provided short name or fully qualified name
   *
   * @param circuitNameOrFullyQualifiedName The short circuit name or the fully qualified circuit name
   *    (refer to: {@link getCircuitFullyQualifiedName} for more details)
   * @returns A promise that resolves to the {@link CircuitArtifact} object corresponding to the provided name
   */
  public async readCircuitArtifact(circuitNameOrFullyQualifiedName: string): Promise<CircuitArtifact> {
    const artifactPath = await this._getArtifactPath(circuitNameOrFullyQualifiedName);
    const fileContent = fsExtra.readFileSync(artifactPath, "utf-8");

    return JSON.parse(fileContent) as CircuitArtifact;
  }

  /**
   * Checks if a circuit artifact exists for the given short or fully qualified name
   *
   * @param circuitNameOrFullyQualifiedName The short circuit name or the fully qualified circuit name
   *    (refer to: {@link getCircuitFullyQualifiedName} for more details)
   * @returns A promise that resolves to `true` if the {@link CircuitArtifact} exists, `false` otherwise
   */
  public async circuitArtifactExists(circuitNameOrFullyQualifiedName: string): Promise<boolean> {
    let artifactPath;
    try {
      artifactPath = await this._getArtifactPath(circuitNameOrFullyQualifiedName);
    } catch (e) {
      if (NomicLabsHardhatPluginError.isNomicLabsHardhatPluginError(e)) {
        return false;
      }

      throw e;
    }

    return fsExtra.pathExists(artifactPath);
  }

  /**
   * Retrieves an array of all fully qualified circuit names for paths discovered by the
   * {@link getCircuitArtifactPaths} function
   *
   * @returns A promise that resolves to an array of fully qualified circuit names
   */
  public async getAllCircuitFullyQualifiedNames(): Promise<string[]> {
    const paths = await this.getCircuitArtifactPaths();
    return paths.map((p) => this._getFullyQualifiedNameFromPath(p)).sort();
  }

  /**
   * Retrieves an array of all circuit artifact paths found within the artifacts directory
   *
   * @returns A promise that resolves to an array of circuit artifact paths
   */
  public async getCircuitArtifactPaths(): Promise<string[]> {
    const cached = this._cache?.artifactPaths;
    if (cached !== undefined) {
      return cached;
    }

    const paths = await getAllFilesMatching(this._artifactsPath, (f) => f.endsWith(CIRCUIT_ARTIFACTS_SUFFIX));

    if (this._cache !== undefined) {
      this._cache.artifactPaths = paths;
    }

    return paths;
  }

  /**
   * Constructs and returns the full path to the artifact file using the fully qualified circuit name
   *
   * @param fullyQualifiedName The fully qualified circuit name
   *    (refer to: {@link getCircuitFullyQualifiedName} for details)
   * @returns The full path to the corresponding circuit artifact file
   */
  public formCircuitArtifactPathFromFullyQualifiedName(fullyQualifiedName: string): string {
    const { sourceName, circuitName } = this._parseCircuitFullyQualifiedName(fullyQualifiedName);

    return path.join(this._artifactsPath, sourceName, `${circuitName}${CIRCUIT_ARTIFACTS_SUFFIX}`);
  }

  /**
   * Constructs and returns the fully qualified circuit name based on the provided source name and circuit template name
   *
   * @example
   * // Example usage:
   * const qualifiedName = getCircuitFullyQualifiedName("exampleSource", "exampleCircuit");
   * console.log(qualifiedName); // Output: "exampleSource:exampleCircuit"
   *
   * @param sourceName The name of the source file for the circuit
   * @param circuitName The name of the circuit template
   * @returns The fully qualified circuit name in the format "sourceName:circuitName"
   */
  public getCircuitFullyQualifiedName(sourceName: string, circuitName: string): string {
    return `${sourceName}:${circuitName}`;
  }

  /**
   * Retrieves the configured full path to the artifacts directory
   *
   * @returns The full path to the artifacts directory as a string
   */
  public getCircuitArtifactsDirFullPath(): string {
    return this._artifactsPath;
  }

  /**
   * Constructs and returns the full path for a specific artifact file based on the provided
   * {@link CircuitArtifact} object, the specified {@link ArtifactsFileType | file type}
   * and {@link ProvingSystemType | proving system type}.
   *
   * The {@link ProvingSystemType | provingSystem} parameter has `groth16` value by default
   *
   * @param circuitArtifact The {@link CircuitArtifact} object representing the artifact
   * @param fileType The {@link ArtifactsFileType | file type} indicating the type of artifact file
   *    for which to retrieve the path
   * @returns The full path of the specified artifact file associated with the provided {@link CircuitArtifact} object
   */
  public getCircuitArtifactFileFullPath(
    circuitArtifact: CircuitArtifact,
    fileType: ArtifactsFileType,
    provingSystem: ProvingSystemType = "groth16",
  ): string {
    return path.join(
      this._artifactsPath,
      circuitArtifact.circuitSourceName,
      this._getOutputFileSourcePath(circuitArtifact.circuitTemplateName, fileType, provingSystem),
    );
  }

  /**
   * Saves the provided {@link CircuitArtifact} object to the artifacts file
   *
   * @param circuitArtifact The {@link CircuitArtifact} object to be saved
   * @param updatedFileTypes An array of {@link ArtifactsFileType | file types} that have been modified
   *    during the most recent session, such as during compilation
   * @param updatedProvingSystems An array of {@link ProvingSystemType | proving systems} that have been added
   *    during the most recent session
   * @returns A promise that resolves once the save operation is complete
   */
  public async saveCircuitArtifact(
    circuitArtifact: CircuitArtifact,
    updatedFileTypes: ArtifactsFileType[],
    updatedProvingSystems: ProvingSystemType[],
  ) {
    const fullyQualifiedName = this.getCircuitFullyQualifiedName(
      circuitArtifact.circuitSourceName,
      circuitArtifact.circuitTemplateName,
    );

    const artifactPath = this.formCircuitArtifactPathFromFullyQualifiedName(fullyQualifiedName);

    // Create array with one element for the compilation case
    const provingSystems = updatedProvingSystems.length > 0 ? updatedProvingSystems : [undefined];

    // Updates the data for files that have been recently modified
    for (const fileType of updatedFileTypes) {
      for (const provingSystem of provingSystems) {
        const fileSourcePath: string = this.getCircuitArtifactFileFullPath(circuitArtifact, fileType, provingSystem);

        circuitArtifact.compilerOutputFiles[CircuitArtifacts.getArtifactOutputFileKey(fileType, provingSystem)] = {
          fileSourcePath,
          fileHash: getFileHash(fileSourcePath),
        };
      }
    }

    Reporter!.verboseLog("circuit-artifacts", "Saving circuit artifact: %o", [circuitArtifact]);

    await fsExtra.ensureDir(path.dirname(artifactPath));
    await fsExtra.writeJSON(artifactPath, circuitArtifact, { spaces: 2 });
  }

  /**
   * Clears the local cache of artifacts
   */
  public clearCache() {
    if (this._cache === undefined) {
      return;
    }

    this._cache = {
      artifactNameToArtifactPathCache: new Map(),
    };
  }

  /**
   * Disables the local cache of artifacts
   */
  public disableCache() {
    this._cache = undefined;
  }

  private _parseCircuitFullyQualifiedName(fullyQualifiedName: string): {
    sourceName: string;
    circuitName: string;
  } {
    const parts = fullyQualifiedName.split(":");

    if (parts.length > 2) {
      throw new HardhatZKitError(`Invalid circuit fully qualified name ${fullyQualifiedName}.`);
    }

    return { sourceName: parts[0], circuitName: parts[1] };
  }

  private async _getArtifactPath(name: string): Promise<string> {
    const cached = this._cache?.artifactNameToArtifactPathCache.get(name);
    if (cached !== undefined) {
      return cached;
    }

    let result: string;
    if (isFullyQualifiedName(name)) {
      result = await this._getValidArtifactPathFromFullyQualifiedName(name);
    } else {
      const files = await this.getCircuitArtifactPaths();
      result = this._getArtifactPathFromFiles(name, files);
    }

    this._cache?.artifactNameToArtifactPathCache.set(name, result);
    return result;
  }

  private async _getValidArtifactPathFromFullyQualifiedName(fullyQualifiedName: string): Promise<string> {
    const artifactPath = this.formCircuitArtifactPathFromFullyQualifiedName(fullyQualifiedName);

    try {
      const trueCasePath = path.join(
        this._artifactsPath,
        await getFileTrueCase(this._artifactsPath, path.relative(this._artifactsPath, artifactPath)),
      );

      if (artifactPath !== trueCasePath) {
        throw new HardhatError(ERRORS.ARTIFACTS.WRONG_CASING, {
          correct: this._getFullyQualifiedNameFromPath(trueCasePath),
          incorrect: fullyQualifiedName,
        });
      }

      return trueCasePath;
    } catch (e) {
      if (e instanceof FileNotFoundError) {
        this._handleArtifactsNotFound(fullyQualifiedName);
      }

      throw e;
    }
  }

  private _getArtifactPathFromFiles(circuitName: string, files: string[]): string {
    const matchingFiles = files.filter((file) => {
      return path.basename(file) === `${circuitName}${CIRCUIT_ARTIFACTS_SUFFIX}`;
    });

    if (matchingFiles.length === 0) {
      this._handleArtifactsNotFound(circuitName);
    }

    if (matchingFiles.length > 1) {
      throw new HardhatZKitError(
        `There are multiple artifacts for ${circuitName} circuit, please use a fully qualified name.`,
      );
    }

    return matchingFiles[0];
  }

  private _getFullyQualifiedNameFromPath(absolutePath: string): string {
    const sourceName = replaceBackslashes(path.relative(this._artifactsPath, path.dirname(absolutePath)));

    const circuitName = path.basename(absolutePath).replace(CIRCUIT_ARTIFACTS_SUFFIX, "");

    return this.getCircuitFullyQualifiedName(sourceName, circuitName);
  }

  private _getOutputFileSourcePath(
    circuitTemplateName: string,
    fileType: ArtifactsFileType,
    provingSystem: ProvingSystemType,
  ): string {
    switch (fileType) {
      case "wasm":
        return path.join(`${circuitTemplateName}_js`, `${circuitTemplateName}.wasm`);
      case "c":
        return path.join(`${circuitTemplateName}_cpp`, `main.cpp`);
      case "r1cs":
        return `${circuitTemplateName}.r1cs`;
      case "sym":
        return `${circuitTemplateName}.sym`;
      case "json":
        return `${circuitTemplateName}_constraints.json`;
      case "vkey":
        return `${circuitTemplateName}.${provingSystem}.vkey.json`;
      case "zkey":
        return `${circuitTemplateName}.${provingSystem}.zkey`;

      default:
        throw new HardhatZKitError(`Invalid artifacts file type ${fileType}`);
    }
  }

  private _handleArtifactsNotFound(circuitNameOrFullyQualifiedName: string) {
    throw new HardhatZKitError(`Artifacts for ${circuitNameOrFullyQualifiedName} circuit not found`);
  }
}
