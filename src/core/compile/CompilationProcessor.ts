import path from "path";
import os from "os";
import fs from "fs";
import fsExtra from "fs-extra";
import { v4 as uuid } from "uuid";

import { HardhatRuntimeEnvironment } from "hardhat/types";

import { CircuitAST } from "@solarity/zktype";

import { CircomCompilerFactory } from "../compiler/CircomCompilerFactory";
import { HardhatZKitError } from "../../errors";
import { CIRCUIT_ARTIFACT_VERSION, NODE_MODULES } from "../../constants";
import { Reporter } from "../../reporter";
import { getNormalizedFullPath, renameFilesRecursively, readDirRecursively } from "../../utils/path-utils";

import { ZKitConfig } from "../../types/zkit-config";
import { ArtifactsFileType, CircuitArtifact, ICircuitArtifacts } from "../../types/circuit-artifacts";
import {
  ICircomCompiler,
  IWASMCircomCompiler,
  CompilationProccessorConfig,
  CompilationInfo,
  ResolvedFileInfo,
  CompileConfig,
} from "../../types/core";

export class CompilationProcessor {
  private readonly _zkitConfig: ZKitConfig;
  private readonly _nodeModulesPath: string;
  private readonly _verbose: boolean;

  constructor(
    private readonly _config: CompilationProccessorConfig,
    private readonly _circuitArtifacts: ICircuitArtifacts,
    hre: HardhatRuntimeEnvironment,
  ) {
    this._zkitConfig = hre.config.zkit;
    this._verbose = hre.hardhatArguments.verbose;
    this._nodeModulesPath = getNormalizedFullPath(hre.config.paths.root, NODE_MODULES);

    Reporter!.verboseLog("compilation-processor", "Created CompilationProcessor with params: %O", [
      {
        config: _config,
        artifactsDirFullPath: this._circuitArtifacts.getCircuitArtifactsDirFullPath(),
      },
    ]);
  }

  public async compile(filesInfoToCompile: ResolvedFileInfo[]) {
    const tempDir: string = path.join(os.tmpdir(), ".zkit", uuid());

    try {
      fsExtra.mkdirSync(tempDir, { recursive: true });

      Reporter!.verboseLog("compilation-processor", "Compilation temp directory: %s", [tempDir]);
      Reporter!.reportCompilationProcessHeader();

      const nativeCompiler: ICircomCompiler | undefined = this._zkitConfig.nativeCompiler
        ? await CircomCompilerFactory.createNativeCircomCompiler(this._config.compilerVersion)
        : undefined;
      const wasmCompiler: IWASMCircomCompiler = CircomCompilerFactory.createWASMCircomCompiler(
        this._config.compilerVersion,
      );

      const compilationInfoArr: CompilationInfo[] = await this._getCompilationInfoArr(tempDir, filesInfoToCompile);

      await this._compileCircuits(nativeCompiler ?? wasmCompiler, wasmCompiler, compilationInfoArr);

      await this._createCircuitASTFiles(compilationInfoArr);

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

  private async _compileCircuits(
    compiler: ICircomCompiler,
    wasmCompiler: IWASMCircomCompiler,
    compilationInfoArr: CompilationInfo[],
  ) {
    for (const info of compilationInfoArr) {
      const spinnerId: string | null = Reporter!.reportCircuitCompilationStartWithSpinner(
        info.circuitName,
        info.circuitFileName,
      );

      fsExtra.mkdirSync(info.tempArtifactsPath, { recursive: true });

      const compileConfig: CompileConfig = {
        circuitFullPath: info.resolvedFile.absolutePath,
        artifactsFullPath: info.tempArtifactsPath,
        linkLibraries: this._getLinkLibraries(),
        compileFlags: this._config.compileFlags,
        quiet: !this._verbose,
      };

      await compiler.compile(compileConfig);
      await wasmCompiler.generateAST(compileConfig);

      if (info.circuitFileName !== info.circuitName) {
        renameFilesRecursively(info.tempArtifactsPath, info.circuitFileName, info.circuitName);
      }

      Reporter!.reportCircuitCompilationResult(spinnerId, info.circuitName, info.circuitFileName);
    }
  }

  private async _createCircuitASTFiles(compilationInfoArr: CompilationInfo[]) {
    compilationInfoArr.forEach((info: CompilationInfo) => {
      const compilerASTFilePath: string = getNormalizedFullPath(info.tempArtifactsPath, `${info.circuitName}_ast.json`);

      const circuitAST: CircuitAST = {
        sourcePath: info.resolvedFile.sourceName,
        circomCompilerOutput: JSON.parse(fs.readFileSync(compilerASTFilePath, "utf-8")),
      };

      fs.writeFileSync(compilerASTFilePath, JSON.stringify(circuitAST));
    });
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
          baseCircuitInfo: { constraintsNumber: 0 },
          compilerOutputFiles: {},
        };
      }

      circuitArtifact.baseCircuitInfo = { constraintsNumber: info.constraintsNumber };

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
    filesInfoToCompile: ResolvedFileInfo[],
  ): Promise<CompilationInfo[]> {
    const artifactsDirFullPath = this._circuitArtifacts.getCircuitArtifactsDirFullPath();

    return Promise.all(
      filesInfoToCompile.map(async (fileInfo: ResolvedFileInfo): Promise<CompilationInfo> => {
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
    const fileTypes: ArtifactsFileType[] = ["ast"];

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
