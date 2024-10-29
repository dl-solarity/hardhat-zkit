import { MainComponent, PragmaComponent } from "@distributedlab/circom-parser";

export type InputData = {
  dimension: string[];
  type: string;
};

export type Template = {
  inputs: Record<string, InputData>;
  parameters: string[];
  isCustom: boolean;
};

export type Templates = {
  [key: string]: Template;
};

export type CircomFileData = {
  pragmaInfo: PragmaComponent;
  includes: string[];
  mainComponentInfo: MainComponent;
  templates: Templates;
};

export interface Token {
  tokenIndex: number;
  line: number;
  column: number;
  channel: number;
  text: string;
  type: number;
  start: number;
  stop: number;
}

export interface SimpleParserRuleContext {
  start: Token;

  getText(): string;
}
