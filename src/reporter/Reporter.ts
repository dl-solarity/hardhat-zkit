/* eslint-disable no-console */
import debug from "debug";
import chalk from "chalk";
import CliTable3 from "cli-table3";

import { ResolvedFile } from "hardhat/types";
import { emoji } from "hardhat/internal/cli/emoji";
import { pluralize } from "hardhat/internal/util/strings";

import { CompilationInfo, CompileFlags, CompilerVersion } from "../types/compile";
import { SpinnerProcessor } from "./SpinnerProcessor";

class BaseReporter {
  constructor(private _quiet: boolean) {}

  public setQuiet(newValue: boolean) {
    this._quiet = newValue;
  }

  public reportCircuitListToCompile(
    allResolvedFilesToCompile: ResolvedFile[],
    filteredResolvedFilesToCompile: ResolvedFile[],
  ) {
    if (this.isQuiet()) return;

    if (filteredResolvedFilesToCompile.length > 0) {
      let filesToCompileMessage: string = `\n${chalk.bold("Circuits to compile:")}\n`;

      for (const file of filteredResolvedFilesToCompile) {
        filesToCompileMessage += `\n${chalk.green(">")} ${chalk.italic(file.sourceName)}`;
      }

      console.log(filesToCompileMessage);
    }

    const skippedFiles: ResolvedFile[] = allResolvedFilesToCompile.filter(
      (file: ResolvedFile) => !filteredResolvedFilesToCompile.includes(file),
    );

    if (skippedFiles.length > 0) {
      let skippedFilesMessage: string = `\n${chalk.bold("Compilation skipped for:")}\n`;

      for (const file of skippedFiles) {
        skippedFilesMessage += `\n${chalk.yellow(">")} ${chalk.italic.grey(file.sourceName)}`;
      }

      console.log(skippedFilesMessage);
    }
  }

  public reportCompilationSettings(compilerVersion: CompilerVersion, compileFlags: CompileFlags) {
    if (this.isQuiet()) return;

    let output: string = "";

    output += `\n${chalk.bold("Compilation settings:")}\n`;

    output += `\n> Compiler version: ${chalk.bold(compilerVersion)}`;
    output += "\n> Compile flags:";

    for (const [key, value] of Object.entries(compileFlags)) {
      const paddedKey: string = `--${key}:`.padEnd(8).padStart(12);

      output += `\n${chalk.bold(paddedKey)}${value ? chalk.green(value) : chalk.red(value)}`;
    }

    console.log(output);
  }

  public reportCompilationProcessHeader() {
    if (this.isQuiet()) return;

    let output: string = "";

    output += `\n${chalk.bold("Start compilation process:")}\n`;

    output += `\n${chalk.italic.cyan("First phase - Circuits compilation")}\n`;

    console.log(output);
  }

  public reportCircuitCompilationResult(spinnerId: string, circuitName: string) {
    if (this.isQuiet()) return;

    const compilationTimeMessage: string = this._getSpinnerWorkingTimeMessage(
      SpinnerProcessor!.getWorkingTime(spinnerId),
    );

    SpinnerProcessor!.succeedSpinner(spinnerId, `Compiled ${chalk.italic(circuitName)} ${compilationTimeMessage}`);
  }

