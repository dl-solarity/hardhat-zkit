import path from "path";
import os from "os";
import fs from "fs";
import fsExtra from "fs-extra";
import { v4 as uuid } from "uuid";

import { HardhatRuntimeEnvironment } from "hardhat/types";

import { CircomCompilerFactory, createCircomCompilerFactory } from "../compiler";
import { HardhatZKitError } from "../../errors";
import { CIRCUIT_ARTIFACT_VERSION, NODE_MODULES } from "../../constants";
import { Reporter } from "../../reporter";

import { getHighestVersion, isVersionValid, isVersionHigherOrEqual } from "../compiler/versioning";
import { getNormalizedFullPath, renameFilesRecursively, readDirRecursively } from "../../utils/path-utils";

import { ZKitConfig } from "../../types/zkit-config";
import { ArtifactsFileType, CircuitArtifact, ICircuitArtifacts } from "../../types/artifacts/circuit-artifacts";
import {
  ICircomCompiler,
  CompilationProccessorConfig,
  CompilationInfo,
  CompileConfig,
  CircomResolvedFileInfo,
} from "../../types/core";

export class CompilationProcessor {
  private readonly _zkitConfig: ZKitConfig;
  private readonly _nodeModulesPath: string;

  constructor(
    private readonly _config: CompilationProccessorConfig,
    private readonly _circuitArtifacts: ICircuitArtifacts,
    hre: HardhatRuntimeEnvironment,
  ) {
    this._zkitConfig = hre.config.zkit;
    this._nodeModulesPath = getNormalizedFullPath(hre.config.paths.root, NODE_MODULES);

    Reporter!.verboseLog("compilation-processor", "Created CompilationProcessor with params: %O", [
      {
        config: _config,
        artifactsDirFullPath: this._circuitArtifacts.getCircuitArtifactsDirFullPath(),
      },
    ]);
  }

