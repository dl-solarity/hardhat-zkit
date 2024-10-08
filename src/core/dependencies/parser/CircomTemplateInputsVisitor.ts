import {
  CircomVisitor,
  CircomExpressionVisitor,
  TemplateDeclarationContext,
  SignalDeclarationContext,
  BigIntOrNestedArray,
  IdentifierContext,
  Variables,
} from "@distributedlab/circom-parser";

import { InputData } from "../../../types/core";
import { HardhatZKitError } from "../../../errors";

/**
 * Visitor class for the {@link https://www.npmjs.com/package/@distributedlab/circom-parser | @distributedlab/circom-parser} package.
 *
 * The `CircomTemplateInputsVisitor` is designed to traverse the abstract
 * syntax tree (AST) of Circom templates. Its primary role is to
 * collect information about the inputs of the Circom circuits,
 * specifically the dimensions and types of signals declared in the
 * template.
 *
 * This class provides functionality to visit different components of
 * the template structure, enabling efficient extraction and
 * organization of input data for further processing or validation.
 */
export class CircomTemplateInputsVisitor extends CircomVisitor<void> {
  templateInputs: Record<string, InputData>;
  expressionVisitor: CircomExpressionVisitor;

  constructor(
    private readonly _templateName: string,
    private readonly _parameterValues: Record<string, BigIntOrNestedArray>,
  ) {
    super();

    this.templateInputs = {};

    const vars: Variables = {};

    for (const key of Object.keys(this._parameterValues)) {
      vars[key] = {
        value: this._parameterValues[key],
      };
    }

    this.expressionVisitor = new CircomExpressionVisitor(true, vars);
  }

  visitTemplateDeclaration = (ctx: TemplateDeclarationContext) => {
    if (ctx.ID().getText() === this._templateName) {
      ctx
        .templateBlock()
        .templateStmt_list()
        .forEach((stmt) => {
          if (stmt.signalDeclaration()) {
            this.visit(stmt.signalDeclaration());
          }
        });
    }
  };

  visitSignalDeclaration = (ctx: SignalDeclarationContext) => {
    const signalDefinition = ctx.signalDefinition();

    let signalType = "intermediate";

    if (signalDefinition.SIGNAL_TYPE()) {
      signalType = signalDefinition.SIGNAL_TYPE().getText();
    }

    [signalDefinition.identifier(), ...ctx.identifier_list()].forEach((identifier) =>
      this._saveInputData(identifier, signalType),
    );
  };

  private _saveInputData(identifier: IdentifierContext, signalType: string) {
    const parsedData = this._parseIdentifier(identifier);

    this.templateInputs[parsedData.name] = {
      dimension: parsedData.dimension,
      type: signalType,
    };
  }

  private _parseIdentifier(identifier: IdentifierContext) {
    const inputDimension: string[] = [];

    identifier.arrayDimension_list().forEach((dimension) => {
      const expressionResult = this.expressionVisitor.visitExpression(dimension.expression());

      if (Array.isArray(expressionResult)) {
        throw new HardhatZKitError(
          `Invalid expression result value during inputs expression resolving - ${expressionResult}`,
        );
      }

      inputDimension.push(expressionResult.toString());
    });

    return {
      name: identifier.ID().getText(),
      dimension: inputDimension,
    };
  }
}
