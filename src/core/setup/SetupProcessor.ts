import path from "path";
import fsExtra from "fs-extra";
import os from "os";
import { randomBytes } from "crypto";
import { v4 as uuid } from "uuid";
import * as snarkjs from "snarkjs";

import { PtauDownloader } from "../utils/PtauDownloader";
import { HardhatZKitError } from "../../errors";
import { PTAU_FILE_REG_EXP } from "../../constants";
import { Reporter } from "../../reporter";
import { terminateCurve } from "../../utils/utils";
import { getNormalizedFullPath } from "../../utils/path-utils";

import { CircuitArtifact, ICircuitArtifacts } from "../../types/artifacts/circuit-artifacts";
import { ContributionSettings, ProvingSystemType } from "../../types/core";

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
   * @param circuitArtifacts An array of circuit artifacts that need to be set up
   * @param contributionSettings The contribution settings to be used during the setup process
   */
  public async setup(circuitArtifacts: CircuitArtifact[], contributionSettings: ContributionSettings) {
    const tempDir: string = path.join(os.tmpdir(), ".zkit", uuid());

    try {
      fsExtra.mkdirSync(tempDir, { recursive: true });

      Reporter!.reportSetupProcessHeader();

      const ptauFilePath: string = await this._getPtauFile(circuitArtifacts);

      await this._generateZKeyFiles(circuitArtifacts, contributionSettings, ptauFilePath);
      await this._generateVKeyFiles(circuitArtifacts);

      await Promise.all(
        circuitArtifacts.map(async (circuitArtifact: CircuitArtifact) => {
          await this._circuitArtifacts.saveCircuitArtifact(circuitArtifact, ["zkey", "vkey"]);
        }),
      );

      Reporter!.reportSetupResult(circuitArtifacts);
    } finally {
      fsExtra.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  private async _generateZKeyFiles(
    circuitArtifacts: CircuitArtifact[],
    contributionSettings: ContributionSettings,
    ptauFilePath: string,
  ) {
    const contributions: number = contributionSettings.contributions;
    const provingSystem: ProvingSystemType = contributionSettings.provingSystem;

    Reporter!.reportZKeyFilesGenerationHeader(contributions);

    try {
      for (const circuitArtifact of circuitArtifacts) {
        const r1csFilePath = circuitArtifact.compilerOutputFiles.r1cs?.fileSourcePath;
        const zkeyFilePath = this._circuitArtifacts.getCircuitArtifactFileFullPath(circuitArtifact, "zkey");

        if (!r1csFilePath) {
          throw new HardhatZKitError(`R1CS file for ${name} circuit not found. Compile circuits and try again.`);
        }

        Reporter!.verboseLog("setup-processor:zkey", "Generating ZKey file for %s circuit with params %o", [
          circuitArtifact.circuitTemplateName,
          { r1csFilePath, zkeyFilePath },
        ]);

        const spinnerId: string | null = Reporter!.reportZKeyFileGenerationStartWithSpinner(
          circuitArtifact.circuitTemplateName,
        );

        if (provingSystem === "groth16") {
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
        } else {
          throw new HardhatZKitError(`Unsupported proving system - ${provingSystem}`);
        }

        Reporter!.reportZKeyFileGenerationResult(spinnerId, circuitArtifact.circuitTemplateName, contributions);
      }
    } finally {
      await terminateCurve();
    }

    return circuitArtifacts;
  }

  private async _generateVKeyFiles(circuitArtifacts: CircuitArtifact[]) {
    Reporter!.reportVKeyFilesGenerationHeader();

    try {
      for (const circuitArtifact of circuitArtifacts) {
        const zkeyFilePath = this._circuitArtifacts.getCircuitArtifactFileFullPath(circuitArtifact, "zkey");
        const vkeyFilePath = this._circuitArtifacts.getCircuitArtifactFileFullPath(circuitArtifact, "vkey");

        Reporter!.verboseLog("setup-processor:vkey", "Generating VKey file for %s circuit with params %o", [
          circuitArtifact.circuitTemplateName,
          { zkeyFilePath, vkeyFilePath },
        ]);

        const spinnerId: string | null = Reporter!.reportVKeyFileGenerationStartWithSpinner(
          circuitArtifact.circuitTemplateName,
        );

        const vKeyData = await snarkjs.zKey.exportVerificationKey(zkeyFilePath);

        fsExtra.outputFileSync(vkeyFilePath, JSON.stringify(vKeyData));

        Reporter!.reportVKeyFileGenerationResult(spinnerId, circuitArtifact.circuitTemplateName);
      }
    } finally {
      await terminateCurve();
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