  public async compile(filesInfoToCompile: CircomResolvedFileInfo[]) {
    const tempDir: string = path.join(os.tmpdir(), ".zkit", uuid());

    try {
      fsExtra.mkdirSync(tempDir, { recursive: true });

      Reporter!.verboseLog("compilation-processor", "Compilation temp directory: %s", [tempDir]);
      Reporter!.reportCompilationProcessHeader();

      const highestCircomVersion = getHighestVersion(filesInfoToCompile);

      let isVersionStrict = false;
      let version = highestCircomVersion;

      if (this._zkitConfig.compilerVersion && isVersionValid(this._zkitConfig.compilerVersion)) {
        if (!isVersionHigherOrEqual(this._zkitConfig.compilerVersion, highestCircomVersion)) {
          throw new HardhatZKitError(
            `Unable to compile a circuit with Circom version ${highestCircomVersion} using compiler version ${this._zkitConfig.compilerVersion} specified in the config`,
          );
        }

        isVersionStrict = true;
        version = this._zkitConfig.compilerVersion;
      }

      createCircomCompilerFactory();
      const compiler = await CircomCompilerFactory!.createCircomCompiler(version, isVersionStrict);

      const compilationInfoArr: CompilationInfo[] = await this._getCompilationInfoArr(tempDir, filesInfoToCompile);

      await this._compileCircuits(compiler, compilationInfoArr);

      compilationInfoArr.forEach((info: CompilationInfo) => {
        info.constraintsNumber = this._getConstraintsNumber(info);
      });

      await this._moveFromTempDirToArtifacts(compilationInfoArr);

      await this._emitArtifacts(compilationInfoArr);

      Reporter!.reportCompilationResult(compilationInfoArr);
    } finally {
      fsExtra.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  private async _compileCircuits(compiler: ICircomCompiler, compilationInfoArr: CompilationInfo[]) {
    for (const info of compilationInfoArr) {
      const spinnerId: string | null = Reporter!.reportCircuitCompilationStartWithSpinner(
        info.circuitName,
        info.circuitFileName,
      );
      const errorsFilePath: string = getNormalizedFullPath(info.tempArtifactsPath, "errors.log");

      fsExtra.mkdirSync(info.tempArtifactsPath, { recursive: true });

      const compileConfig: CompileConfig = {
        circuitFullPath: info.resolvedFile.absolutePath,
        artifactsFullPath: info.tempArtifactsPath,
        errorFileFullPath: errorsFilePath,
        linkLibraries: this._getLinkLibraries(),
        compileFlags: this._config.compileFlags,
        quiet: this._config.quiet,
      };

      try {
        await compiler.compile(compileConfig);
      } catch (error) {
        Reporter!.reportCircuitCompilationFail(spinnerId, info.circuitName, info.circuitFileName);

        if (!(error instanceof HardhatZKitError)) {
          throw error;
        }

        let internalMessageError: string = "";

        if (fsExtra.existsSync(errorsFilePath)) {
          internalMessageError = `\nWith internal error: ${fsExtra.readFileSync(errorsFilePath, "utf-8")}`;
        }

        throw new HardhatZKitError(`${error.message}${internalMessageError}`);
      } finally {
        fsExtra.rmSync(errorsFilePath, { force: true });
      }

      if (info.circuitFileName !== info.circuitName) {
        renameFilesRecursively(info.tempArtifactsPath, info.circuitFileName, info.circuitName);
      }

      Reporter!.reportCircuitCompilationResult(spinnerId, info.circuitName, info.circuitFileName);
    }
  }

  private async _emitArtifacts(compilationInfoArr: CompilationInfo[]) {
    for (const info of compilationInfoArr) {
      const fullyQualifiedName: string = this._circuitArtifacts.getCircuitFullyQualifiedName(
        info.resolvedFile.sourceName,
        info.circuitName,
      );

      let circuitArtifact: CircuitArtifact;

      if (await this._circuitArtifacts.circuitArtifactExists(fullyQualifiedName)) {
        circuitArtifact = await this._circuitArtifacts.readCircuitArtifact(fullyQualifiedName);
      } else {
        circuitArtifact = {
          _format: CIRCUIT_ARTIFACT_VERSION,
          circuitTemplateName: info.circuitName,
          circuitFileName: info.circuitFileName,
          circuitSourceName: info.resolvedFile.sourceName,
          baseCircuitInfo: {
            constraintsNumber: 0,
            signals: [],
          },
          compilerOutputFiles: {},
        };
      }

      if (!info.resolvedFile.fileData.mainComponentData) {
        throw new HardhatZKitError("Unable to emit artifacts for resolved file without main component data");
      }

      circuitArtifact.baseCircuitInfo = {
        constraintsNumber: info.constraintsNumber,
        signals: info.resolvedFile.fileData.mainComponentData.signals,
      };

      await this._circuitArtifacts.saveCircuitArtifact(circuitArtifact, this._getUpdatedArtifactFileTypes());
    }
  }

  private async _moveFromTempDirToArtifacts(compilationInfoArr: CompilationInfo[]) {
    compilationInfoArr.forEach((info: CompilationInfo) => {
      fsExtra.mkdirSync(info.artifactsPath, { recursive: true });

      readDirRecursively(info.tempArtifactsPath, (dir: string, file: string) => {
        const correspondingOutDir = path.join(info.artifactsPath, path.relative(info.tempArtifactsPath, dir));
        const correspondingOutFile = path.join(info.artifactsPath, path.relative(info.tempArtifactsPath, file));

        if (!fsExtra.existsSync(correspondingOutDir)) {
          fsExtra.mkdirSync(correspondingOutDir);
        }

        if (fsExtra.existsSync(correspondingOutFile)) {
          fsExtra.rmSync(correspondingOutFile);
        }

        Reporter!.verboseLog("compilation-processor:copying", "Copying file from temp directory to artifacts: %o", [
          { file, correspondingOutFile },
        ]);

        fsExtra.copyFileSync(file, correspondingOutFile);
      });
    });
  }

  private async _getCompilationInfoArr(
    tempDir: string,
    filesInfoToCompile: CircomResolvedFileInfo[],
  ): Promise<CompilationInfo[]> {
    const artifactsDirFullPath = this._circuitArtifacts.getCircuitArtifactsDirFullPath();

    return Promise.all(
      filesInfoToCompile.map(async (fileInfo: CircomResolvedFileInfo): Promise<CompilationInfo> => {
        return {
          circuitName: fileInfo.circuitName,
          circuitFileName: path.parse(fileInfo.resolvedFile.absolutePath).name,
          artifactsPath: getNormalizedFullPath(artifactsDirFullPath, fileInfo.resolvedFile.sourceName),
          tempArtifactsPath: getNormalizedFullPath(tempDir, fileInfo.resolvedFile.sourceName),
          resolvedFile: fileInfo.resolvedFile,
          constraintsNumber: 0,
        };
      }),
    );
  }

  private _getUpdatedArtifactFileTypes(): ArtifactsFileType[] {
    const fileTypes: ArtifactsFileType[] = [];

    this._config.compileFlags.wasm && fileTypes.push("wasm");
    this._config.compileFlags.c && fileTypes.push("c");
    this._config.compileFlags.r1cs && fileTypes.push("r1cs");
    this._config.compileFlags.sym && fileTypes.push("sym");
    this._config.compileFlags.json && fileTypes.push("json");

    return fileTypes;
  }

  private _getConstraintsNumber(compilationInfo: CompilationInfo): number {
    const r1csFileName = `${compilationInfo.circuitName}.r1cs`;
    const r1csFile = getNormalizedFullPath(compilationInfo.tempArtifactsPath, r1csFileName);
    const r1csDescriptor = fs.openSync(r1csFile, "r");

    const readBytes = (position: number, length: number): bigint => {
      const buffer = Buffer.alloc(length);

      fs.readSync(r1csDescriptor, buffer, { length, position });

      return BigInt(`0x${buffer.reverse().toString("hex")}`);
    };

    /// @dev https://github.com/iden3/r1csfile/blob/d82959da1f88fbd06db0407051fde94afbf8824a/doc/r1cs_bin_format.md#format-of-the-file
    const numberOfSections = readBytes(8, 4);
    let sectionStart = 12;

    for (let i = 0; i < numberOfSections; ++i) {
      const sectionType = Number(readBytes(sectionStart, 4));
      const sectionSize = Number(readBytes(sectionStart + 4, 8));

      /// @dev Reading header section
      if (sectionType == 1) {
        const totalConstraintsOffset = 4 + 8 + 4 + 32 + 4 + 4 + 4 + 4 + 8;

        return Number(readBytes(sectionStart + totalConstraintsOffset, 4));
      }

      sectionStart += 4 + 8 + sectionSize;
    }

    throw new HardhatZKitError(`Header section in ${r1csFileName} file is not found.`);
  }

  private _getLinkLibraries(): string[] {
    return [this._nodeModulesPath];
  }
}
