import ora, { Options, Ora, PersistOptions } from "ora";

import { SpinnerData } from "../types/reporter/spinner-processor";

class BaseSpinnerProcessor {
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

  public stopAndPersistSpinner(spinnerId: string, options: PersistOptions) {
    const spinnerData = this._idToSpinnerData.get(spinnerId);

    if (!spinnerData) return "";

    spinnerData.spinner.stopAndPersist(options);

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

export async function createSpinnerProcessor() {
  if (SpinnerProcessor) {
    return;
  }

  SpinnerProcessor = new BaseSpinnerProcessor();
}
