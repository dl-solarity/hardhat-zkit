import path from "path";
import fs from "fs";
import os from "os";
import { randomBytes } from "crypto";
import { v4 as uuid } from "uuid";
import * as snarkjs from "snarkjs";

import { Reporter } from "../reporter";
import { HardhatZKitError } from "../errors";
import { PTAU_FILE_REG_EXP } from "../constants";
import { getNormalizedFullPath } from "../utils/path-utils";
import { PtauDownloader } from "../compile/utils/PtauDownloader";
import { ContributionSettings, ContributionTemplateType } from "../types/setup/setup-processor";
import { CircuitArtifact, ICircuitArtifacts } from "../types/circuit-artifacts";

export class SetupProcessor {
  constructor(
    private readonly _ptauDirFullPath: string,
    private readonly _circuitArtifacts: ICircuitArtifacts,
  ) {}

  public async setup(circuitArtifacts: CircuitArtifact[], contributionSettings: ContributionSettings) {
    const tempDir: string = path.join(os.tmpdir(), ".zkit", uuid());

    try {
      fs.mkdirSync(tempDir, { recursive: true });

      const ptauFilePath: string = await this._getPtauFile(circuitArtifacts);

      await this._generateZKeyFiles(circuitArtifacts, contributionSettings, ptauFilePath);
      await this._generateVKeyFiles(circuitArtifacts);

      Promise.all(
        circuitArtifacts.map(async (circuitArtifact: CircuitArtifact) => {
          await this._circuitArtifacts.saveCircuitArtifact(circuitArtifact, ["zkey", "vkey"]);
        }),
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  private async _generateZKeyFiles(
    circuitArtifacts: CircuitArtifact[],
    contributionSettings: ContributionSettings,
    ptauFilePath: string,
  ) {
    const contributions: number = contributionSettings.contributions;
    const contributionTemplate: ContributionTemplateType = contributionSettings.contributionTemplate;

    Reporter!.reportZKeyFilesGenerationHeader(contributions);

    for (const circuitArtifact of circuitArtifacts) {
      const r1csFilePath = circuitArtifact.compilerOutputFiles.r1cs?.fileSourcePath;
      const zkeyFilePath = this._circuitArtifacts.getCircuitArtifactFileFullPath(circuitArtifact, "zkey");

      if (!r1csFilePath) {
        throw new HardhatZKitError(`R1CS file for ${name} circuit not found. Compile circuits and try again.`);
      }

      Reporter!.verboseLog("compilation-processor:zkey", "Generating ZKey file for %s circuit with params %o", [
        circuitArtifact.circuitTemplateName,
        { r1csFilePath, zkeyFilePath },
      ]);

      const spinnerId: string | null = Reporter!.reportZKeyFileGenerationStartWithSpinner(
        circuitArtifact.circuitTemplateName,
      );

      if (contributionTemplate === "groth16") {
        await snarkjs.zKey.newZKey(r1csFilePath, ptauFilePath, zkeyFilePath);

        const zKeyFileNext = `${zkeyFilePath}.next.zkey`;

        for (let i = 0; i < contributions; ++i) {
          await snarkjs.zKey.contribute(
            zkeyFilePath,
            zKeyFileNext,
            `${zkeyFilePath}_contribution_${i}`,
            randomBytes(32).toString("hex"),
          );

          fs.rmSync(zkeyFilePath);
          fs.renameSync(zKeyFileNext, zkeyFilePath);
        }
      } else {
        throw new HardhatZKitError(`Unsupported contribution template - ${contributionTemplate}`);
      }

      Reporter!.reportZKeyFileGenerationResult(spinnerId, circuitArtifact.circuitTemplateName, contributions);
    }

    return circuitArtifacts;
  }

  private async _generateVKeyFiles(circuitArtifacts: CircuitArtifact[]) {
    Reporter!.reportVKeyFilesGenerationHeader();

    for (const circuitArtifact of circuitArtifacts) {
      const zkeyFilePath = this._circuitArtifacts.getCircuitArtifactFileFullPath(circuitArtifact, "zkey");
      const vkeyFilePath = this._circuitArtifacts.getCircuitArtifactFileFullPath(circuitArtifact, "vkey");

      Reporter!.verboseLog("compilation-processor:vkey", "Generating VKey file for %s circuit with params %o", [
        circuitArtifact.circuitTemplateName,
        { zkeyFilePath, vkeyFilePath },
      ]);

      const spinnerId: string | null = Reporter!.reportVKeyFileGenerationStartWithSpinner(
        circuitArtifact.circuitTemplateName,
      );

      const vKeyData = await snarkjs.zKey.exportVerificationKey(zkeyFilePath);

      fs.writeFileSync(vkeyFilePath, JSON.stringify(vKeyData));

      Reporter!.reportVKeyFileGenerationResult(spinnerId, circuitArtifact.circuitTemplateName);
    }
  }

  private async _getPtauFile(circuitArtifacts: CircuitArtifact[]): Promise<string> {
    const circuitsConstraintsNumber: number[] = await Promise.all(
      circuitArtifacts.map(async (circuitArtifact: CircuitArtifact) => {
        return circuitArtifact.baseCircuitInfo.constraintsNumber;
      }),
    );

    const maxConstraintsNumber = Math.max(...circuitsConstraintsNumber);
    const ptauId = Math.max(Math.ceil(Math.log2(maxConstraintsNumber)), 8);

    let entries: fs.Dirent[] = [];

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
}
