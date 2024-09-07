/* eslint-disable no-console */
import chalk from "chalk";

import { BaseReporter } from "./BaseReporter";

export class ProgressReporter extends BaseReporter {
  public reportNothingTo(action: string) {
    if (this.isQuiet()) return;

    console.log(`\n${chalk.bold(`Nothing to ${action}.`)}\n`);
  }

  public reportStartFileDownloadingWithProgressBar(totalValue: number, startValue: number) {
    if (this.isQuiet()) return;

    console.log();

    this._progressBarProcessor.createAndStartProgressBar(
      {
        formatValue: this._progressBarProcessor.formatToMB,
        format: "Downloading [{bar}] {percentage}% | {value}/{total} MB | Time elapsed: {duration}s",
        hideCursor: true,
      },
      totalValue,
      startValue,
    );
  }

  public updateProgressBarValue(valueToAdd: number) {
    this._progressBarProcessor.updateProgressBar(valueToAdd);
  }
}
