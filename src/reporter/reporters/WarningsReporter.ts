import { SimpleParserRuleContext } from "../../types/core";

import { SpinnerProcessor } from "../../reporter";
import { BaseReporter } from "../../reporter/reporters/BaseReporter";

export class WarningsReporter extends BaseReporter {
  public warnings: Set<string> = new Set();

  constructor(quiet: boolean) {
    super(quiet);

    this.warnings = new Set();
  }

  public reportUnsupportedExpression(templateName: string, context: SimpleParserRuleContext) {
    if (this.isQuiet()) return;

    this.warnings.add(
      `Inside the ${templateName} circuit (${context.start.line}:${context.start.column})
      \rThe expression structure: ${context.getText()} not supported if used to determine the dimension of an input signal!`,
    );
  }

  public reportAllWarnings(spinnerId: string | null) {
    if (this.isQuiet() || !spinnerId) return;

    const resolvingTimeMessage: string = this._getSpinnerWorkingTimeMessage(
      SpinnerProcessor!.getWorkingTime(spinnerId),
    );

    SpinnerProcessor!.warnSpinner(
      spinnerId,
      `Circuits are ready for the compilation ${resolvingTimeMessage}. But the analysis ended with warnings:`,
    );

    for (const warning of this.warnings) {
      console.warn(warning);
    }
  }

  public hasWarnings(): boolean {
    return this.warnings.size > 0;
  }
}
