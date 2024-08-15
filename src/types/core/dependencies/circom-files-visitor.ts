import { MainComponent, PragmaComponent, Templates } from "@distributed-lab/circom-parser";

export type CircomFileData = {
  pragmaInfo: PragmaComponent;
  includes: string[];
  mainComponentInfo: MainComponent;
  templates: Templates;
};
