import path from "path";
import os from "os";
import semver from "semver";
import fsExtra from "fs-extra";
import { v4 as uuid } from "uuid";

import { HardhatRuntimeEnvironment } from "hardhat/types";

import { CircomCompilerFactory, createCircomCompilerFactory, getHighestVersion, isVersionValid } from "../compiler";
import { HardhatZKitError } from "../../errors";
import { CIRCUIT_ARTIFACT_VERSION, NODE_MODULES } from "../../constants";
import { Reporter } from "../../reporter";

import {
  getNormalizedFullPath,
  renameFilesRecursively,
  readDirRecursively,
  getR1CSConstraintsNumber,
  terminateCurve,
} from "../../utils";

import { ZKitConfig } from "../../types/zkit-config";
import { ArtifactsFileType, CircuitArtifact, ICircuitArtifacts } from "../../types/artifacts/circuit-artifacts";
import {
  ICircomCompiler,
  CompilationProccessorConfig,
  CompilationInfo,
  CompileConfig,
  CircomResolvedFileInfo,
} from "../../types/core";

/**
 * This class handles the entire process of circuit compilation, from configuring the appropriate `circom` compiler
 * to managing and organizing the compilation artifact files. The class ensures the correct version and architecture
 * of the `circom` compiler is used based on the user's operating system, and it manages the compilation lifecycle,
 * including artifact generation and file handling.
 *
 * This class works alongside other classes such as the {@link CircomCompilerFactory},
 * {@link ICircuitArtifacts | ICircuitArtifacts}.
 */
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

  /**
   * Function responsible for compiling circuits, with relevant information passed as a parameter.
   *
   * The compilation process involves the following steps:
   * 1. Identifies the highest pragma version among the passed {@link CircomResolvedFileInfo} objects
   * 2. Creates a compiler object with the required version and architecture using {@link CircomCompilerFactory}
   * 3. Creates an array of {@link CompilationInfo} objects,
   *    containing all necessary information for subsequent compilation steps
   * 4. Compiles the circuits using the created compiler object, with all results written to a temporary directory
   * 5. Upon successful compilation, all files from the temporary directory are moved to the artifact directory
   * 6. Saves the artifact information using {@link ICircuitArtifacts | CircuitArtifacts}
   *
   * @param filesInfoToCompile Information about circuit files needed for compilation
   */
  public async compile(filesInfoToCompile: CircomResolvedFileInfo[]) {
    const tempDir: string = path.join(os.tmpdir(), ".zkit", uuid());

    try {
      // Generates a temporary directory, used as a buffer for files to prevent overwriting
      // previous compilation artifacts in case the current compilation fails
      fsExtra.mkdirSync(tempDir, { recursive: true });

      Reporter!.verboseLog("compilation-processor", "Compilation temp directory: %s", [tempDir]);
      Reporter!.reportCompilationProcessHeader();

      const highestCircomVersion = getHighestVersion(filesInfoToCompile);

      let isVersionStrict = false;
      let version = highestCircomVersion;

      if (this._zkitConfig.compilerVersion && isVersionValid(this._zkitConfig.compilerVersion)) {
        if (!semver.gte(this._zkitConfig.compilerVersion, highestCircomVersion)) {
          throw new HardhatZKitError(
            `Unable to compile a circuit with Circom version ${highestCircomVersion} using compiler version ${this._zkitConfig.compilerVersion} specified in the config`,
          );
        }

        isVersionStrict = true;
        version = this._zkitConfig.compilerVersion;
      }

      // Ensure that the CircomCompilerFactory object is properly instantiated before interacting with it
      createCircomCompilerFactory();
      const compiler = await CircomCompilerFactory!.createCircomCompiler(version, isVersionStrict);

      const compilationInfoArr: CompilationInfo[] = await this._getCompilationInfoArr(tempDir, filesInfoToCompile);

      await this._compileCircuits(compiler, compilationInfoArr);

      for (const info of compilationInfoArr) {
        const r1csFilePath = getNormalizedFullPath(info.tempArtifactsPath, `${info.circuitName}.r1cs`);
        info.constraintsNumber = await getR1CSConstraintsNumber(r1csFilePath);
      }

      await terminateCurve();

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

      // Path to the file where errors encountered during compilation will be logged
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
        // Renaming generated files after compilation to match the circuit template name rather than the file name
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
            parameters: {},
          },
          compilerOutputFiles: {},
        };
      }

      if (!info.resolvedFile.fileData.mainComponentData) {
        throw new HardhatZKitError("Unable to emit artifacts for resolved file without main component data");
      }

      circuitArtifact.baseCircuitInfo.constraintsNumber = info.constraintsNumber;
      circuitArtifact.baseCircuitInfo.signals = info.resolvedFile.fileData.mainComponentData.signals;
      circuitArtifact.baseCircuitInfo.parameters = info.resolvedFile.fileData.mainComponentData.parameters;

      await this._circuitArtifacts.saveCircuitArtifact(circuitArtifact, this._getUpdatedArtifactFileTypes(), []);
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
    const validFileTypes: Set<string> = new Set(["wasm", "c", "r1cs", "sym", "json"]);
    return Object.entries(this._config.compileFlags)
      .filter(([key, value]) => value && validFileTypes.has(key))
      .map(([key]) => key as ArtifactsFileType);
  }
  private _getLinkLibraries(): string[] {
    return [this._nodeModulesPath];
  }
}
