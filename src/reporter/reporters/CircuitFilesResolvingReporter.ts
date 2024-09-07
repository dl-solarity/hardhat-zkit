/* eslint-disable no-console */
import chalk from "chalk";

import { BaseReporter } from "./BaseReporter";

export class CircuitFilesResolvingReporter extends BaseReporter {
  public reportHeader() {
    if (this.isQuiet()) return;

    let output: string = "";

    output += `\n${chalk.bold("Starting circuits preparation process:")}\n`;

    console.log(output);
  }

  public reportStartWithSpinner(): string | null {
    return this._startSpinner("circuits", "files-resolving", `Resolving and parsing circuits`);
  }

  public reportResult(spinnerId: string | null) {
    if (this.isQuiet() || !spinnerId) return;

    const resolvingTimeMessage: string = this._getSpinnerWorkingTimeMessage(
      this._spinnerProcessor.getWorkingTime(spinnerId),
    );

    this._spinnerProcessor.succeedSpinner(spinnerId, `Circuits are ready for the compilation ${resolvingTimeMessage}`);
  }

  public reportFail(spinnerId: string | null) {
    if (this.isQuiet() || !spinnerId) return;

    const resolvingTimeMessage: string = this._getSpinnerWorkingTimeMessage(
      this._spinnerProcessor.getWorkingTime(spinnerId),
    );

    this._spinnerProcessor.failSpinner(spinnerId, `Failed to resolve circuit files ${resolvingTimeMessage}\n`);
  }
}
