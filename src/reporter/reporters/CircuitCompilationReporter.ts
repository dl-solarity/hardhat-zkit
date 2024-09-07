/* eslint-disable no-console */
import chalk from "chalk";

import { CompilationInfo } from "../../types/core";
import { BaseReporter } from "./BaseReporter";

export class CircuitCompilationReporter extends BaseReporter {
  public reportHeader() {
    if (this.isQuiet()) return;

    let output: string = "";

    output += `\n${chalk.bold("Starting compilation process:")}`;

    console.log(output);
  }

  public reportCircuitListToCompile(filteredSourceNames: string[], filteredSourceNamesToCompile: string[]) {
    if (this.isQuiet()) return;

    if (filteredSourceNamesToCompile.length > 0) {
      let filesToCompileMessage: string = `\n${chalk.bold("Circuits to compile:")}\n`;

      for (const sourceName of filteredSourceNamesToCompile) {
        filesToCompileMessage += `\n${chalk.green(">")} ${chalk.italic(sourceName)}`;
      }

      console.log(filesToCompileMessage);
    }

    const skippedSourceNames: string[] = filteredSourceNames.filter(
      (sourceName: string) => !filteredSourceNamesToCompile.includes(sourceName),
    );

    if (skippedSourceNames.length > 0) {
      let skippedFilesMessage: string = `\n${chalk.bold("Compilation skipped for:")}\n`;

      for (const sourceName of skippedSourceNames) {
        skippedFilesMessage += `\n${chalk.yellow(">")} ${chalk.italic.grey(sourceName)}`;
      }

      console.log(skippedFilesMessage);
    }
  }

  public reportStartWithSpinner(circuitName: string, circuitFileName: string): string | null {
    const fileNameMessage: string = circuitName === circuitFileName ? "" : chalk.grey(` (${circuitFileName}.circom)`);

    return this._startSpinner(circuitName, "compile", `Compiling ${circuitName}${fileNameMessage} circuit`);
  }

  public reportResult(spinnerId: string | null, circuitName: string, circuitFileName: string) {
    if (this.isQuiet() || !spinnerId) return;

    const fileNameMessage: string = circuitName === circuitFileName ? "" : chalk.grey(` (${circuitFileName}.circom)`);
    const compilationTimeMessage: string = this._getSpinnerWorkingTimeMessage(
      this._spinnerProcessor.getWorkingTime(spinnerId),
    );

    this._spinnerProcessor.succeedSpinner(
      spinnerId,
      `Compiled ${chalk.italic(circuitName)}${fileNameMessage} ${compilationTimeMessage}`,
    );
  }

  public reportFail(spinnerId: string | null, circuitName: string, circuitFileName: string) {
    if (this.isQuiet() || !spinnerId) return;

    const fileNameMessage: string = circuitName === circuitFileName ? "" : chalk.grey(` (${circuitFileName}.circom)`);
    const compilationTimeMessage: string = this._getSpinnerWorkingTimeMessage(
      this._spinnerProcessor.getWorkingTime(spinnerId),
    );

    this._spinnerProcessor.failSpinner(
      spinnerId,
      `Failed to compile ${chalk.italic(circuitName)}${fileNameMessage} ${compilationTimeMessage}\n`,
    );
  }

  public reportFinalResult(compilationInfoArr: CompilationInfo[]) {
    if (this.isQuiet()) return;

    let output: string = "";
    const circuitsMessage: string =
      compilationInfoArr.length > 1 ? `${compilationInfoArr.length} circuits` : `one circuit`;

    output += `\n${chalk.bold(`Successfully compiled ${circuitsMessage}.`)}\n`;

    const table = this._getCLITable();

    table.push([{ content: chalk.bold("Circuit Name") }, { content: chalk.bold(`Constraints Number`) }]);

    for (const info of compilationInfoArr) {
      table.push([{ content: info.circuitName }, { content: info.constraintsNumber.toString(), hAlign: "right" }]);
    }

    output += `\n${table.toString()}\n`;

    console.log(output);
  }
}
