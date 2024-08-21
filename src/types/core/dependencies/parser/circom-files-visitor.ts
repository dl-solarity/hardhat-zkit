import { MainComponent, PragmaComponent } from "@distributed-lab/circom-parser";

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
