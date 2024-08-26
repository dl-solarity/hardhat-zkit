import path from "path";
import fsExtra from "fs-extra";

import { FileNotFoundError, getAllFilesMatching, getFileTrueCase } from "hardhat/internal/util/fs-utils";
import { isFullyQualifiedName } from "hardhat/utils/contract-names";
import { replaceBackslashes } from "hardhat/utils/source-names";
import { ERRORS } from "hardhat/internal/core/errors-list";
import { HardhatError, NomicLabsHardhatPluginError } from "hardhat/internal/core/errors";

import { HardhatZKitError } from "../errors";
import { CIRCUIT_ARTIFACTS_SUFFIX } from "../constants";
import { Reporter } from "../reporter";
import { getFileHash } from "../utils/utils";

import {
  ArtifactsFileType,
  ArtifactsCache,
  CircuitArtifact,
  ICircuitArtifacts,
} from "../types/artifacts/circuit-artifacts";

export class CircuitArtifacts implements ICircuitArtifacts {
  // Undefined means that the cache is disabled.
  private _cache?: ArtifactsCache = {
    artifactNameToArtifactPathCache: new Map(),
  };

  constructor(private readonly _artifactsPath: string) {}

  public async readCircuitArtifact(circuitNameOrFullyQualifiedName: string): Promise<CircuitArtifact> {
    const artifactPath = await this._getArtifactPath(circuitNameOrFullyQualifiedName);
    const fileContent = fsExtra.readFileSync(artifactPath, "utf-8");

    return JSON.parse(fileContent) as CircuitArtifact;
  }

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

  public async getAllCircuitFullyQualifiedNames(): Promise<string[]> {
    const paths = await this.getCircuitArtifactPaths();
    return paths.map((p) => this._getFullyQualifiedNameFromPath(p)).sort();
  }

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

  public formCircuitArtifactPathFromFullyQualifiedName(fullyQualifiedName: string): string {
    const { sourceName, circuitName } = this._parseCircuitFullyQualifiedName(fullyQualifiedName);

    return path.join(this._artifactsPath, sourceName, `${circuitName}${CIRCUIT_ARTIFACTS_SUFFIX}`);
  }

  public getCircuitFullyQualifiedName(sourceName: string, circuitName: string): string {
    return `${sourceName}:${circuitName}`;
  }

  public getCircuitArtifactsDirFullPath(): string {
    return this._artifactsPath;
  }

  public getCircuitArtifactFileFullPath(circuitArtifact: CircuitArtifact, fileType: ArtifactsFileType): string {
    return path.join(
      this._artifactsPath,
      circuitArtifact.circuitSourceName,
      this._getOutputFileSourcePath(circuitArtifact.circuitTemplateName, fileType),
    );
  }

  public async saveCircuitArtifact(circuitArtifact: CircuitArtifact, updatedFileTypes: ArtifactsFileType[]) {
    const fullyQualifiedName = this.getCircuitFullyQualifiedName(
      circuitArtifact.circuitSourceName,
      circuitArtifact.circuitTemplateName,
    );

    const artifactPath = this.formCircuitArtifactPathFromFullyQualifiedName(fullyQualifiedName);

    for (const fileType of updatedFileTypes) {
      const fileSourcePath: string = this.getCircuitArtifactFileFullPath(circuitArtifact, fileType);

      circuitArtifact.compilerOutputFiles[fileType] = {
        fileSourcePath,
        fileHash: getFileHash(fileSourcePath),
      };
    }

    Reporter!.verboseLog("circuit-artifacts", "Saving circuit artifact: %o", [circuitArtifact]);

    await fsExtra.ensureDir(path.dirname(artifactPath));
    await fsExtra.writeJSON(artifactPath, circuitArtifact, { spaces: 2 });
  }

  public clearCache() {
    if (this._cache === undefined) {
      return;
    }

    this._cache = {
      artifactNameToArtifactPathCache: new Map(),
    };
  }

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

  private _getOutputFileSourcePath(circuitTemplateName: string, fileType: ArtifactsFileType): string {
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
        return `${circuitTemplateName}.vkey.json`;
      case "zkey":
        return `${circuitTemplateName}.zkey`;

      default:
        throw new HardhatZKitError(`Invalid artifacts file type ${fileType}`);
    }
  }

  private _handleArtifactsNotFound(circuitNameOrFullyQualifiedName: string) {
    throw new HardhatZKitError(`Artifacts for ${circuitNameOrFullyQualifiedName} circuit not found`);
  }
}
