/* eslint-disable no-console */
import chalk from "chalk";

import { BaseReporter } from "./BaseReporter";
import { SpinnerProcessor } from "../SpinnerProcessor";

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
      SpinnerProcessor!.getWorkingTime(spinnerId),
    );

    SpinnerProcessor!.succeedSpinner(spinnerId, `Circuits are ready for the compilation ${resolvingTimeMessage}`);
  }

  public reportFail(spinnerId: string | null) {
    if (this.isQuiet() || !spinnerId) return;

    const resolvingTimeMessage: string = this._getSpinnerWorkingTimeMessage(
      SpinnerProcessor!.getWorkingTime(spinnerId),
    );

    SpinnerProcessor!.failSpinner(spinnerId, `Failed to resolve circuit files ${resolvingTimeMessage}\n`);
  }
}
