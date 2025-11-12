/* eslint-disable no-console */
import chalk from "chalk";
import { capitalize } from "lodash-es";

import { pluralize } from "@nomicfoundation/hardhat-utils/string";

import { ProvingSystemType } from "@solarity/zkit";

import { SetupContributionSettings } from "../../types/core/index.js";
import { BaseReporter } from "./BaseReporter.js";
import { SpinnerProcessor } from "../SpinnerProcessor.js";

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
        ? `with ${contributionsNumber} ${pluralize("contribution", contributionsNumber)} `
        : "";

    SpinnerProcessor!.succeedSpinner(
      spinnerId,
      `Generated ${capitalize(provingSystem)} ZKey file for ${chalk.italic(circuitName)} circuit ${contributionMessage}${generationTimeMessage}`,
    );
  }
}
