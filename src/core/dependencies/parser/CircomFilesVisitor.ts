import {
  CircomVisitor,
  ComponentMainDeclarationContext,
  IncludeDeclarationContext,
  ParserError,
  PragmaDeclarationContext,
  CircomExpressionVisitor,
  TemplateDeclarationContext,
  SignalDeclarationContext,
  parseIdentifier,
  IdentifierContext,
} from "@distributedlab/circom-parser";

import { CircomFileData } from "../../../types/core";

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
      inputs: {},
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

      let signalType = "intermediate";

      if (signalDefinition.SIGNAL_TYPE()) {
        signalType = signalDefinition.SIGNAL_TYPE().getText();
      }

      [signalDefinition.identifier(), ...ctx.identifier_list()].forEach((identifier) =>
        this._saveInputData(identifier, signalType),
      );
    }
  };

  visitComponentMainDeclaration = (ctx: ComponentMainDeclarationContext) => {
    this.fileData.mainComponentInfo.templateName = ctx.ID().getText();

    if (ctx.publicInputsList() && ctx.publicInputsList().args() && ctx.publicInputsList().args().ID_list()) {
      ctx
        .publicInputsList()
        .args()
        .ID_list()
        .forEach((input) => {
          this.fileData.mainComponentInfo.publicInputs.push(input.getText());
        });
    }

    if (ctx.expressionList() && ctx.expressionList().expression_list()) {
      const expressionVisitor = new CircomExpressionVisitor(false);

      ctx
        .expressionList()
        .expression_list()
        .forEach((expression) => {
          this.fileData.mainComponentInfo.parameters.push(expressionVisitor.visitExpression(expression));
        });
    }
  };

  private _saveInputData(identifier: IdentifierContext, signalType: string) {
    const parsedData = parseIdentifier(identifier);

    this.fileData.templates[this.currentTemplate!].inputs[parsedData.name] = {
      dimension: parsedData.dimension,
      type: signalType,
    };
  }
}
