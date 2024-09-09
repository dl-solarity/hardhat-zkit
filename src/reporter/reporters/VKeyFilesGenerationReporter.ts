/* eslint-disable no-console */
import chalk from "chalk";
import { BaseReporter } from "./BaseReporter";
import { SpinnerProcessor } from "../SpinnerProcessor";

export class VKeyFilesGenerationReporter extends BaseReporter {
  public reportHeader() {
    if (this.isQuiet()) return;

    let output: string = "";

    output += `\n${chalk.italic.cyan("Third step - Generating VKey files for circuits")}\n`;

    output += `\nStarting generation of VKey files:\n`;

    console.log(output);
  }

  public reportStartWithSpinner(circuitName: string): string | null {
    return this._startSpinner(circuitName, "generate-vkey", `Generating VKey file for ${circuitName} circuit`);
  }

  public reportResult(spinnerId: string | null, circuitName: string) {
    if (this.isQuiet() || !spinnerId) return;

    const generationTimeMessage: string = this._getSpinnerWorkingTimeMessage(
      SpinnerProcessor!.getWorkingTime(spinnerId),
    );

    SpinnerProcessor!.succeedSpinner(
      spinnerId,
      `Generated VKey file for ${chalk.italic(circuitName)} circuit ${generationTimeMessage}`,
    );
  }
}
