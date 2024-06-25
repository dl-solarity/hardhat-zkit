/* eslint-disable no-console */
import debug from "debug";
import chalk from "chalk";
import CliTable3 from "cli-table3";
import ora, { Ora } from "ora";
import { Bar, Options, Preset, Presets, ValueType } from "cli-progress";

import { ResolvedFile } from "hardhat/types";
import { emoji } from "hardhat/internal/cli/emoji";

import { CompilationInfo, CompileFlags, CompilerVersion } from "../types/compile";
import { MB_SIZE } from "../constants";

class BaseReporter {
  private _progressBar: Bar | null = null;
  private _idToSpinner: Map<string, Ora> = new Map();

  public formatToMB(v: number, options: Options, type: ValueType): string {
    const toMb = (value: number): string => {
      return (value / MB_SIZE).toFixed(2);
    };

    switch (type) {
      case "percentage":
        return options.autopaddingChar ? (options.autopaddingChar + v).slice(-3) : v.toString();
      case "total":
        return toMb(v);
      case "value":
        return toMb(v);
      default:
        return v.toString();
    }
  }

  public createAndStartProgressBar(
    barOptions: Options,
    totalValue: number,
    startValue: number,
    barPreset: Preset = Presets.shades_classic,
  ) {
    this._progressBar = new Bar(barOptions, barPreset);

    this._progressBar.start(totalValue, startValue);
  }

  public updateProgressBar(addedChunk: number) {
    if (!this._progressBar) return;

    this._progressBar.increment(addedChunk);
  }

  public stopProgressBar() {
    if (!this._progressBar) return;

    this._progressBar.stop();

    this._progressBar = null;
  }

  public createSpinner(spinnerId: string, options?: string | ora.Options) {
    const spinner: Ora = ora(options).start();

    this._idToSpinner.set(spinnerId, spinner);
  }

  public succeedSpinner(spinnerId: string, succeedMessage: string) {
    const spinner = this._idToSpinner.get(spinnerId);

    if (spinner) {
      spinner.succeed(succeedMessage);
    }

    this._idToSpinner.delete(spinnerId);
  }

  public stopAndPersistSpinner(spinnerId: string, options: ora.PersistOptions) {
    const spinner = this._idToSpinner.get(spinnerId);

    if (spinner) {
      spinner.stopAndPersist(options);
    }

    this._idToSpinner.delete(spinnerId);
  }

  public reportCircuitsListToCompile(
    allResolvedFilesToCompile: ResolvedFile[],
    filteredResolvedFilesToCompile: ResolvedFile[],
  ) {
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
    let output: string = "";

    output += `\n${chalk.bold("Start compilation process:")}\n`;

    output += `\n${chalk.italic.cyan("First phase - Circuits compilation")}\n`;

    console.log(output);
  }

  public reportCircuitCompilationResult(spinnerId: string, circuitName: string, startCompilationTime: number) {
    const compilationTime: string = ((Date.now() - startCompilationTime) / 1000).toFixed(2);

    this.succeedSpinner(spinnerId, `Compiled ${circuitName} ${chalk.grey(`(${compilationTime} s)`)}`);
  }

  public reportPtauFileInfo(maxConstraintsNumber: number, ptauId: number, ptauFileFullPath?: string) {
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
    let output: string = "";

    output += `\nPtau downloading info:\n`;
    output += `\n> Ptau file path - ${chalk.underline(ptauFilePath)}`;
    output += `\n> Download URL - ${chalk.underline(downloadUrl)}\n`;

    console.log(output);
  }

  public reportPtauFileDownloadingFinish() {
    console.log(`\n${emoji("✅ ", `${chalk.green("✔ ")}`)}Ptau file successfully downloaded`);
  }

  public reportZKeyFilesGenerationHeader(contributions: number) {
    let output: string = "";

    output += `\n${chalk.italic.cyan("Third phase - Generating ZKey files for circuits")}\n`;

    if (contributions > 0) {
      output += `\n> Contributions to ZKey file ${chalk.green("enabled")}`;
      output += `\n> Contributions count: ${contributions}\n`;
    }

    output += `\nStarting generation of ZKey files:\n`;

    console.log(output);
  }

  public reportZKeyFileGenerationResult(
    spinnerId: string,
    circuitName: string,
    contributionsNumber: number,
    startGenerationTime: number,
  ) {
    const generationTime: string = ((Date.now() - startGenerationTime) / 1000).toFixed(2);
    const contributionMessage: string = contributionsNumber !== 0 ? `with ${contributionsNumber} contributions ` : "";

    this.succeedSpinner(
      spinnerId,
      `Generated ZKey file for ${circuitName} circuit ${contributionMessage}${chalk.grey(`(${generationTime} s)`)}`,
    );
  }

  public reportVKeyFilesGenerationHeader() {
    let output: string = "";

    output += `\n${chalk.italic.cyan("Fourth phase - Generating VKey files for circuits")}\n`;

    output += `\nStarting generation of VKey files:\n`;

    console.log(output);
  }

  public reportVKeyFileGenerationResult(spinnerId: string, circuitName: string, startGenerationTime: number) {
    const generationTime: string = ((Date.now() - startGenerationTime) / 1000).toFixed(2);

    this.succeedSpinner(
      spinnerId,
      `Generated VKey file for ${circuitName} circuit ${chalk.grey(`(${generationTime} s)`)}`,
    );
  }

  public reportCompilationResult(compilationInfoArr: CompilationInfo[]) {
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
    console.log(`\n${emoji("🤷‍♂️ ")}${chalk.bold("Nothing to compile...")}${emoji(" 🤷‍♂️")}`);
  }

  public verboseLog(namespace: string, message: string) {
    debug(namespace)(message);
  }
}

export let Reporter: BaseReporter | null = null;

export async function createReporter() {
  if (Reporter) {
    return;
  }

  Reporter = new BaseReporter();
}

/**
 * Used only in test environments to ensure test atomicity
 */
export function resetReporter() {
  Reporter = null;
}
