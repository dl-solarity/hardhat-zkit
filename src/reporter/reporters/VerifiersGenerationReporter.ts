/* eslint-disable no-console */
import chalk from "chalk";
import { BaseReporter } from "./BaseReporter";
import { HardhatZKitError } from "../../errors";
import { VerifierLanguageType } from "@solarity/zkit";

export class VerifiersGenerationReporter extends BaseReporter {
  public reportHeader(verifiersType: VerifierLanguageType) {
    if (this.isQuiet()) return;

    let output: string = "";

    output += `\n${chalk.bold(`Starting generation of ${this._getVerifierLanguageMessage(verifiersType)} verifier contracts...`)}\n`;

    console.log(output);
  }

  public reportStartWithSpinner(circuitName: string, verifiersType: VerifierLanguageType): string | null {
    return this._startSpinner(
      circuitName,
      "verifier-generation",
      `Generating ${this._getVerifierLanguageMessage(verifiersType)} verifier contract for ${circuitName} circuit`,
    );
  }

  public reportResult(spinnerId: string | null, circuitName: string, verifiersType: VerifierLanguageType) {
    if (this.isQuiet() || !spinnerId) return;

    const generationTimeMessage: string = this._getSpinnerWorkingTimeMessage(
      this._spinnerProcessor.getWorkingTime(spinnerId),
    );

    this._spinnerProcessor.succeedSpinner(
      spinnerId,
      `Generated ${this._getVerifierLanguageMessage(verifiersType)} verifier contract for ${chalk.italic(circuitName)} circuit ${generationTimeMessage}`,
    );
  }

  public reportFinalResult(verifiersType: VerifierLanguageType, verifiersCount: number) {
    if (this.isQuiet()) return;

    let output: string = "";

    output += `\n${chalk.bold(`Successfully generated ${verifiersCount} ${this._getVerifierLanguageMessage(verifiersType)} verifier contracts.`)}\n`;

    console.log(output);
  }

  private _getVerifierLanguageMessage(verifiersType: VerifierLanguageType): string {
    switch (verifiersType) {
      case "sol":
        return "Solidity";
      case "vy":
        return "Vyper";
      default:
        throw new HardhatZKitError(`Invalid verifiers type - ${verifiersType}`);
    }
  }
}
