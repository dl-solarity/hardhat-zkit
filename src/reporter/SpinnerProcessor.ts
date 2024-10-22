import ora, { Options, Ora } from "ora";

import { SpinnerData } from "../types/reporter/spinner-processor";

export class BaseSpinnerProcessor {
  private _idToSpinnerData: Map<string, SpinnerData> = new Map();

  public createSpinner(spinnerId: string, options?: string | Options) {
    const spinner: Ora = ora(options).start();

    this._idToSpinnerData.set(spinnerId, { spinner, spinnerStartTime: Date.now() });
  }

  public succeedSpinner(spinnerId: string, succeedMessage: string) {
    const spinnerData = this._idToSpinnerData.get(spinnerId);

    if (!spinnerData) return;

    spinnerData.spinner.succeed(succeedMessage);

    this._idToSpinnerData.delete(spinnerId);
  }

  public failSpinner(spinnerId: string, failMessage: string) {
    const spinnerData = this._idToSpinnerData.get(spinnerId);

    if (!spinnerData) return;

    spinnerData.spinner.fail(failMessage);

    this._idToSpinnerData.delete(spinnerId);
  }

  public warnSpinner(spinnerId: string, warningMessage: string) {
    const spinnerData = this._idToSpinnerData.get(spinnerId);

    if (!spinnerData) return;

    spinnerData.spinner.warn(warningMessage);

    this._idToSpinnerData.delete(spinnerId);
  }

  public getWorkingTime(spinnerId: string, fractionDigits: number = 2): string | undefined {
    const spinnerData = this._idToSpinnerData.get(spinnerId);

    if (spinnerData) {
      return ((Date.now() - spinnerData.spinnerStartTime) / 1000).toFixed(fractionDigits);
    } else {
      return undefined;
    }
  }
}

export let SpinnerProcessor: BaseSpinnerProcessor | null = null;

export function createSpinnerProcessor() {
  if (SpinnerProcessor) {
    return;
  }

  SpinnerProcessor = new BaseSpinnerProcessor();
}
