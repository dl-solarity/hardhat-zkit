import { Bar, Options, Preset, Presets, ValueType } from "cli-progress";

import { BYTES_IN_MB } from "../constants";

export class BaseProgressBarProcessor {
  private _progressBar: Bar | null = null;

  public createAndStartProgressBar(
    barOptions: Options,
    totalValue: number,
    startValue: number,
    barPreset: Preset = Presets.shades_classic,
  ) {
    if (this._progressBar) return;

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

  public formatToMB(v: number, options: Options, type: ValueType): string {
    const toMb = (value: number): string => {
      return (value / BYTES_IN_MB).toFixed(2);
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
}

export let ProgressBarProcessor: BaseProgressBarProcessor | null = null;

export function createProgressBarProcessor() {
  if (ProgressBarProcessor) {
    return;
  }

  ProgressBarProcessor = new BaseProgressBarProcessor();
}
