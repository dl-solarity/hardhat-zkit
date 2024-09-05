/* eslint-disable no-console */
import chalk from "chalk";
import { emoji } from "hardhat/internal/cli/emoji";

import { BaseReporter } from "./BaseReporter";

export class CircomCompilerReporter extends BaseReporter {
  public reportVersion(compilerVersion: string) {
    if (this.isQuiet()) return;

    let output: string = "";

    output += `\n${chalk.bold("Compiler version:")} ${chalk.green(compilerVersion)}\n`;

    console.log(output);
  }

  public reportDownloadingInfo(version: string, isWasm: boolean) {
    if (this.isQuiet()) return;

    if (isWasm) {
      console.log(
        `Failed to download proper platform compiler or OS platform is not supported, trying to download WASM Circom compiler v${version}`,
      );
    } else {
      console.log(`No proper compiler found, trying to download the latest available Circom compiler v${version}`);
    }
  }

  public reportDownloadingFinish() {
    if (this.isQuiet()) return;

    this._progressBarProcessor.stopProgressBar();

    console.log(`\n${emoji("✅ ", `${chalk.green("✔ ")}`)}Circom compiler successfully downloaded`);
  }

  public reportDownloadingError() {
    if (this.isQuiet()) return;

    this._progressBarProcessor.stopProgressBar();

    console.log(`\n${emoji("❌ ", `${chalk.red("X ")}`)}Circom compiler downloading failed`);
  }
}
