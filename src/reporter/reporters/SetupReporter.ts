/* eslint-disable no-console */
import fs from "fs";
import chalk from "chalk";
import { capitalize } from "lodash";

import { BaseReporter } from "./BaseReporter";
import { CircuitArtifacts } from "../../artifacts/CircuitArtifacts";
import { HardhatZKitError } from "../../errors";
import { BYTES_IN_MB } from "../../constants";

import { CircuitSetupInfo } from "../../types/core";

export class SetupReporter extends BaseReporter {
  public reportHeader() {
    if (this.isQuiet()) return;

    let output: string = "";

    output += `\n${chalk.bold("Starting keys setup process:")}`;

    console.log(output);
  }

  public reportCircuitList(allCircuitsSetupInfo: CircuitSetupInfo[], filteredCircuitsSetupInfo: CircuitSetupInfo[]) {
    if (this.isQuiet()) return;

    if (filteredCircuitsSetupInfo.length > 0) {
      let filesToSetupMessage: string = `\n${chalk.bold("Circuits to setup:")}\n`;

      for (const setupInfo of filteredCircuitsSetupInfo) {
        filesToSetupMessage += `\n${chalk.green(">")} ${chalk.italic(setupInfo.circuitArtifact.circuitSourceName)}`;
      }

      console.log(filesToSetupMessage);
    }

    const skippedFiles: CircuitSetupInfo[] = allCircuitsSetupInfo.filter(
      (setupInfo: CircuitSetupInfo) => !filteredCircuitsSetupInfo.includes(setupInfo),
    );

    if (skippedFiles.length > 0) {
      let skippedFilesMessage: string = `\n${chalk.bold("Setup skipped for:")}\n`;

      for (const file of skippedFiles) {
        skippedFilesMessage += `\n${chalk.yellow(">")} ${chalk.italic.grey(file.circuitArtifact.circuitSourceName)}`;
      }

      console.log(skippedFilesMessage);
    }
  }

  public reportResult(circuitSetupInfoArr: CircuitSetupInfo[]) {
    if (this.isQuiet()) return;

    let output: string = "";
    const circuitsMessage: string =
      circuitSetupInfoArr.length > 1 ? `${circuitSetupInfoArr.length} circuits` : `one circuit`;

    output += `\n${chalk.bold(`Successfully generated keys for ${circuitsMessage}.`)}\n`;

    const table = this._getCLITable();

    table.push([
      { content: chalk.bold("Circuit Name") },
      { content: chalk.bold("Proving system") },
      { content: chalk.bold(`ZKey file size (MB)`) },
    ]);

    for (const setupInfo of circuitSetupInfoArr) {
      for (const provingSystem of setupInfo.provingSystems) {
        table.push([
          { content: setupInfo.circuitArtifact.circuitTemplateName },
          { content: capitalize(provingSystem), hAlign: "left" },
          {
            content: this._getFileSizeInMB(
              setupInfo.circuitArtifact.compilerOutputFiles[
                CircuitArtifacts.getArtifactOutputFileKey("zkey", provingSystem)
              ]?.fileSourcePath,
            ),
            hAlign: "right",
          },
        ]);
      }
    }

    output += `\n${table.toString()}\n`;

    console.log(output);
  }

  private _getFileSizeInMB(filePath: string | undefined): string {
    if (!filePath) {
      throw new HardhatZKitError("File path is undefined. Unable to get file size.");
    }

    const fileSize: number = fs.statSync(filePath).size;

    return (fileSize / BYTES_IN_MB).toFixed(3);
  }
}
