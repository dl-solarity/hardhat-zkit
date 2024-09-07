/* eslint-disable no-console */
import chalk from "chalk";
import { emoji } from "hardhat/internal/cli/emoji";

import { BaseReporter } from "./BaseReporter";

export class PtauFileReporter extends BaseReporter {
  public reportInfo(maxConstraintsNumber: number, ptauId: number, ptauFileFullPath?: string) {
    if (this.isQuiet()) return;

    let output: string = "";

    output += `\n${chalk.italic.cyan("First step - Ptau file setup")}\n`;

    output += `\nPtau file info:\n`;
    output += `\n> Max circuits constraints number - ${maxConstraintsNumber}`;
    output += `\n> Min required ptau ID - ${ptauId}`;

    if (ptauFileFullPath) {
      output += `\n> Found existing ptau file - ${chalk.underline(ptauFileFullPath)}`;
    } else {
      output += `\n> No matching ptau file was found`;
    }

    console.log(output);
  }

  public reportDownloadingInfo(ptauFilePath: string, downloadUrl: string) {
    if (this.isQuiet()) return;

    let output: string = "";

    output += `\nPtau downloading info:\n`;
    output += `\n> Ptau file path - ${chalk.underline(ptauFilePath)}`;
    output += `\n> Download URL - ${chalk.underline(downloadUrl)}`;

    console.log(output);
  }

  public reportDownloadingFinish() {
    if (this.isQuiet()) return;

    this._progressBarProcessor.stopProgressBar();

    console.log(`\n\n${emoji("✅ ", `${chalk.green("✔ ")}`)}Ptau file successfully downloaded`);
  }

  public reportDownloadingError() {
    if (this.isQuiet()) return;

    this._progressBarProcessor.stopProgressBar();

    console.log(`\n\n${emoji("❌ ", `${chalk.red("X ")}`)}Ptau file downloading failed`);
  }
}
