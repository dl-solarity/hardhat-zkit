import {
  CircomVisitor,
  CircomExpressionVisitor,
  TemplateDeclarationContext,
  SignalDeclarationContext,
  BigIntOrNestedArray,
  IdentifierContext,
  Variables,
  VarDeclarationContext,
  VarDefinitionContext,
  RhsValueContext,
  TemplateStmtContext,
  BlockInstantiationExpressionContext,
  DotExpressionContext,
} from "@distributedlab/circom-parser";

import { InputData } from "../../../types/core";
import { HardhatZKitError } from "../../../errors";
import { Reporter } from "../../../reporter";

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

  vars: Variables = {};

  constructor(
    private readonly _templateName: string,
    private readonly _parameterValues: Record<string, BigIntOrNestedArray>,
  ) {
    super();

    this.templateInputs = {};

    for (const key of Object.keys(this._parameterValues)) {
      this.vars[key] = {
        value: this._parameterValues[key],
      };
    }
  }

  visitTemplateDeclaration = (ctx: TemplateDeclarationContext) => {
    if (ctx.ID().getText() === this._templateName) {
      ctx
        .templateBlock()
        .templateStmt_list()
        .forEach((stmt) => {
          this.visitTemplateStmt(stmt);
        });
    }
  };

  visitTemplateStmt = (ctx: TemplateStmtContext) => {
    if (ctx.signalDeclaration()) {
      this.visit(ctx.signalDeclaration());

      return;
    }

    if (ctx.identifier() && ctx.ASSIGNMENT() && ctx.expression(0)) {
      const id = ctx.identifier().ID(0).getText();
      const value = new CircomExpressionVisitor(true, this.vars).visitExpression(ctx.expression(0));

      if (Array.isArray(value)) {
        throw new HardhatZKitError(`Currently, only single value assignment is supported - ${value}`);
      }

      this.vars[id] = {
        value: value,
      };

      return;
    }

    if (!ctx.IF()) {
      this.visitChildren(ctx);

      return;
    }

    const result = new CircomExpressionVisitor(true, this.vars).visitExpression(ctx.parExpression().expression());

    if (Array.isArray(result)) {
      throw new HardhatZKitError(
        `Currently, only single value assignment is supported as a result inside if statement - ${result}`,
      );
    }

    if (result === 1n) {
      this.visitTemplateStmt(ctx.templateStmt(0));

      return;
    }

    if (ctx.ELSE()) {
      this.visitTemplateStmt(ctx.templateStmt(1));

      return;
    }
  };

  visitVarDeclaration = (ctx: VarDeclarationContext) => {
    const vars = this._parseVarDefinition(ctx.varDefinition());

    if (!ctx.ASSIGNMENT()) return;

    const results = this._parseRHSValue(ctx.rhsValue());

    if (vars.length !== results.length) {
      throw new HardhatZKitError(`Mismatch between variable definitions and values - ${ctx.getText()}`);
    }

    vars.forEach((varName, index) => {
      this.vars[varName] = {
        value: results[index],
      };
    });
  };

  _parseVarDefinition = (ctx: VarDefinitionContext): string[] => {
    return ctx.identifier_list().map((identifier) => identifier.ID(0).getText());
  };

  _parseRHSValue = (ctx: RhsValueContext): bigint[] => {
    const expressionVisitor = new CircomExpressionVisitor(true, this.vars);

    /**
     *  Due to the filtering below following expressions are skipped during the input signals resolution:
     *
     *  ```circom
     *  var var1 = functionCall();
     *  var var2 = component.out;
     *  ```
     */
    if (ctx.expression()) {
      if (
        ctx.expression() instanceof BlockInstantiationExpressionContext ||
        ctx.expression() instanceof DotExpressionContext
      ) {
        Reporter?.reportUnsupportedExpression(this._templateName, ctx.expression());

        return [0n];
      }

      const expressionResult = expressionVisitor.visitExpression(ctx.expression());

      if (Array.isArray(expressionResult)) {
        throw new HardhatZKitError(`Currently, only single value assignment is supported - ${expressionResult}`);
      }

      return [expressionResult];
    }

    if (ctx.expressionList()) {
      const expressionsResult: bigint[] = [];

      ctx
        .expressionList()
        .expression_list()
        .forEach((expression) => {
          const expressionResult = expressionVisitor.visitExpression(expression);

          if (Array.isArray(expressionResult)) {
            throw new HardhatZKitError(`Currently, only single value assignment is supported - ${expressionResult}`);
          }

          expressionsResult.push(expressionResult);
        });

      return expressionsResult;
    }

    throw new HardhatZKitError(`RHS value as function call is not supported - ${ctx.getText()}`);
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
      const expressionVisitor = new CircomExpressionVisitor(true, this.vars);
      const expressionResult = expressionVisitor.visitExpression(dimension.expression());

      if (Array.isArray(expressionResult)) {
        throw new HardhatZKitError(
          `Invalid expression result value during inputs expression resolving - ${expressionResult}`,
        );
      }

      inputDimension.push(expressionResult.toString());
    });

    return {
      name: identifier.ID(0).getText(),
      dimension: inputDimension,
    };
  }
}
