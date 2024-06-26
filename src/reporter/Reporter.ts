/* eslint-disable no-console */
import debug from "debug";
import chalk from "chalk";
import CliTable3 from "cli-table3";

import { ResolvedFile } from "hardhat/types";
import { emoji } from "hardhat/internal/cli/emoji";
import { pluralize } from "hardhat/internal/util/strings";

import { SpinnerProcessor } from "./SpinnerProcessor";
import { ProgressBarProcessor } from "./ProgressBarProcessor";
import { CompilationInfo, CompilerVersion } from "../types/compile";
import { Options } from "ora";

class BaseReporter {
  private _spinnerProcessor: SpinnerProcessor;
  private _progressBarProcessor: ProgressBarProcessor;

  constructor(private _quiet: boolean) {
    this._spinnerProcessor = new SpinnerProcessor();
    this._progressBarProcessor = new ProgressBarProcessor();
  }

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

  public reportCompilerVersion(compilerVersion: CompilerVersion) {
    if (this.isQuiet()) return;

    let output: string = "";

    output += `\n${chalk.bold("Compiler version:")} ${chalk.green(compilerVersion)}`;

    console.log(output);
  }

  public reportCompilationProcessHeader() {
    if (this.isQuiet()) return;

    let output: string = "";

    output += `\n${chalk.bold("Starting compilation process:")}\n`;

    output += `\n${chalk.italic.cyan("First step - Circuits compilation")}\n`;

    console.log(output);
  }

  public reportCircuitCompilationStartWithSpinner(circuitName: string): string | null {
    return this._startSpinner(circuitName, "compile", `Compiling ${circuitName} circuit`);
  }

  public reportCircuitCompilationResult(spinnerId: string | null, circuitName: string) {
    if (this.isQuiet() || !spinnerId) return;

    const compilationTimeMessage: string = this._getSpinnerWorkingTimeMessage(
      this._spinnerProcessor.getWorkingTime(spinnerId),
    );

    this._spinnerProcessor.succeedSpinner(spinnerId, `Compiled ${chalk.italic(circuitName)} ${compilationTimeMessage}`);
  }

  public reportPtauFileInfo(maxConstraintsNumber: number, ptauId: number, ptauFileFullPath?: string) {
    if (this.isQuiet()) return;

    let output: string = "";

    output += `\n${chalk.italic.cyan("Second step - Ptau file setup")}\n`;

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

    this._progressBarProcessor.stopProgressBar();

    console.log(`\n${emoji("✅ ", `${chalk.green("✔ ")}`)}Ptau file successfully downloaded`);
  }

  public reportPtauFileDownloadingError() {
    if (this.isQuiet()) return;

    this._progressBarProcessor.stopProgressBar();

    console.log(`\n${emoji("❌ ", `${chalk.red("X ")}`)}Ptau file downloading failed`);
  }

  public reportZKeyFilesGenerationHeader(contributions: number) {
    if (this.isQuiet()) return;

    let output: string = "";

    output += `\n${chalk.italic.cyan("Third step - Generating ZKey files for circuits")}\n`;

    if (contributions > 0) {
      output += `\n> Phase-2 contributions to ZKey file ${chalk.green("enabled")}`;
      output += `\n> Contributions count: ${contributions}\n`;
    }

    output += `\nStarting generation of ZKey files:\n`;

    console.log(output);
  }

  public reportZKeyFileGenerationStartWithSpinner(circuitName: string): string | null {
    return this._startSpinner(circuitName, "generate-zkey", `Generating ZKey file for ${circuitName} circuit`);
  }

  public reportZKeyFileGenerationResult(spinnerId: string | null, circuitName: string, contributionsNumber: number) {
    if (this.isQuiet() || !spinnerId) return;

    const generationTimeMessage: string | undefined = this._getSpinnerWorkingTimeMessage(
      this._spinnerProcessor.getWorkingTime(spinnerId),
    );
    const contributionMessage: string =
      contributionsNumber !== 0 ? `with ${contributionsNumber} ${pluralize(contributionsNumber, "contribution")} ` : "";

    this._spinnerProcessor.succeedSpinner(
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

  public reportVKeyFileGenerationStartWithSpinner(circuitName: string): string | null {
    return this._startSpinner(circuitName, "generate-vkey", `Generating VKey file for ${circuitName} circuit`);
  }

  public reportVKeyFileGenerationResult(spinnerId: string | null, circuitName: string) {
    if (this.isQuiet() || !spinnerId) return;

    const generationTimeMessage: string = this._getSpinnerWorkingTimeMessage(
      this._spinnerProcessor.getWorkingTime(spinnerId),
    );

    this._spinnerProcessor.succeedSpinner(
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

    output += `\n${table.toString()}\n`;

    console.log(output);
  }

  public reportNothingToCompile() {
    if (this.isQuiet()) return;

    console.log(`\n${chalk.bold("Nothing to compile.")}\n`);
  }

  public reportVerifiersGenerationHeader() {
    if (this.isQuiet()) return;

    let output: string = "";

    output += `\n${chalk.bold("Starting generation of Solidity verifier contracts...")}\n`;

    console.log(output);
  }

  public reportVerifierGenerationStartWithSpinner(circuitName: string): string | null {
    return this._startSpinner(
      circuitName,
      "verifier-generation",
      `Generating Solidity verifier contract for ${circuitName} circuit`,
    );
  }

  public reportVerifierGenerationResult(spinnerId: string | null, circuitName: string) {
    if (this.isQuiet() || !spinnerId) return;

    const generationTimeMessage: string = this._getSpinnerWorkingTimeMessage(
      this._spinnerProcessor.getWorkingTime(spinnerId),
    );

    this._spinnerProcessor.succeedSpinner(
      spinnerId,
      `Generated Solidity verifier contract for ${chalk.italic(circuitName)} circuit ${generationTimeMessage}`,
    );
  }

  public reportStartFileDownloadingWithProgressBar(totalValue: number, startValue: number) {
    if (this.isQuiet()) return;

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

  public verboseLog(namespace: string, formatterStr: string, logArgs: any[] = []) {
    debug(`hardhat-zkit:${namespace}`)(formatterStr, ...logArgs);
  }

  public isQuiet(): boolean {
    return this._quiet;
  }

  private _getSpinnerWorkingTimeMessage(workingTime: string | undefined): string {
    return workingTime ? chalk.grey(`(${workingTime} s)`) : "";
  }

  private _startSpinner(circuitName: string, spinnerIdSuffix: string, spinnerOptions: string | Options): string | null {
    if (this.isQuiet()) return null;

    const spinnerId: string = `${circuitName}-${spinnerIdSuffix}`;

    this._spinnerProcessor.createSpinner(spinnerId, spinnerOptions);

    return spinnerId;
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
