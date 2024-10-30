import path from "path";
import fsExtra from "fs-extra";
import os from "os";
import { randomBytes } from "crypto";
import { v4 as uuid } from "uuid";
import * as snarkjs from "snarkjs";

import { ProvingSystemType } from "@solarity/zkit";

import { HardhatZKitError } from "../../errors";
import { PROVING_SYSTEM_CONSTRAINTS_MULTIPLIERS, PTAU_FILE_REG_EXP } from "../../constants";
import { Reporter } from "../../reporter";
import { PtauDownloader } from "../utils/PtauDownloader";
import { getNormalizedFullPath } from "../../utils/path-utils";

import { ICircuitArtifacts } from "../../types/artifacts/circuit-artifacts";
import { CircuitSetupInfo, SetupContributionSettings } from "../../types/core";

/**
 * Class responsible for processing the setup of circuit artifacts.
 *
 * This class facilitates the setup of circuits by generating the necessary
 * cryptographic keys and artifacts required for zero-knowledge proofs.
 * It utilizes temporary directories for managing intermediate files and
 * provides methods for generating both ZKey and VKey files for the specified
 * circuit artifacts, ensuring a streamlined setup process.
 *
 * The setup process involves key generation and artifact saving, with
 * appropriate error handling and reporting mechanisms in place.
 */
export class SetupProcessor {
  constructor(
    private readonly _ptauDirFullPath: string,
    private readonly _circuitArtifacts: ICircuitArtifacts,
  ) {}

