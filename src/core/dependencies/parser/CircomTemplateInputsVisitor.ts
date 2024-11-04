import {
  BusDeclarationContext,
  CircomValueType,
  CircomVisitor,
  ExpressionContext,
  ExpressionHelper,
  IdentifierContext,
  IfRegularContext,
  IfRegularElseRegularContext,
  IfRegularElseWithFollowUpIfContext,
  IfWithFollowUpIfContext,
  ParserErrorItem,
  ParserRuleContext,
  parseSimpleIdentifierList,
  PIdentifierStatementContext,
  PUnderscoreContext,
  SignalDeclarationContext,
  SignalIdentifierContext,
  SignalIdentifierListContext,
  SubsAssignmentWithOperationContext,
  SubsIcnDecOperationContext,
  SubsLeftAssignmentContext,
  TemplateDefinitionContext,
  VarDeclarationContext,
  VariableContext,
  VarIdentifierContext,
} from "@distributedlab/circom-parser";

import { CircuitResolutionError, ErrorType, IdentifierObject, InputData } from "../../../types/core";

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
  errors: CircuitResolutionError[] = [];

  private _vars: VariableContext = {};
  private _declaredVariables: Record<string, boolean> = {};

  constructor(
    public readonly fileIdentifier: string,
    public readonly templateContext: TemplateDefinitionContext,
    public readonly parameterValues: Record<string, CircomValueType>,
  ) {
    super();

    this.templateInputs = {};

    this._vars = parameterValues;

    this._validateVariableContext();
  }

  startParse = () => {
    this.visit(this.templateContext);
  };

  visitVarDeclaration = (ctx: VarDeclarationContext) => {
    if (ctx.LP() && ctx.RP()) {
      this.errors.push({
        type: ErrorType.VarTupleLikeDeclarationNotSupported,
        context: ctx,
        fileIdentifier: this.fileIdentifier,
        message: `Tuple-like declarations are not supported (${ctx.start.line}:${ctx.start.column})`,
      });

      return;
    }

    this.visitChildren(ctx);
  };

  visitSignalDeclaration = (ctx: SignalDeclarationContext) => {
    if (ctx.LP() && ctx.RP()) {
      this.errors.push({
        type: ErrorType.VarTupleLikeDeclarationNotSupported,
        context: ctx,
        fileIdentifier: this.fileIdentifier,
        message: `Tuple-like declarations are not supported (${ctx.start.line}:${ctx.start.column})`,
      });

      return;
    }

    this.visitChildren(ctx);

    return;
  };

  visitSignalIdentifier = (ctx: SignalIdentifierContext) => {
    const base = ctx.identifier();
    const baseName = base.ID();
    const resolvedDimensions: number[] = [];

    for (const dimension of base.arrayDimension_list()) {
      const [dimensionValue, linkedErrors] = new ExpressionHelper(this.fileIdentifier)
        .setExpressionContext(dimension.expression())
        .setVariableContext(this._vars)
        .parseExpression();

      if (dimensionValue === null) {
        this.errors.push({
          type: ErrorType.SignalDimensionResolution,
          context: ctx,
          fileIdentifier: this.fileIdentifier,
          message: `Failed to resolve the signal dimension ${dimension.getText()} (${ctx.start.line}:${ctx.start.column})`,
          linkedParserErrors: linkedErrors,
        });

        return;
      }

      if (Array.isArray(dimensionValue)) {
        this.errors.push({
          type: ErrorType.SignalDimensionResolution,
          context: ctx,
          fileIdentifier: this.fileIdentifier,
          message: `Invalid signal dimension value ${dimension.getText()} (${ctx.start.line}:${ctx.start.column})`,
          linkedParserErrors: linkedErrors,
        });

        return;
      }

      resolvedDimensions.push(Number(dimensionValue));
    }

    if (!ctx.parentCtx && !(ctx.parentCtx! instanceof SignalIdentifierListContext)) {
      throw new Error("INTERNAL ERROR: SignalIdentifier should have a SignalIdentifierListContext as a parent");
    }

    if (!ctx.parentCtx!.parentCtx && !(ctx.parentCtx!.parentCtx! instanceof SignalDeclarationContext)) {
      throw new Error("INTERNAL ERROR: SignalIdentifier should have a SignalDeclarationContext as a parent of parent");
    }

    if (ctx.parentCtx!.parentCtx instanceof BusDeclarationContext) {
      return;
    }

    const signalDeclarationContext = ctx.parentCtx!.parentCtx as SignalDeclarationContext;

    let signalType = "intermediate";
    if (signalDeclarationContext.signalHeader().SIGNAL_TYPE()) {
      signalType = signalDeclarationContext.signalHeader().SIGNAL_TYPE().getText();
    }

    this.templateInputs[baseName.getText()] = {
      type: signalType,
      dimension: resolvedDimensions,
    };
  };

  /**
   * We skip this context to avoid visiting unrelated VarIdentifierContext
   */
  visitComponentDeclaration = () => {
    return;
  };

  visitIfWithFollowUpIf = (ctx: IfWithFollowUpIfContext) => {
    const [condition, linkedErrors] = new ExpressionHelper(this.fileIdentifier)
      .setExpressionContext(ctx._cond)
      .setVariableContext(this._vars)
      .parseExpression();

    if (!this._validateCondition(condition, linkedErrors, ctx, ctx._cond)) {
      return;
    }

    if (condition === 1n) {
      this.visitChildren(ctx);
    }
  };

  visitIfRegular = (ctx: IfRegularContext) => {
    const [condition, linkedErrors] = new ExpressionHelper(this.fileIdentifier)
      .setExpressionContext(ctx._cond)
      .setVariableContext(this._vars)
      .parseExpression();

    if (!this._validateCondition(condition, linkedErrors, ctx, ctx._cond)) {
      return;
    }

    if (condition === 1n) {
      this.visitChildren(ctx);
    }
  };

  visitIfRegularElseWithFollowUpIf = (ctx: IfRegularElseWithFollowUpIfContext) => {
    const [condition, linkedErrors] = new ExpressionHelper(this.fileIdentifier)
      .setExpressionContext(ctx._cond)
      .setVariableContext(this._vars)
      .parseExpression();

    if (!this._validateCondition(condition, linkedErrors, ctx, ctx._cond)) {
      return;
    }

    if (condition === 1n) {
      this.visit(ctx.regularStatements());
    } else {
      this.visit(ctx.ifStatements());
    }
  };

  visitIfRegularElseRegular = (ctx: IfRegularElseRegularContext) => {
    const [condition, linkedErrors] = new ExpressionHelper(this.fileIdentifier)
      .setExpressionContext(ctx._cond)
      .setVariableContext(this._vars)
      .parseExpression();

    if (!this._validateCondition(condition, linkedErrors, ctx, ctx._cond)) {
      return;
    }

    if (condition === 1n) {
      this.visit(ctx.regularStatements(0));
    } else {
      this.visit(ctx.regularStatements(1));
    }
  };

  /**
   * We are sure that identifier defined below is a variable
   */
  visitVarIdentifier = (ctx: VarIdentifierContext) => {
    const identifierObjects = this._resolveIdentifier(ctx.identifier(), this._vars);

    if (identifierObjects === null) {
      this.errors.push({
        type: ErrorType.FailedToResolveIdentifier,
        context: ctx,
        fileIdentifier: this.fileIdentifier,
        message: `Failed to resolve the identifier ${ctx.identifier().getText()} (${ctx.start.line}:${ctx.start.column})`,
      });

      return;
    }

    for (const identifierObject of identifierObjects) {
      this._declaredVariables[identifierObject.name] = true;
    }

    if (ctx._rhs) {
      const [value, linkedErrors] = new ExpressionHelper(this.fileIdentifier)
        .setExpressionContext(ctx._rhs)
        .setVariableContext(this._vars)
        .parseExpression();

      if (value === null) {
        this.errors.push({
          type: ErrorType.FailedToResolveIdentifierValue,
          context: ctx,
          fileIdentifier: this.fileIdentifier,
          message: `Failed to resolve the identifier value ${ctx._rhs.getText()} (${ctx.start.line}:${ctx.start.column})`,
          linkedParserErrors: linkedErrors,
        });

        return;
      }

      if (Array.isArray(value)) {
        this.errors.push({
          type: ErrorType.VarArraysNotSupported,
          context: ctx,
          fileIdentifier: this.fileIdentifier,
          message: `Failed to resolve the identifier value ${ctx._rhs.getText()} (${ctx.start.line}:${ctx.start.column})`,
          linkedParserErrors: linkedErrors,
        });

        return;
      }

      this._vars[identifierObjects[0].name] = value;
      this._declaredVariables[identifierObjects[0].name] = true;
    }
  };

  visitSubsLeftAssignment = (ctx: SubsLeftAssignmentContext) => {
    if (ctx.LEFT_ASSIGNMENT() || ctx.LEFT_CONSTRAINT()) {
      return;
    }

    const primaryExpression = ctx._lhs.primaryExpression();

    if (!primaryExpression) {
      this.errors.push({
        type: ErrorType.InvalidLeftAssignment,
        context: ctx,
        fileIdentifier: this.fileIdentifier,
        message: `Expected to assign value to an identifier (${ctx.start.line}:${ctx.start.column})`,
      });

      return;
    }

    if (primaryExpression instanceof PUnderscoreContext) {
      return;
    }

    if (!(primaryExpression instanceof PIdentifierStatementContext)) {
      this.errors.push({
        type: ErrorType.InvalidLeftAssignment,
        context: ctx,
        fileIdentifier: this.fileIdentifier,
        message: `Expected to assign value to an identifier (${ctx.start.line}:${ctx.start.column})`,
      });

      return;
    }

    const identifierStatement = primaryExpression.identifierStatement();

    if (identifierStatement.idetifierAccess_list().length > 0) {
      this.errors.push({
        type: ErrorType.ComplexAccessNotSupported,
        context: ctx,
        fileIdentifier: this.fileIdentifier,
        message: `Complex assignment to an identifier is not supported (${ctx.start.line}:${ctx.start.column})`,
      });

      return;
    }

    const [value, linkedErrors] = new ExpressionHelper(this.fileIdentifier)
      .setExpressionContext(ctx._rhs)
      .setVariableContext(this._vars)
      .parseExpression();

    if (value === null) {
      this.errors.push({
        type: ErrorType.FailedToResolveIdentifierValue,
        context: ctx,
        fileIdentifier: this.fileIdentifier,
        message: `Failed to resolve the identifier value ${ctx._rhs.getText()} (${ctx.start.line}:${ctx.start.column})`,
        linkedParserErrors: linkedErrors,
      });

      return;
    }

    if (Array.isArray(value)) {
      this.errors.push({
        type: ErrorType.VarArraysNotSupported,
        context: ctx,
        fileIdentifier: this.fileIdentifier,
        message: `Failed to resolve the identifier value ${ctx._rhs.getText()} (${ctx.start.line}:${ctx.start.column})`,
        linkedParserErrors: linkedErrors,
      });

      return;
    }

    this._vars[identifierStatement.ID().getText()] = value;
    this._declaredVariables[identifierStatement.ID().getText()] = true;

    return;
  };

  visitSubsAssignmentWithOperation = (ctx: SubsAssignmentWithOperationContext) => {
    const identifierStatement = ctx.identifierStatement();

    if (identifierStatement.idetifierAccess_list().length > 0) {
      this.errors.push({
        type: ErrorType.ComplexAccessNotSupported,
        context: ctx,
        fileIdentifier: this.fileIdentifier,
        message: `Complex assignment to an identifier is not supported (${ctx.start.line}:${ctx.start.column})`,
      });

      return;
    }

    const [value, linkedErrors] = new ExpressionHelper(this.fileIdentifier)
      .setExpressionContext(ctx._rhs)
      .setVariableContext(this._vars)
      .parseExpression();

    if (value === null) {
      this.errors.push({
        type: ErrorType.FailedToResolveIdentifierValue,
        context: ctx,
        fileIdentifier: this.fileIdentifier,
        message: `Failed to resolve the identifier value ${ctx._rhs.getText()} (${ctx.start.line}:${ctx.start.column})`,
        linkedParserErrors: linkedErrors,
      });

      return;
    }

    if (Array.isArray(value)) {
      this.errors.push({
        type: ErrorType.InvalidLeftAssignment,
        context: ctx,
        fileIdentifier: this.fileIdentifier,
        message: `Cannot perform operation on an array (${ctx.start.line}:${ctx.start.column})`,
        linkedParserErrors: linkedErrors,
      });

      return;
    }

    const assigneeName = identifierStatement.ID().getText();

    if (!this._declaredVariables[assigneeName]) {
      this.errors.push({
        type: ErrorType.AssigneeNotDeclared,
        context: ctx,
        fileIdentifier: this.fileIdentifier,
        message: `Assignee ${assigneeName} is not declared (${ctx.start.line}:${ctx.start.column})`,
        linkedParserErrors: linkedErrors,
      });

      return;
    }

    if (Array.isArray(this._vars[assigneeName])) {
      this.errors.push({
        type: ErrorType.VarArraysNotSupported,
        context: ctx,
        fileIdentifier: this.fileIdentifier,
        message: `Cannot perform operation on an array (${ctx.start.line}:${ctx.start.column})`,
        linkedParserErrors: linkedErrors,
      });

      return;
    }

    switch (ctx.ASSIGNMENT_WITH_OP().getText()) {
      case "+=":
        this._vars[assigneeName] = BigInt(this._vars[assigneeName] as any) + value;
        break;
      case "-=":
        this._vars[assigneeName] = BigInt(this._vars[assigneeName] as any) - value;
        break;
      case "*=":
        this._vars[assigneeName] = BigInt(this._vars[assigneeName] as any) * value;
        break;
      case "**=":
        this._vars[assigneeName] = BigInt(this._vars[assigneeName] as any) ** value;
        break;
      case "/=":
        this._vars[assigneeName] = BigInt(this._vars[assigneeName] as any) / value;
        break;
      case "\\\\=":
        this.errors.push({
          type: ErrorType.QUOOperationNotSupported,
          context: ctx,
          fileIdentifier: this.fileIdentifier,
          message: `QUO operation is not supported (${ctx.start.line}:${ctx.start.column})`,
        });
        break;
      case "%=":
        this._vars[assigneeName] = BigInt(this._vars[assigneeName] as any) % value;
        break;
      case "<<=":
        this._vars[assigneeName] = BigInt(this._vars[assigneeName] as any) << value;
        break;
      case ">>=":
        this._vars[assigneeName] = BigInt(this._vars[assigneeName] as any) >> value;
        break;
      case "&=":
        this._vars[assigneeName] = BigInt(this._vars[assigneeName] as any) & value;
        break;
      case "^=":
        this._vars[assigneeName] = BigInt(this._vars[assigneeName] as any) ^ value;
        break;
      case "|=":
        this._vars[assigneeName] = BigInt(this._vars[assigneeName] as any) | value;
        break;
      default:
        this.errors.push({
          type: ErrorType.ReachedUnknownOperation,
          context: ctx,
          fileIdentifier: this.fileIdentifier,
          message: `Invalid operation type ${ctx.ASSIGNMENT_WITH_OP().getText()} (${ctx.start.line}:${ctx.start.column})`,
          linkedParserErrors: linkedErrors,
        });
        break;
    }
  };

  visitSubsIcnDecOperation = (ctx: SubsIcnDecOperationContext) => {
    const identifierStatement = ctx.identifierStatement();

    if (identifierStatement.idetifierAccess_list().length > 0) {
      this.errors.push({
        type: ErrorType.ComplexAccessNotSupported,
        context: ctx,
        fileIdentifier: this.fileIdentifier,
        message: `Complex assignment to an identifier is not supported (${ctx.start.line}:${ctx.start.column})`,
      });

      return;
    }

    const assigneeName = identifierStatement.ID().getText();

    if (!this._declaredVariables[assigneeName]) {
      this.errors.push({
        type: ErrorType.AssigneeNotDeclared,
        context: ctx,
        fileIdentifier: this.fileIdentifier,
        message: `Assignee ${assigneeName} is not declared (${ctx.start.line}:${ctx.start.column})`,
      });

      return;
    }

    if (Array.isArray(this._vars[assigneeName])) {
      this.errors.push({
        type: ErrorType.VarArraysNotSupported,
        context: ctx,
        fileIdentifier: this.fileIdentifier,
        message: `Cannot perform operation on an array (${ctx.start.line}:${ctx.start.column})`,
      });

      return;
    }

    switch (ctx.SELF_OP().getText()) {
      case "++":
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        this._vars[assigneeName]++;
        break;
      case "--":
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        this._vars[assigneeName]--;
        break;
      default:
        this.errors.push({
          type: ErrorType.ReachedUnknownOperation,
          context: ctx,
          fileIdentifier: this.fileIdentifier,
          message: `Invalid operation type ${ctx.SELF_OP().getText()} (${ctx.start.line}:${ctx.start.column})`,
        });
        break;
    }
  };

  visitSubsInvalidIcnDecOperation = (ctx: SubsIcnDecOperationContext) => {
    this.errors.push({
      type: ErrorType.InvalidIncDecOperation,
      context: ctx,
      fileIdentifier: this.fileIdentifier,
      message: `Prefix increment/decrement operations are not allowed (${ctx.start.line}:${ctx.start.column})`,
    });
  };

  private _validateVariableContext() {
    const templateParameters = parseSimpleIdentifierList(this.templateContext.simpleIdentifierList());

    for (const parameter of templateParameters) {
      if (this._vars[parameter] === undefined || this._vars[parameter] === null) {
        this.errors.push({
          type: ErrorType.MissingTemplateParameterValue,
          context: this.templateContext,
          fileIdentifier: this.templateContext.ID().getText(),
          message: `Missing value for parameter ${parameter} in template ${this.templateContext.ID().getText()}`,
        });

        continue;
      }

      this._declaredVariables[parameter] = true;
    }
  }

  private _resolveIdentifier(ctx: IdentifierContext, variableContext: VariableContext = {}): IdentifierObject[] | null {
    const baseName = ctx.ID().getText();

    const expressionHelper = new ExpressionHelper(this.fileIdentifier);

    let result: IdentifierObject[] | null = [];
    const resolvedDimensions: bigint[] = [];

    for (let i = 0; i < ctx.arrayDimension_list().length; i++) {
      const [dimension, linkedErrors] = expressionHelper
        .setExpressionContext(ctx.arrayDimension(i).expression())
        .setVariableContext(variableContext)
        .parseExpression();

      if (dimension === null) {
        this.errors.push({
          type: ErrorType.InvalidIdentifierDimensionValue,
          context: ctx,
          fileIdentifier: this.fileIdentifier,
          message: `Invalid dimension type for identifier ${baseName} (${ctx.start.line}:${ctx.start.column})`,
          linkedParserErrors: linkedErrors,
        });

        result = null;

        continue;
      }

      if (Array.isArray(dimension)) {
        this.errors.push({
          type: ErrorType.InvalidIdentifierDimensionValue,
          context: ctx,
          fileIdentifier: this.fileIdentifier,
          message: `Invalid dimension value for identifier ${baseName} (${ctx.start.line}:${ctx.start.column})`,
          linkedParserErrors: linkedErrors,
        });

        result = null;

        continue;
      }

      if (result) {
        resolvedDimensions.push(dimension);
      }
    }

    if (result === null) return null;

    result = [{ name: baseName }];

    for (let i = 0; i < resolvedDimensions.length; i++) {
      const intermediateResult: IdentifierObject[] = [];

      for (let j = 0; j < resolvedDimensions[i]; j++) {
        for (const res of result) {
          intermediateResult.push({
            name: `${res.name}[${j}]`,
            arrayAccess: [...(res.arrayAccess || []), j],
          });
        }
      }

      result = intermediateResult;
    }

    return result;
  }

  private _validateCondition(
    condition: CircomValueType | null,
    linkedErrors: ParserErrorItem[],
    parentContext: ParserRuleContext,
    expressionContext: ExpressionContext,
  ): boolean {
    if (condition === null) {
      this.errors.push({
        type: ErrorType.FailedToResolveIfCondition,
        context: parentContext,
        fileIdentifier: this.fileIdentifier,
        message: `Failed to resolve the if condition ${expressionContext.getText()} (${expressionContext.start.line}:${expressionContext.start.column})`,
        linkedParserErrors: linkedErrors,
      });

      return false;
    }

    if (Array.isArray(condition)) {
      this.errors.push({
        type: ErrorType.InvalidConditionReturnedValue,
        context: parentContext,
        fileIdentifier: this.fileIdentifier,
        message: `Value returned from the condition is an array ${expressionContext.getText()} (${expressionContext.start.line}:${expressionContext.start.column})`,
        linkedParserErrors: linkedErrors,
      });

      return false;
    }

    if (condition !== 1n && condition !== 0n) {
      this.errors.push({
        type: ErrorType.InvalidConditionReturnedValue,
        context: parentContext,
        fileIdentifier: this.fileIdentifier,
        message: `Value returned from the condition is not a boolean ${expressionContext.getText()} (${expressionContext.start.line}:${expressionContext.start.column})`,
        linkedParserErrors: linkedErrors,
      });

      return false;
    }

    return true;
  }
}
