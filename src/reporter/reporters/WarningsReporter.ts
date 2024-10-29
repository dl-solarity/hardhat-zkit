import { SpinnerProcessor } from "../../reporter";
import { BaseReporter } from "../../reporter/reporters/BaseReporter";

import { SimpleParserRuleContext } from "../../types/core";

export class WarningsReporter extends BaseReporter {
  public warnings: Set<string> = new Set();

  constructor(quiet: boolean) {
    super(quiet);

    this.warnings = new Set();
  }

  public reportUnsupportedExpression(templateName: string, context: SimpleParserRuleContext) {
    if (this.isQuiet()) return;

    this.warnings.add(
      `\nInside the ${templateName} circuit (${context.start.line}:${context.start.column})
      \rExpression structure "${context.getText()}" is not supported if used to determine the dimension of an input signal!`,
    );
  }

  public reportAllWarnings(spinnerId: string | null) {
    if (this.isQuiet() || !spinnerId || !this.hasWarnings()) return;

    const resolvingTimeMessage: string = this._getSpinnerWorkingTimeMessage(
      SpinnerProcessor!.getWorkingTime(spinnerId),
    );

    SpinnerProcessor!.warnSpinner(
      spinnerId,
      `Circuits are ready for the compilation ${resolvingTimeMessage}, however, the analysis ended with warnings:`,
    );

    for (const warning of this.warnings) {
      console.warn(warning);
    }
  }

  public hasWarnings(): boolean {
    return this.warnings.size > 0;
  }
}
