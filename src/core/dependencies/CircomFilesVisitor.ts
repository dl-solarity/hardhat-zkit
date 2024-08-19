import {
  CircomVisitor,
  ComponentMainDeclarationContext,
  IncludeDeclarationContext,
  ParserError,
  PragmaDeclarationContext,
  CircomExpressionVisitor,
  TemplateDeclarationContext,
  SignalDeclarationContext,
  IdentifierContext,
} from "@distributed-lab/circom-parser";

import { CircomFileData } from "../../types/core";

export class CircomFilesVisitor extends CircomVisitor<void> {
  fileData: CircomFileData;
  currentTemplate: string | null;

  constructor() {
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
    this.currentTemplate = null;
  }

  visitPragmaDeclaration = (ctx: PragmaDeclarationContext) => {
    let isCustom: boolean = false;
    let compilerVersion: string = "";

    ctx.CUSTOM_TEMPLATES() ? (isCustom = true) : (isCustom = false);

    if (ctx.VERSION()) {
      compilerVersion = ctx.VERSION().getText();
    }

    this.fileData.pragmaInfo = { isCustom, compilerVersion };
  };

  visitIncludeDeclaration = (ctx: IncludeDeclarationContext) => {
    this.fileData.includes.push(ctx.STRING().getText().slice(1, -1));
  };

  visitTemplateDeclaration = (ctx: TemplateDeclarationContext) => {
    if (ctx.ID().getText() in this.fileData.templates) {
      throw new ParserError({
        message: `Template name ${ctx.ID().getText()} is already in use`,
        line: ctx.start.line,
        column: ctx.start.column,
      });
    }

    this.currentTemplate = ctx.ID().getText();

    const parameters: string[] = [];

    if (ctx.args() && ctx.args().ID_list()) {
      ctx
        .args()
        .ID_list()
        .forEach((arg) => {
          parameters.push(arg.getText());
        });
    }

    this.fileData.templates[this.currentTemplate] = {
      inputs: [],
      parameters: parameters,
      isCustom: !!ctx.CUSTOM(),
    };

    ctx
      .templateBlock()
      .templateStmt_list()
      .forEach((stmt) => {
        this.visitChildren(stmt);
      });

    this.currentTemplate = null;
  };

  visitSignalDeclaration = (ctx: SignalDeclarationContext) => {
    if (this.currentTemplate) {
      const signalDefinition = ctx.signalDefinition();

      const identifier = signalDefinition.identifier();
      let signalType = "";

      if (signalDefinition.SIGNAL_TYPE()) {
        signalType = signalDefinition.SIGNAL_TYPE().getText();
      }

      this.fileData.templates[this.currentTemplate].inputs.push({
        ...parseIdentifier(identifier),
        type: signalType,
      });

      ctx.identifier_list().forEach((identifier) => {
        this.fileData.templates[this.currentTemplate!].inputs.push({
          ...parseIdentifier(identifier),
          type: signalType,
        });
      });
    }
  };

  visitComponentMainDeclaration = (ctx: ComponentMainDeclarationContext) => {
    this.fileData.mainComponentInfo.templateName = ctx.ID().getText();

    if (ctx.publicInputsList() && ctx.publicInputsList().args()) {
      ctx
        .publicInputsList()
        .args()
        .ID_list()
        .forEach((input) => {
          this.fileData.mainComponentInfo.publicInputs.push(input.getText());
        });
    }

    if (ctx.expressionList()) {
      const expressionVisitor = new CircomExpressionVisitor(false);

      ctx
        .expressionList()
        .expression_list()
        .forEach((expression) => {
          this.fileData.mainComponentInfo.parameters.push(expressionVisitor.visitExpression(expression));
        });
    }
  };
}

function parseIdentifier(identifier: IdentifierContext) {
  const inputDimension: string[] = [];

  identifier.arrayDimension_list().forEach((dimension) => {
    inputDimension.push(dimension.getText().slice(1, -1));
  });

  return {
    name: identifier.ID().getText(),
    dimension: inputDimension,
  };
}