  public reportPtauFileInfo(maxConstraintsNumber: number, ptauId: number, ptauFileFullPath?: string) {
    if (this.isQuiet()) return;

    let output: string = "";

    output += `\n${chalk.italic.cyan("Second phase - Ptau file setup")}\n`;

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

  public reportPtauFileDownloadingInfo(ptauFilePath: string, downloadUrl: string) {
    if (this.isQuiet()) return;

    let output: string = "";

    output += `\nPtau downloading info:\n`;
    output += `\n> Ptau file path - ${chalk.underline(ptauFilePath)}`;
    output += `\n> Download URL - ${chalk.underline(downloadUrl)}\n`;

    console.log(output);
  }

  public reportPtauFileDownloadingFinish() {
    if (this.isQuiet()) return;

    console.log(`\n${emoji("✅ ", `${chalk.green("✔ ")}`)}Ptau file successfully downloaded`);
  }

  public reportZKeyFilesGenerationHeader(contributions: number) {
    if (this.isQuiet()) return;

    let output: string = "";

    output += `\n${chalk.italic.cyan("Third phase - Generating ZKey files for circuits")}\n`;

    if (contributions > 0) {
      output += `\n> Contributions to ZKey file ${chalk.green("enabled")}`;
      output += `\n> Contributions count: ${contributions}\n`;
    }

    output += `\nStarting generation of ZKey files:\n`;

    console.log(output);
  }

  public reportZKeyFileGenerationResult(spinnerId: string, circuitName: string, contributionsNumber: number) {
    if (this.isQuiet()) return;

    const generationTimeMessage: string | undefined = this._getSpinnerWorkingTimeMessage(
      SpinnerProcessor!.getWorkingTime(spinnerId),
    );
    const contributionMessage: string =
      contributionsNumber !== 0 ? `with ${contributionsNumber} ${pluralize(contributionsNumber, "contribution")} ` : "";

    SpinnerProcessor!.succeedSpinner(
      spinnerId,
      `Generated ZKey file for ${chalk.italic(circuitName)} circuit ${contributionMessage}${generationTimeMessage}`,
    );
  }

  public reportVKeyFilesGenerationHeader() {
    if (this.isQuiet()) return;

    let output: string = "";

    output += `\n${chalk.italic.cyan("Fourth phase - Generating VKey files for circuits")}\n`;

    output += `\nStarting generation of VKey files:\n`;

    console.log(output);
  }

  public reportVKeyFileGenerationResult(spinnerId: string, circuitName: string) {
    if (this.isQuiet()) return;

    const generationTimeMessage: string = this._getSpinnerWorkingTimeMessage(
      SpinnerProcessor!.getWorkingTime(spinnerId),
    );

    SpinnerProcessor!.succeedSpinner(
      spinnerId,
      `Generated VKey file for ${chalk.italic(circuitName)} circuit ${generationTimeMessage}`,
    );
  }

  public reportCompilationResult(compilationInfoArr: CompilationInfo[]) {
    if (this.isQuiet()) return;

    let output: string = "";
    const circuitsMessage: string =
      compilationInfoArr.length > 1 ? `${compilationInfoArr.length} circuits` : `one circuit`;

    output += `\n${chalk.bold(`Successfully compiled ${circuitsMessage}.`)}\n`;

    const table = new CliTable3({
      style: { head: [], border: [], "padding-left": 2, "padding-right": 2 },
      chars: {
        mid: "·",
        "top-mid": "|",
        "left-mid": " ·",
        "mid-mid": "|",
        "right-mid": "·",
        left: " |",
        "top-left": " ·",
        "top-right": "·",
        "bottom-left": " ·",
        "bottom-right": "·",
        middle: "·",
        top: "-",
        bottom: "-",
        "bottom-mid": "|",
      },
    });

    table.push([{ content: chalk.bold("Circuit Name") }, { content: chalk.bold(`Constraints Number`) }]);

    for (const info of compilationInfoArr) {
      table.push([{ content: info.circuitName }, { content: info.constraintsNumber.toString(), hAlign: "right" }]);
    }

    output += table.toString();

    console.log(output);
  }

  public reportNothingToCompile() {
    if (this.isQuiet()) return;

    console.log(`\n${emoji("🤷‍♂️ ")}${chalk.bold("Nothing to compile...")}${emoji(" 🤷‍♂️")}`);
  }

  public verboseLog(namespace: string, message: string) {
    debug(namespace)(message);
  }

  public isQuiet(): boolean {
    return this._quiet;
  }

  private _getSpinnerWorkingTimeMessage(workingTime: string | undefined): string {
    return workingTime ? chalk.grey(`(${workingTime} s)`) : "";
  }
}

export let Reporter: BaseReporter | null = null;

export function createReporter(quiet: boolean) {
  if (Reporter) {
    return;
  }

  Reporter = new BaseReporter(quiet);
}

/**
 * Used only in test environments to ensure test atomicity
 */
export function resetReporter() {
  Reporter = null;
}
