import path from "path";
import os from "os";
import fs from "fs";
import { randomBytes } from "crypto";
import { v4 as uuid } from "uuid";
import * as snarkjs from "snarkjs";

import { HardhatRuntimeEnvironment } from "hardhat/types";

import { CircomCompilerFactory } from "./CircomCompilerFactory";
import { ICircomCompiler, CompilationProccessorConfig, CompilationInfo, ResolvedFileInfo } from "../../types/compile";
import { ContributionTemplateType, ZKitConfig } from "../../types/zkit-config";

import { PtauDownloader } from "../utils/PtauDownloader";
import { getNormalizedFullPath, renameFilesRecursively, readDirRecursively } from "../../utils/path-utils";
import { HardhatZKitError } from "../../errors";
import { NODE_MODULES, PTAU_FILE_REG_EXP } from "../../constants";
import { Reporter } from "../../reporter";

export class CompilationProcessor {
  private readonly _zkitConfig: ZKitConfig;
  private readonly _compiler: ICircomCompiler;
  private readonly _nodeModulesPath: string;
  private readonly _verbose: boolean;

  constructor(
    private readonly _circuitsDirFullPath: string,
    private readonly _artifactsDirFullPath: string,
    private readonly _ptauDirFullPath: string,
    private readonly _config: CompilationProccessorConfig,
    hre: HardhatRuntimeEnvironment,
  ) {
    this._zkitConfig = hre.config.zkit;
    this._compiler = CircomCompilerFactory.createCircomCompiler(_config.compilerVersion);
    this._verbose = hre.hardhatArguments.verbose;
    this._nodeModulesPath = getNormalizedFullPath(hre.config.paths.root, NODE_MODULES);

    Reporter!.verboseLog("compilation-processor", "Created CompilationProcessor with params: %O", [
      {
        circuitsDirFullPath: _circuitsDirFullPath,
        artifactsDirFullPath: _artifactsDirFullPath,
        ptauDirFullPath: _ptauDirFullPath,
        config: _config,
      },
    ]);
  }

  public async compile(filesInfoToCompile: ResolvedFileInfo[]) {
    if (filesInfoToCompile.length > 0) {
      const tempDir: string = path.join(os.tmpdir(), ".zkit", uuid());
      fs.mkdirSync(tempDir, { recursive: true });

      Reporter!.verboseLog("compilation-processor", "Compilation temp directory: %s", [tempDir]);
      Reporter!.reportCompilationProcessHeader();

      const compilationInfoArr: CompilationInfo[] = await this._getCompilationInfoArr(tempDir, filesInfoToCompile);

      await this._compileCircuits(compilationInfoArr);

      const ptauFilePath: string = await this._getPtauFile(compilationInfoArr);

      await this._generateZKeyFiles(ptauFilePath, compilationInfoArr);
      await this._generateVKeyFile(compilationInfoArr);

      await this._moveFromTempDirToArtifacts(compilationInfoArr);

      Reporter!.reportCompilationResult(compilationInfoArr);

      fs.rmSync(tempDir, { recursive: true, force: true });
    } else {
      Reporter!.reportNothingToCompile();
    }
  }

  private async _compileCircuits(compilationInfoArr: CompilationInfo[]) {
    for (const info of compilationInfoArr) {
      const spinnerId: string | null = Reporter!.reportCircuitCompilationStartWithSpinner(info.circuitName);

      fs.mkdirSync(info.tempArtifactsPath, { recursive: true });

      await this._compiler.compile({
        circuitFullPath: info.resolvedFile.absolutePath,
        artifactsFullPath: info.tempArtifactsPath,
        linkLibraries: this._getLinkLibraries(),
        compileFlags: this._config.compileFlags,
        quiet: !this._verbose,
      });

      if (info.circuitFileName !== info.circuitName) {
        renameFilesRecursively(info.tempArtifactsPath, info.circuitFileName, info.circuitName);
      }

      Reporter!.reportCircuitCompilationResult(spinnerId, info.circuitName);
    }
  }

  private async _generateZKeyFiles(ptauFilePath: string, compilationInfoArr: CompilationInfo[]) {
    const contributions: number = this._zkitConfig.compilationSettings.contributions;
    const contributionTemplate: ContributionTemplateType = this._zkitConfig.compilationSettings.contributionTemplate;

    Reporter!.reportZKeyFilesGenerationHeader(contributions);

    for (const info of compilationInfoArr) {
      const r1csFile = getNormalizedFullPath(info.tempArtifactsPath, `${info.circuitName}.r1cs`);
      const zKeyFile = getNormalizedFullPath(info.tempArtifactsPath, `${info.circuitName}.zkey`);

      Reporter!.verboseLog("compilation-processor:zkey", "Generating ZKey file for %s circuit with params %o", [
        info.circuitName,
        { r1csFile, zKeyFile },
      ]);

      const spinnerId: string | null = Reporter!.reportZKeyFileGenerationStartWithSpinner(info.circuitName);

      if (contributionTemplate === "groth16") {
        await snarkjs.zKey.newZKey(r1csFile, ptauFilePath, zKeyFile);

        const zKeyFileNext = `${zKeyFile}.next.zkey`;

        for (let i = 0; i < contributions; ++i) {
          await snarkjs.zKey.contribute(
            zKeyFile,
            zKeyFileNext,
            `${zKeyFile}_contribution_${i}`,
            randomBytes(32).toString("hex"),
          );

          fs.rmSync(zKeyFile);
          fs.renameSync(zKeyFileNext, zKeyFile);
        }
      } else {
        throw new HardhatZKitError(`Unsupported contribution template - ${contributionTemplate}`);
      }

      Reporter!.reportZKeyFileGenerationResult(spinnerId, info.circuitName, contributions);
    }
  }

