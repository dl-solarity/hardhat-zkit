/* eslint-disable no-console */
import fs from "fs";
import chalk from "chalk";
import CliTable3 from "cli-table3";

import { VerifierLanguageType } from "@solarity/zkit";

import { SpinnerProcessor } from "../SpinnerProcessor";
import { ProgressBarProcessor } from "../ProgressBarProcessor";
import { HardhatZKitError } from "../../errors";
import { BYTES_IN_MB } from "../../constants";

export abstract class BaseReporter {
  protected _spinnerProcessor: SpinnerProcessor;
  protected _progressBarProcessor: ProgressBarProcessor;

  constructor(private _quiet: boolean) {
    this._spinnerProcessor = new SpinnerProcessor();
    this._progressBarProcessor = new ProgressBarProcessor();
  }

  public isQuiet(): boolean {
    return this._quiet;
  }

  protected _getCLITable(): CliTable3.Table {
    return new CliTable3({
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
  }

  protected _getSpinnerWorkingTimeMessage(workingTime: string | undefined): string {
    return workingTime ? chalk.grey(`(${workingTime} s)`) : "";
  }

  protected _getVerifierLanguageMessage(verifiersType: VerifierLanguageType): string {
    switch (verifiersType) {
      case "sol":
        return "Solidity";
      case "vy":
        return "Vyper";
      default:
        throw new HardhatZKitError(`Invalid verifiers type - ${verifiersType}`);
    }
  }

  protected _getFileSizeInMB(filePath: string | undefined): string {
    if (!filePath) {
      throw new HardhatZKitError("File path is undefined. Unable to get file size.");
    }

    const fileSize: number = fs.statSync(filePath).size;

    return (fileSize / BYTES_IN_MB).toFixed(3);
  }

  protected _startSpinner(spinnerIdName: string, spinnerIdSuffix: string, spinnerText: string): string | null {
    if (this.isQuiet()) return null;

    const spinnerId: string = `${spinnerIdName}-${spinnerIdSuffix}`;

    this._spinnerProcessor.createSpinner(spinnerId, { text: spinnerText });

    return spinnerId;
  }
}
