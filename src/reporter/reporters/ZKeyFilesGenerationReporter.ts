/* eslint-disable no-console */
import chalk from "chalk";
import { pluralize } from "hardhat/internal/util/strings";

import { BaseReporter } from "./BaseReporter";

export class ZKeyFilesGenerationReporter extends BaseReporter {
  public reportHeader(contributions: number) {
    if (this.isQuiet()) return;

    let output: string = "";

    output += `\n${chalk.italic.cyan("Second step - Generating ZKey files for circuits")}\n`;

    if (contributions > 0) {
      output += `\n> Phase-2 contributions to ZKey file ${chalk.green("enabled")}`;
      output += `\n> Contributions count: ${contributions}\n`;
    }

    output += `\nStarting generation of ZKey files:\n`;

    console.log(output);
  }

  public reportStartWithSpinner(circuitName: string): string | null {
    return this._startSpinner(circuitName, "generate-zkey", `Generating ZKey file for ${circuitName} circuit`);
  }

  public reportResult(spinnerId: string | null, circuitName: string, contributionsNumber: number) {
    if (this.isQuiet() || !spinnerId) return;

    const generationTimeMessage: string | undefined = this._getSpinnerWorkingTimeMessage(
      this._spinnerProcessor.getWorkingTime(spinnerId),
    );
    const contributionMessage: string =
      contributionsNumber !== 0 ? `with ${contributionsNumber} ${pluralize(contributionsNumber, "contribution")} ` : "";

    this._spinnerProcessor.succeedSpinner(
      spinnerId,
      `Generated ZKey file for ${chalk.italic(circuitName)} circuit ${contributionMessage}${generationTimeMessage}`,
    );
  }
}
