/* eslint-disable no-console */
import chalk from "chalk";
import { capitalize } from "lodash";

import { pluralize } from "hardhat/internal/util/strings";

import { ProvingSystemType } from "@solarity/zkit";

import { BaseReporter } from "./BaseReporter";
import { SpinnerProcessor } from "../SpinnerProcessor";

import { SetupContributionSettings } from "../../../src/types/core";

export class ZKeyFilesGenerationReporter extends BaseReporter {
  public reportHeader(contributionSettings: SetupContributionSettings) {
    if (this.isQuiet()) return;

    let output: string = "";

    output += `\n${chalk.italic.cyan("Second step - Generating ZKey files for circuits")}\n`;

    output += `\n> Configured proving systems: ${contributionSettings.provingSystems.map((provingSystem) => capitalize(provingSystem)).join(", ")}\n`;

    if (contributionSettings.provingSystems.includes("groth16") && contributionSettings.contributions > 0) {
      output += `> Groth16 Phase-2 contributions to ZKey file ${chalk.green("enabled")}`;
      output += `\n> Contributions count: ${contributionSettings.contributions}\n`;
    }

    output += `\nStarting generation of ZKey files:\n`;

    console.log(output);
  }

  public reportStartWithSpinner(circuitName: string, provingSystem: ProvingSystemType): string | null {
    return this._startSpinner(
      circuitName,
      "generate-zkey",
      `Generating ${capitalize(provingSystem)} ZKey file for ${circuitName} circuit`,
    );
  }

  public reportResult(
    spinnerId: string | null,
    circuitName: string,
    provingSystem: ProvingSystemType,
    contributionsNumber: number,
  ) {
    if (this.isQuiet() || !spinnerId) return;

    const generationTimeMessage: string | undefined = this._getSpinnerWorkingTimeMessage(
      SpinnerProcessor!.getWorkingTime(spinnerId),
    );
    const contributionMessage: string =
      provingSystem === "groth16" && contributionsNumber !== 0
        ? `with ${contributionsNumber} ${pluralize(contributionsNumber, "contribution")} `
        : "";

    SpinnerProcessor!.succeedSpinner(
      spinnerId,
      `Generated ${capitalize(provingSystem)} ZKey file for ${chalk.italic(circuitName)} circuit ${contributionMessage}${generationTimeMessage}`,
    );
  }
}
