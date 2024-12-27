import { buildVariableContext, CircomValueType, getCircomParser, ParserError } from "@distributedlab/circom-parser";

import { CircomFilesVisitor } from "./CircomFilesVisitor";
import { CircomTemplateInputsVisitor } from "./CircomTemplateInputsVisitor";
import { Reporter } from "../../../reporter";

import { VisitorError } from "../parser/VisitorError";
import { CircomResolvedFile, ErrorType, InputData, ResolvedFileData } from "../../../types/core";

/**
 * A parser class for handling Circom files and extracting relevant data.
 *
 * This class provides methods to parse the contents of Circom files, including
 * extracting template inputs and resolving the overall structure of the Circom
 * circuit. It utilizes a visitor pattern to traverse the parsed structures and
 * collect necessary information about templates, parameters, and included files.
 *
 * The class also implements caching mechanisms to optimize repeated parsing
 * operations, ensuring that parsed data can be quickly retrieved without the
 * need for re-parsing the same file content.
 *
 * This class uses the {@link https://www.npmjs.com/package/@distributedlab/circom-parser | Circom parser}
 * package to facilitate the parsing process.
 */
export class CircomFilesParser {
  private _cache = new Map<string, ResolvedFileData>();

  /**
   * Parses the content of a Circom file and extracts relevant data.
   *
   * This method attempts to retrieve the parsed data from a cache using the
   * provided absolute path and content hash. If the data is not found in
   * the cache, it uses a {@link https://www.npmjs.com/package/@distributedlab/circom-parser | Circom parser} to analyze the file content and
   * gather information about its structure and components.
   *
   * @param fileContent The content of the Circom file as a string
   * @param absolutePath The absolute path to the Circom file being parsed
   * @param contentHash A hash representing the content of the file, used for cache management
   * @returns An object containing the parsed data extracted from the Circom file
   * @throws `ParserError` if the parser encounters any issues while parsing the file, such as syntax errors
   */
  public parse(fileContent: string, absolutePath: string, contentHash: string): ResolvedFileData {
    const internalCacheEntry = this._cache.get(contentHash);

    if (internalCacheEntry !== undefined) {
      return internalCacheEntry;
    }

    const parser = getCircomParser(fileContent);

    const circomFilesVisitor = new CircomFilesVisitor(absolutePath);

    Reporter!.verboseLog("circom-files-parser", "Parsing '%s' file", [absolutePath]);

    const context = parser.circuit();

    if (parser.hasAnyErrors()) {
      throw new ParserError(parser.getAllErrors());
    }

    circomFilesVisitor.visit(context);

    const visitorErrors = circomFilesVisitor.errors.filter(
      (error) =>
        error.type === ErrorType.InvalidPragmaVersion ||
        error.type === ErrorType.TemplateAlreadyVisited ||
        error.type === ErrorType.FailedToResolveMainComponentParameter,
    );

    if (visitorErrors.length > 0) {
      throw new VisitorError(visitorErrors);
    }

    this._cache.set(contentHash, { parsedFileData: circomFilesVisitor.fileData });

    return { parsedFileData: circomFilesVisitor.fileData };
  }

  /**
   * Parses the input parameters of a specified Circom template from the given file.
   *
   * This method initializes a {@link https://www.npmjs.com/package/@distributedlab/circom-parser | Circom parser} for the specified file, then utilizes
   * a visitor to extract information about the template inputs. It checks for any
   * parsing errors and throws a `ParserError` if any issues are encountered.
   * The structured input data associated with the specified template is then returned.
   *
   * @param circomResolvedFile The resolved Circom file data containing the template to parse
   * @param templateName The name of the template whose inputs are being parsed
   * @param parameterValues A record of parameter values used for template input resolution
   * @returns A structured record of input data for the specified template
   * @throws ParserError If any parsing issues occur while processing the template inputs
   */
  public parseTemplateInputs(
    circomResolvedFile: CircomResolvedFile,
    templateName: string,
    parameterValues: Record<string, CircomValueType>,
  ): Record<string, InputData> {
    const parsedFileData = circomResolvedFile.fileData.parsedFileData;
    const values: CircomValueType[] = Object.keys(parameterValues).map((key) => parameterValues[key]);

    const circomTemplateInputsVisitor = new CircomTemplateInputsVisitor(
      circomResolvedFile.absolutePath,
      parsedFileData.templates[templateName].context,
      buildVariableContext(parsedFileData.templates[templateName].parameters, values),
    );

    circomTemplateInputsVisitor.startParse();

    const visitorErrors = circomTemplateInputsVisitor.errors.filter(
      (error) => error.type === ErrorType.SignalDimensionResolution,
    );

    if (visitorErrors.length > 0) {
      throw new VisitorError(visitorErrors);
    }

    return circomTemplateInputsVisitor.templateInputs;
  }
}