  /**
   * Function responsible for setting up circuits, using relevant artifacts and contribution settings.
   *
   * The setup process involves the following steps:
   * 1. Creates a temporary directory for storing intermediate files during the setup process
   * 2. Retrieves the required PTAU file path for the specified circuit artifacts
   * 3. Generates ZKey files for the circuit artifacts using the provided contribution settings and PTAU file
   * 4. Generates VKey files for the circuit artifacts
   * 5. Saves the circuit artifacts with the generated ZKey and VKey files
   *
   * @param circuitSetupInfoArr An array of {@link CircuitSetupInfo} objects,
   *    each containing the information required to set up specific circuits
   * @param contributionSettings The settings for the setup process, specifying the necessary proving systems
   *    and the number of contributions for the `Groth16` proving system
   */
  public async setup(circuitSetupInfoArr: CircuitSetupInfo[], contributionSettings: SetupContributionSettings) {
    const tempDir: string = path.join(os.tmpdir(), ".zkit", uuid());

    try {
      fsExtra.mkdirSync(tempDir, { recursive: true });

      Reporter!.reportSetupProcessHeader();

      const ptauFilePath: string = await this._getPtauFile(circuitSetupInfoArr, contributionSettings.provingSystems);

      await this._generateZKeyFiles(circuitSetupInfoArr, contributionSettings, ptauFilePath);
      await this._generateVKeyFiles(circuitSetupInfoArr);

      await Promise.all(
        circuitSetupInfoArr.map(async (setupInfo: CircuitSetupInfo) => {
          await this._circuitArtifacts.saveCircuitArtifact(
            setupInfo.circuitArtifact,
            ["zkey", "vkey"],
            setupInfo.provingSystems,
          );
        }),
      );

      Reporter!.reportSetupResult(circuitSetupInfoArr);
    } finally {
      fsExtra.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  private async _generateZKeyFiles(
    circuitSetupInfoArr: CircuitSetupInfo[],
    contributionSettings: SetupContributionSettings,
    ptauFilePath: string,
  ) {
    const contributions: number = contributionSettings.contributions;

    Reporter!.reportZKeyFilesGenerationHeader(contributions);

    for (const setupInfo of circuitSetupInfoArr) {
      const r1csFilePath = setupInfo.circuitArtifact.compilerOutputFiles.r1cs!.fileSourcePath;

      const spinnerId: string | null = Reporter!.reportZKeyFileGenerationStartWithSpinner(
        setupInfo.circuitArtifact.circuitTemplateName,
      );

      for (const provingSystem of setupInfo.provingSystems) {
        const zkeyFilePath = this._circuitArtifacts.getCircuitArtifactFileFullPath(
          setupInfo.circuitArtifact,
          "zkey",
          provingSystem,
        );

        Reporter!.verboseLog(
          "setup-processor:zkey",
          "Generating ZKey file for %s circuit with %s proving system and params %o",
          [setupInfo.circuitArtifact.circuitTemplateName, provingSystem, { r1csFilePath, zkeyFilePath }],
        );

        switch (provingSystem) {
          case "groth16":
            await this._generateGroth16ZKeyFile(r1csFilePath, ptauFilePath, zkeyFilePath, contributions);
            break;
          case "plonk":
            await this._generatePlonkZKeyFile(r1csFilePath, ptauFilePath, zkeyFilePath);
            break;
          default:
            throw new HardhatZKitError(`Unsupported proving system - ${provingSystem}`);
        }
      }

      Reporter!.reportZKeyFileGenerationResult(spinnerId, setupInfo.circuitArtifact.circuitTemplateName, contributions);
    }
  }

  private async _generateVKeyFiles(circuitSetupInfoArr: CircuitSetupInfo[]) {
    Reporter!.reportVKeyFilesGenerationHeader();

    for (const setupInfo of circuitSetupInfoArr) {
      const spinnerId: string | null = Reporter!.reportVKeyFileGenerationStartWithSpinner(
        setupInfo.circuitArtifact.circuitTemplateName,
      );

      for (const provingSystem of setupInfo.provingSystems) {
        const zkeyFilePath = this._circuitArtifacts.getCircuitArtifactFileFullPath(
          setupInfo.circuitArtifact,
          "zkey",
          provingSystem,
        );
        const vkeyFilePath = this._circuitArtifacts.getCircuitArtifactFileFullPath(
          setupInfo.circuitArtifact,
          "vkey",
          provingSystem,
        );

        Reporter!.verboseLog(
          "setup-processor:vkey",
          "Generating VKey file for %s circuit with %s proving system and params %o",
          [setupInfo.circuitArtifact.circuitTemplateName, provingSystem, { zkeyFilePath, vkeyFilePath }],
        );

        const vKeyData = await snarkjs.zKey.exportVerificationKey(zkeyFilePath);

        fsExtra.outputFileSync(vkeyFilePath, JSON.stringify(vKeyData));
      }

      Reporter!.reportVKeyFileGenerationResult(spinnerId, setupInfo.circuitArtifact.circuitTemplateName);
    }
  }

  private async _generateGroth16ZKeyFile(
    r1csFilePath: string,
    ptauFilePath: string,
    zkeyFilePath: string,
    contributions: number,
  ) {
    await snarkjs.zKey.newZKey(r1csFilePath, ptauFilePath, zkeyFilePath);

    const zKeyFileNext = `${zkeyFilePath}.next.zkey`;

    for (let i = 0; i < contributions; ++i) {
      await snarkjs.zKey.contribute(
        zkeyFilePath,
        zKeyFileNext,
        `${zkeyFilePath}_contribution_${i}`,
        randomBytes(32).toString("hex"),
      );

      fsExtra.rmSync(zkeyFilePath);
      fsExtra.renameSync(zKeyFileNext, zkeyFilePath);
    }
  }

  private async _generatePlonkZKeyFile(r1csFilePath: string, ptauFilePath: string, zkeyFilePath: string) {
    await snarkjs.plonk.setup(r1csFilePath, ptauFilePath, zkeyFilePath);
  }

  private async _getPtauFile(
    circuitSetupInfoArr: CircuitSetupInfo[],
    provingSystems: ProvingSystemType[],
  ): Promise<string> {
    const circuitsConstraintsNumber: number[] = await Promise.all(
      circuitSetupInfoArr.map(async (setupInfo: CircuitSetupInfo) => {
        return setupInfo.circuitArtifact.baseCircuitInfo.constraintsNumber;
      }),
    );

    const maxConstraintsNumber = Math.max(...circuitsConstraintsNumber);
    let provingSystemMultiplier = 1;

    for (const provingSystem of provingSystems) {
      const currentMultiplier = PROVING_SYSTEM_CONSTRAINTS_MULTIPLIERS[provingSystem];

      if (currentMultiplier && currentMultiplier > provingSystemMultiplier) {
        provingSystemMultiplier = currentMultiplier;
      }
    }

    const ptauId = Math.max(Math.ceil(Math.log2(maxConstraintsNumber * provingSystemMultiplier)), 8);

    let entries: fsExtra.Dirent[] = [];

    if (fsExtra.existsSync(this._ptauDirFullPath)) {
      entries = fsExtra.readdirSync(this._ptauDirFullPath, { withFileTypes: true });
    }

    Reporter!.verboseLog("setup-processor", "Found entries in ptau directory: %o", [
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
