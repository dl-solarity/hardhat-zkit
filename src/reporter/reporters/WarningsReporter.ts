import { BaseReporter } from "../../reporter/reporters/BaseReporter";

export class WarningsReporter extends BaseReporter {
  public reportUnsupportedExpression(contextText: string) {
    if (this.isQuiet()) return;

    console.warn(
      `Expression structure: ${contextText} not supported if used to determine the dimension of an input signal!`,
    );
  }
}
