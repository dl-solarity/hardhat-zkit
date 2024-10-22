import { BaseReporter } from "@src/reporter/reporters/BaseReporter";

export class WarningsReporter extends BaseReporter {
  public reportUnsupportedExpression(contextText: string) {
    if (this.isQuiet()) return;

    console.warn(
      `Expression structure: ${contextText} not supported if the expression is used to determine the dimension of input signal!`,
    );
  }
}