  private async _generateVKeyFile(compilationInfoArr: CompilationInfo[]) {
    Reporter!.reportVKeyFilesGenerationHeader();

    for (const info of compilationInfoArr) {
      const zkeyFile = getNormalizedFullPath(info.tempArtifactsPath, `${info.circuitName}.zkey`);
      const vKeyFile = getNormalizedFullPath(info.tempArtifactsPath, `${info.circuitName}.vkey.json`);

      Reporter!.verboseLog("compilation-processor:vkey", "Generating VKey file for %s circuit with params %o", [
        info.circuitName,
        { zkeyFile, vKeyFile },
      ]);

      const spinnerId: string | null = Reporter!.reportVKeyFileGenerationStartWithSpinner(info.circuitName);

      const vKeyData = await snarkjs.zKey.exportVerificationKey(zkeyFile);

      fs.writeFileSync(vKeyFile, JSON.stringify(vKeyData));

      Reporter!.reportVKeyFileGenerationResult(spinnerId, info.circuitName);
    }
  }

  private async _moveFromTempDirToArtifacts(compilationInfoArr: CompilationInfo[]) {
    compilationInfoArr.forEach((info: CompilationInfo) => {
      fs.mkdirSync(info.artifactsPath, { recursive: true });

      readDirRecursively(info.tempArtifactsPath, (dir: string, file: string) => {
        const correspondingOutDir = path.join(info.artifactsPath, path.relative(info.tempArtifactsPath, dir));
        const correspondingOutFile = path.join(info.artifactsPath, path.relative(info.tempArtifactsPath, file));

        if (!fs.existsSync(correspondingOutDir)) {
          fs.mkdirSync(correspondingOutDir);
        }

        if (fs.existsSync(correspondingOutFile)) {
          fs.rmSync(correspondingOutFile);
        }

        Reporter!.verboseLog("compilation-processor:copying", "Copying file from temp directory to artifacts: %o", [
          { file, correspondingOutFile },
        ]);

        fs.copyFileSync(file, correspondingOutFile);
      });
    });
  }

  private async _getCompilationInfoArr(
    tempDir: string,
    filesInfoToCompile: ResolvedFileInfo[],
  ): Promise<CompilationInfo[]> {
    return Promise.all(
      filesInfoToCompile.map(async (fileInfo: ResolvedFileInfo): Promise<CompilationInfo> => {
        return {
          circuitName: fileInfo.circuitName,
          circuitFileName: path.parse(fileInfo.resolvedFile.absolutePath).name,
          artifactsPath: fileInfo.resolvedFile.absolutePath.replace(
            this._circuitsDirFullPath,
            this._artifactsDirFullPath,
          ),
          tempArtifactsPath: getNormalizedFullPath(tempDir, fileInfo.resolvedFile.sourceName),
          resolvedFile: fileInfo.resolvedFile,
          constraintsNumber: 0,
        };
      }),
    );
  }

  private async _getPtauFile(compilationInfoArr: CompilationInfo[]): Promise<string> {
    const circuitsConstraintsNumber: number[] = await Promise.all(
      compilationInfoArr.map(async (info: CompilationInfo) => {
        const constraintsNumber: number = this._getConstraintsNumber(info);
        info.constraintsNumber = constraintsNumber;

        return constraintsNumber;
      }),
    );

    const maxConstraintsNumber = Math.max(...circuitsConstraintsNumber);
    const ptauId = Math.max(Math.ceil(Math.log2(maxConstraintsNumber)), 8);

    let entries = [] as fs.Dirent[];

    if (fs.existsSync(this._ptauDirFullPath)) {
      entries = fs.readdirSync(this._ptauDirFullPath, { withFileTypes: true });
    }

    Reporter!.verboseLog("compilation-processor", "Found entries in ptau directory: %o", [
      entries.map((entry) => entry.name),
    ]);

    const entry = entries.find((entry) => {
      if (!entry.isFile()) {
        return false;
      }

      const match = entry.name.match(PTAU_FILE_REG_EXP);

      if (!match) {
        return false;
      }

      return ptauId <= parseInt(match[1]);
    });

    const ptauFileFullPath: string | undefined = entry
      ? getNormalizedFullPath(this._ptauDirFullPath, entry.name)
      : undefined;

    Reporter!.reportPtauFileInfo(maxConstraintsNumber, ptauId, ptauFileFullPath);

    if (ptauFileFullPath) {
      return ptauFileFullPath;
    } else {
      return PtauDownloader.downloadPtau(this._ptauDirFullPath, ptauId);
    }
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
