/* eslint-disable no-console */
import chalk from "chalk";
import { emoji } from "hardhat/internal/cli/emoji";

import { BaseReporter } from "./BaseReporter";
import { ProgressBarProcessor } from "../ProgressBarProcessor";

export class CircomCompilerReporter extends BaseReporter {
  public reportVersion(compilerVersion: string) {
    if (this.isQuiet()) return;

    let output: string = "";

    output += `\nCircom version: ${chalk.green(compilerVersion)}\n`;

    console.log(output);
  }

  public reportDownloadingInfo(version: string, isWasm: boolean) {
    if (this.isQuiet()) return;

    if (isWasm) {
      console.log(
        `\n> Failed to download proper platform compiler or OS platform is not supported, trying to download WASM Circom v${version}`,
      );
    } else {
      console.log(`\n> No proper compiler found, trying to download Circom v${version}`);
    }
  }

  public reportDownloadingFinish() {
    if (this.isQuiet()) return;

    ProgressBarProcessor!.stopProgressBar();

    console.log(`\n${emoji("✅ ", `${chalk.green("✔ ")}`)}Circom compiler successfully downloaded`);
  }

  public reportDownloadingError() {
    if (this.isQuiet()) return;

    ProgressBarProcessor!.stopProgressBar();

    console.log(`\n${emoji("❌ ", `${chalk.red("X ")}`)}Circom compiler downloading failed`);
  }
}
