import { CircomFilesParser } from "./parser/CircomFilesParser";

import { HardhatZKitError } from "../../errors";
import { CircomResolvedFile, ResolvedMainComponentData, SignalType, VisibilityType } from "../../types/core";

export class CircuitAnalyzer {
  constructor(
    private readonly _parser: CircomFilesParser,
    private readonly _readFile: (absolutePath: string) => Promise<string>,
  ) {}

  public async buildMainComponentData(resolvedFile: CircomResolvedFile, dependencies: CircomResolvedFile[]) {
    const resolvedMainComponent = resolvedFile.fileData.parsedFileData.mainComponentInfo;

    if (!resolvedMainComponent) {
      throw new HardhatZKitError(`Unable to resolve main component data for ${resolvedFile.sourceName} circuit`);
    }

    if (!resolvedFile.fileData.mainComponentData) {
      const templateName = resolvedMainComponent.templateName;
      const mainComponentData: ResolvedMainComponentData = {
        parameters: {},
        signals: [],
      };

      const fileWithTemplate: CircomResolvedFile | undefined = [resolvedFile, ...dependencies].find(
        (file: CircomResolvedFile) => {
          return !!file.fileData.parsedFileData.templates[templateName];
        },
      );

      if (!fileWithTemplate) {
        throw new HardhatZKitError(`Template not found for the main component with ${templateName} name`);
      }

      fileWithTemplate.fileData.parsedFileData.templates[templateName].parameters.forEach(
        (param: string, index: number) => {
          mainComponentData.parameters[param] = resolvedMainComponent.parameters[index];
        },
      );

      if (!resolvedMainComponent.parsedInputs) {
        const template = fileWithTemplate.fileData.parsedFileData.templates[templateName];

        // forcing the parsing of context if it is missing for vars resolution
        if (!template.context) {
          const rawContent = await this._readFile(fileWithTemplate.absolutePath);
          const fileData = this._parser.parse(rawContent, fileWithTemplate.absolutePath, fileWithTemplate.contentHash);

          template.context = fileData.parsedFileData.templates[templateName].context;
        }

        resolvedMainComponent.parsedInputs = this._parser.parseTemplateInputs(
          fileWithTemplate,
          templateName,
          mainComponentData.parameters,
        );
      }

      for (const key of Object.keys(resolvedMainComponent.parsedInputs)) {
        const signalType: SignalType = this._getSignalType(resolvedMainComponent.parsedInputs[key].type);

        if (signalType != "Intermediate") {
          const visibilityType: VisibilityType =
            signalType == "Output" || resolvedMainComponent.publicInputs.includes(key) ? "Public" : "Private";

          mainComponentData.signals.push({
            name: key,
            dimension: resolvedMainComponent.parsedInputs[key].dimension,
            type: signalType,
            visibility: visibilityType,
          });
        }
      }

      resolvedFile.fileData.mainComponentData = mainComponentData;
    }
  }

  private _getSignalType(type: string): SignalType {
    switch (type) {
      case "input":
        return "Input";
      case "output":
        return "Output";
      case "intermediate":
        return "Intermediate";
      default:
        throw new HardhatZKitError(`Invalid signal type - ${type}`);
    }
  }
}
