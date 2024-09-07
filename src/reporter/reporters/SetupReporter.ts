/* eslint-disable no-console */
import fs from "fs";
import chalk from "chalk";

import { BaseReporter } from "./BaseReporter";
import { CircuitSetupInfo } from "../../types/core";
import { CircuitArtifact } from "../../types/artifacts/circuit-artifacts";
import { HardhatZKitError } from "../../errors";
import { BYTES_IN_MB } from "../../constants";

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

  public reportResult(circuitArtifacts: CircuitArtifact[]) {
    if (this.isQuiet()) return;

    let output: string = "";
    const circuitsMessage: string = circuitArtifacts.length > 1 ? `${circuitArtifacts.length} circuits` : `one circuit`;

    output += `\n${chalk.bold(`Successfully generated keys for ${circuitsMessage}.`)}\n`;

    const table = this._getCLITable();

    table.push([{ content: chalk.bold("Circuit Name") }, { content: chalk.bold(`ZKey file size (MB)`) }]);

    for (const circuitArtifact of circuitArtifacts) {
      table.push([
        { content: circuitArtifact.circuitTemplateName },
        { content: this._getFileSizeInMB(circuitArtifact.compilerOutputFiles.zkey?.fileSourcePath), hAlign: "right" },
      ]);
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
