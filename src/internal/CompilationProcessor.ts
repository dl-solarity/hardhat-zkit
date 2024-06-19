import path from "path";
import os from "os";
import fs from "fs";
import { randomBytes } from "crypto";
import { v4 as uuid } from "uuid";
import * as snarkjs from "snarkjs";

import { HardhatConfig } from "hardhat/types";

import { CircomCompilerFactory } from "./CircomCompilerFactory";
import { ICircomCompiler } from "../types/internal/circom-compiler";
import { CompilationProccessorConfig, CompilationInfo } from "../types/internal/compilation-processor";
import { ResolvedFile } from "./Resolver";
import { getNormalizedFullPath } from "../utils/path-utils";
import { HardhatZKitError } from "../tasks/errors";
import { PTAU_FILE_REG_EXP } from "./constants";
import { PtauDownloader } from "./PtauDownloader";
import { ContributionTemplateType, ZKitConfig } from "../types/zkit-config";
import { readDirRecursively } from "../utils/utils";

export class CompilationProcessor {
  private readonly _zkitConfig: ZKitConfig;
  private readonly _compiler: ICircomCompiler;

  constructor(
    private readonly _circuitsDirFullPath: string,
    private readonly _artifactsDirFullPath: string,
    private readonly _ptauDirFullPath: string,
    private readonly _config: CompilationProccessorConfig,
    hardhatConfig: HardhatConfig,
  ) {
    this._zkitConfig = hardhatConfig.zkit;
    this._compiler = CircomCompilerFactory.createCircomCompiler(_config.compilerVersion);
  }

  public async compile(filesToCompile: ResolvedFile[]) {
    const tempDir: string = path.join(os.tmpdir(), ".zkit", uuid());
    fs.mkdirSync(tempDir, { recursive: true });

    if (filesToCompile.length > 0) {
      const compilationInfoArr: CompilationInfo[] = await this._getCompilationInfoArr(tempDir, filesToCompile);

      await Promise.all(
        compilationInfoArr.map((info: CompilationInfo) => {
          fs.mkdirSync(info.tempArtifactsPath, { recursive: true });

          return this._compiler.compile({
            circuitFullPath: info.resolvedFile.absolutePath,
            artifactsFullPath: info.tempArtifactsPath,
            compileFlags: this._config.compileFlags,
            quiet: this._config.quiet,
          });
        }),
      );

      const ptauFilePath: string = await this._getPtauFile(compilationInfoArr);

      await this._generateZKeyFiles(ptauFilePath, compilationInfoArr);
      await this._generateVKeyFile(compilationInfoArr);

      await this._moveFromTemDirToArtifacts(compilationInfoArr);

      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  private async _generateZKeyFiles(ptauFilePath: string, compilationInfoArr: CompilationInfo[]) {
    const contributions: number = this._zkitConfig.compilationSettings.contributions;
    const contributionTemplate: ContributionTemplateType = this._zkitConfig.compilationSettings.contributionTemplate;

    await Promise.all(
      compilationInfoArr.map(async (info: CompilationInfo) => {
        const r1csFile = getNormalizedFullPath(info.tempArtifactsPath, `${info.circuitName}.r1cs`);
        const zKeyFile = getNormalizedFullPath(info.tempArtifactsPath, `${info.circuitName}.zkey`);

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
      }),
    );
  }

  private async _generateVKeyFile(compilationInfoArr: CompilationInfo[]) {
    await Promise.all(
      compilationInfoArr.map(async (info: CompilationInfo) => {
        const zkeyFile = getNormalizedFullPath(info.tempArtifactsPath, `${info.circuitName}.zkey`);
        const vKeyFile = getNormalizedFullPath(info.tempArtifactsPath, `${info.circuitName}.vkey.json`);

        const vKeyData = await snarkjs.zKey.exportVerificationKey(zkeyFile);

        fs.writeFileSync(vKeyFile, JSON.stringify(vKeyData));
      }),
    );
  }

  private async _moveFromTemDirToArtifacts(compilationInfoArr: CompilationInfo[]) {
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

        fs.copyFileSync(file, correspondingOutFile);
      });
    });
  }

  private async _getCompilationInfoArr(tempDir: string, filesToCompile: ResolvedFile[]): Promise<CompilationInfo[]> {
    return Promise.all(
      filesToCompile.map(async (file: ResolvedFile): Promise<CompilationInfo> => {
        const tempArtifactsPath: string = getNormalizedFullPath(tempDir, file.sourceName);

        return {
          circuitName: path.parse(file.absolutePath).name,
          artifactsPath: file.absolutePath.replace(this._circuitsDirFullPath, this._artifactsDirFullPath),
          tempArtifactsPath,
          resolvedFile: file,
        };
      }),
    );
  }

  private async _getPtauFile(compilationInfoArr: CompilationInfo[]): Promise<string> {
    const circuitsConstraintsNumber: number[] = await Promise.all(
      compilationInfoArr.map(async (info: CompilationInfo) => {
        return this._getConstraintsNumber(info);
      }),
    );

    const maxConstraintsNumber = Math.max(...circuitsConstraintsNumber);
    const ptauId = Math.max(Math.ceil(Math.log2(maxConstraintsNumber)), 8);

    let entries = [] as fs.Dirent[];

    if (fs.existsSync(this._ptauDirFullPath)) {
      entries = fs.readdirSync(this._ptauDirFullPath, { withFileTypes: true });
    }

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

    if (entry) {
      return getNormalizedFullPath(this._ptauDirFullPath, entry.name);
    } else {
      const ptauDownloader: PtauDownloader = new PtauDownloader(this._ptauDirFullPath);

      return await ptauDownloader.downloadPtau(ptauId);
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
}
