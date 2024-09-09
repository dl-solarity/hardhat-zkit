import chalk from "chalk";
import CliTable3 from "cli-table3";

import { SpinnerProcessor } from "../SpinnerProcessor";

export abstract class BaseReporter {
  constructor(private _quiet: boolean) {}

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

  protected _startSpinner(spinnerIdName: string, spinnerIdSuffix: string, spinnerText: string): string | null {
    if (this.isQuiet()) return null;

    const spinnerId: string = `${spinnerIdName}-${spinnerIdSuffix}`;

    SpinnerProcessor!.createSpinner(spinnerId, { text: spinnerText });

    return spinnerId;
  }
}
