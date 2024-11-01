import {
  CircomVisitor,
  ComponentMainDeclarationContext,
  ExpressionListContext,
  IncludeDefinitionContext,
  parseSimpleIdentifierList,
  PragmaInvalidVersionContext,
  PragmaVersionContext,
  PublicInputsDefinitionContext,
  TemplateDefinitionContext,
  ExpressionHelper,
} from "@distributedlab/circom-parser";

import { CircomFileData, CircuitResolutionError, ErrorType } from "../../../types/core";

/**
 * Class responsible for gathering comprehensive information from a Circom file.
 *
 * The `CircomFilesVisitor` traverses the abstract syntax tree (AST) of Circom files
 * to collect data about pragma directives, includes, templates, and components.
 * This class provides an efficient means of extracting and organizing the data
 * contained within Circom files for further processing or validation.
 */
export class CircomFilesVisitor extends CircomVisitor<void> {
  fileData: CircomFileData;
  errors: CircuitResolutionError[] = [];

  constructor(public fileIdentifier: string) {
    super();

    this.fileData = {
      pragmaInfo: { isCustom: false, compilerVersion: "" },
      includes: [],
      mainComponentInfo: {
        templateName: null,
        publicInputs: [],
        parameters: [],
      },
      templates: {},
    };
  }

  visitPragmaVersion = (ctx: PragmaVersionContext) => {
    this.fileData.pragmaInfo.compilerVersion = ctx.VERSION().getText();
  };

  visitPragmaInvalidVersion = (ctx: PragmaInvalidVersionContext) => {
    this.errors.push({
      type: ErrorType.InvalidPragmaVersion,
      context: ctx,
      fileIdentifier: this.fileIdentifier,
    });
  };

  visitPragmaCustomTemplates = () => {
    this.fileData.pragmaInfo.isCustom = true;
  };

  visitIncludeDefinition = (ctx: IncludeDefinitionContext) => {
    this.fileData.includes.push(ctx.STRING().getText().slice(1, -1));
  };

  visitTemplateDefinition = (ctx: TemplateDefinitionContext) => {
    if (ctx.ID().getText() in this.fileData.templates) {
      this.errors.push({
        type: ErrorType.TemplateAlreadyUsed,
        context: ctx,
        fileIdentifier: this.fileIdentifier,
        templateIdentifier: ctx.ID().getText(),
        message: `Template name ${ctx.ID().getText()} (${ctx.start.line}:${ctx.start.column}) is already in use`,
      });

      return;
    }

    this.fileData.templates[ctx.ID().getText()] = {
      parameters: ctx._argNames ? parseSimpleIdentifierList(ctx._argNames) : [],
      isCustom: !!ctx.CUSTOM(),
      parallel: !!ctx.PARALLEL(),
      context: ctx,
    };

    return;
  };

  visitBody = () => {
    return;
  };

  visitComponentMainDeclaration = (ctx: ComponentMainDeclarationContext) => {
    this.fileData.mainComponentInfo.templateName = ctx.ID().getText();

    if (ctx.publicInputsDefinition()) this.visit(ctx.publicInputsDefinition());
    if (ctx._argValues) this.visit(ctx._argValues);
  };

  visitPublicInputsDefinition = (ctx: PublicInputsDefinitionContext) => {
    for (const input of ctx._publicInputs.ID_list()) {
      this.fileData.mainComponentInfo.publicInputs.push(input.getText());
    }
  };

  visitExpressionList = (ctx: ExpressionListContext) => {
    const expressionHelper = new ExpressionHelper(this.fileIdentifier);

    for (let i = 0; i < ctx.expression_list().length; i++) {
      const [value, errors] = expressionHelper.setExpressionContext(ctx.expression(i)).parseExpression();

      if (value === null) {
        this.errors.push({
          type: ErrorType.FailedToResolveMainComponentParameter,
          context: ctx.expression(i),
          fileIdentifier: this.fileIdentifier,
          linkedParserErrors: errors,
          message: `Failed to parse array parameter with index ${i}. Parameter: ${ctx.expression(i).getText()} (${ctx.expression(i).start.line}:${ctx.expression(i).start.column})`,
        });

        continue;
      }

      if (errors.length > 0) {
        this.errors.push({
          type: ErrorType.InternalExpressionHelperError,
          context: ctx.expression(i),
          fileIdentifier: this.fileIdentifier,
          linkedParserErrors: errors,
        });
      }

      this.fileData.mainComponentInfo.parameters.push(value);
    }
  };
}
