import { CircuitResolutionError } from "../../../types/core/dependencies";

export class VisitorError extends Error {
  public errors: CircuitResolutionError[];

  constructor(args: CircuitResolutionError[] | CircuitResolutionError) {
    super();

    let firstError: CircuitResolutionError;

    if (Array.isArray(args)) {
      this.errors = args;
      firstError = args[0];
    } else {
      this.errors = [args];
      firstError = args;
    }

    this.message =
      firstError.message || `Visitor error at ${firstError.context.start.line}:${firstError.context.start.column}`;
  }
}
