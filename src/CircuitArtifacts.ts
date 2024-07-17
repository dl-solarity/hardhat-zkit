import path from "path";
import fsExtra from "fs-extra";

import { FileNotFoundError, getAllFilesMatching, getFileTrueCase } from "hardhat/internal/util/fs-utils";
import { isFullyQualifiedName } from "hardhat/utils/contract-names";
import { replaceBackslashes } from "hardhat/utils/source-names";
import { ERRORS } from "hardhat/internal/core/errors-list";
import { HardhatError, NomicLabsHardhatPluginError } from "hardhat/internal/core/errors";
import { createNonCryptographicHashBasedIdentifier } from "hardhat/internal/util/hash";

import { HardhatZKitError } from "./errors";
import { CIRCUIT_ARTIFACTS_SUFFIX } from "./constants";
import { ArtifactsCache, CircuitArtifact, CompilerOutputFileInfo, ICircuitArtifacts } from "./types/circuit-artifacts";
import { ArtifactsFileType } from "@solarity/zkit";
import { getNormalizedFullPath } from "./utils/path-utils";

export class CircuitArtifacts implements ICircuitArtifacts {
  // Undefined means that the cache is disabled.
  private _cache?: ArtifactsCache = {
    artifactNameToArtifactPathCache: new Map(),
  };

  constructor(private readonly _artifactsPath: string) {}

  public async readCircuitArtifact(circuitNameOrFullyQualifiedName: string): Promise<CircuitArtifact> {
    const artifactPath = await this._getArtifactPath(circuitNameOrFullyQualifiedName);
    return fsExtra.readJson(artifactPath);
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

  public async saveCircuitArtifact(circuitArtifact: CircuitArtifact, updatedFileTypes: ArtifactsFileType[]) {
    const fullyQualifiedName = this.getCircuitFullyQualifiedName(
      circuitArtifact.sourcePath,
      circuitArtifact.circuitTemplateName,
    );

    const artifactPath = this.formCircuitArtifactPathFromFullyQualifiedName(fullyQualifiedName);

    for (const fileType of updatedFileTypes) {
      circuitArtifact.compilerOutputFiles[fileType] = this._getCompilerOutputFileInfo(circuitArtifact, fileType);
    }

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

  private _getCompilerOutputFileInfo(
    circuitArtifact: CircuitArtifact,
    fileType: ArtifactsFileType,
  ): CompilerOutputFileInfo {
    let outputFileSourcePath: string;

    switch (fileType) {
      case "wasm":
        outputFileSourcePath = path.join(
          `${circuitArtifact.circuitTemplateName}_js`,
          `${circuitArtifact.circuitTemplateName}.wasm`,
        );
        break;
      case "r1cs":
        outputFileSourcePath = `${circuitArtifact.circuitTemplateName}.r1cs`;
        break;
      case "sym":
        outputFileSourcePath = `${circuitArtifact.circuitTemplateName}.sym`;
        break;
      case "json":
        outputFileSourcePath = `${circuitArtifact.circuitTemplateName}_constraints.json`;
        break;
      case "vkey":
        outputFileSourcePath = `${circuitArtifact.circuitTemplateName}.vkey.json`;
        break;
      case "zkey":
        outputFileSourcePath = `${circuitArtifact.circuitTemplateName}.zkey`;
        break;

      default:
        throw new HardhatZKitError(`Invalid artifacts file type ${fileType}`);
    }

    const fileSourceName: string = getNormalizedFullPath(circuitArtifact.sourcePath, outputFileSourcePath);
    const fileFullPath: string = getNormalizedFullPath(this._artifactsPath, fileSourceName);

    return {
      fileSourceName,
      fileHash: createNonCryptographicHashBasedIdentifier(Buffer.from(fsExtra.readFileSync(fileFullPath))).toString(
        "hex",
      ),
    };
  }

  private _handleArtifactsNotFound(circuitNameOrFullyQualifiedName: string) {
    throw new HardhatZKitError(`Artifacts for ${circuitNameOrFullyQualifiedName} circuit not found`);
  }
}
