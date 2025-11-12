import fsExtra from "fs-extra";
import path from "path";
import resolve from "resolve";

import { getRealPath } from "@nomicfoundation/hardhat-utils/fs";

import { LibraryInfo, CircomResolvedFile as ICircomResolvedFile, ResolvedFileData } from "../../types/core/index.js";
import { normalizeSourceName, replaceBackslashes } from "../../utils/path-utils.js";
import {
  includesOwnPackageName,
  isAbsolutePathSourceName,
  isLocalSourceName,
  validateSourceNameExistenceAndCasing,
  validateSourceNameFormat,
} from "../../utils/source-names.js";
import { CircomFilesParser } from "./parser/CircomFilesParser.js";

import { getFileHash } from "../../utils/utils.js";
import { CircuitsCompileCache } from "../../cache/CircuitsCompileCache.js";
import { CIRCOM_FILE_REG_EXP, NODE_MODULES, NODE_MODULES_REG_EXP, URI_SCHEME_REG_EXP } from "../../constants.js";
import { HardhatZKitError } from "../../errors.js";
import { HardhatError } from "@nomicfoundation/hardhat-errors";

export class CircomResolvedFile implements ICircomResolvedFile {
  public readonly library?: LibraryInfo;

  constructor(
    public readonly sourceName: string,
    public readonly absolutePath: string,
    public readonly contentHash: string,
    public readonly lastModificationDate: Date,
    public fileData: ResolvedFileData,
    libraryName?: string,
    libraryVersion?: string,
  ) {
    if (
      !(
        (libraryName === undefined && libraryVersion === undefined) ||
        (libraryName !== undefined && libraryVersion !== undefined)
      )
    ) {
      throw new HardhatZKitError("Libraries should have both name and version, or neither one");
    }

    if (libraryName !== undefined && libraryVersion !== undefined) {
      this.library = {
        name: libraryName,
        version: libraryVersion,
      };
    }
  }

  public getVersionedName() {
    return this.sourceName + (this.library !== undefined ? `@v${this.library.version}` : "");
  }
}

export class CircomFilesResolver {
  private readonly _cache: Map<string, CircomResolvedFile> = new Map();

  constructor(
    private readonly _projectRoot: string,
    private readonly _parser: CircomFilesParser,
    private readonly _readFile: (absolutePath: string) => string,
  ) {}

  /**
   * Resolves a source name into a CircomResolvedFile.
   *
   * @param sourceName The circuit source name.
   */
  public async resolveSourceName(sourceName: string): Promise<CircomResolvedFile> {
    const cached = this._cache.get(sourceName);

    if (cached !== undefined) {
      return cached;
    }

    validateSourceNameFormat(sourceName);

    let resolvedFile: CircomResolvedFile;

    if (await isLocalSourceName(this._projectRoot, sourceName)) {
      resolvedFile = await this._resolveLocalSourceName(sourceName);
    } else {
      resolvedFile = await this._resolveLibrarySourceName(sourceName);
    }

    this._cache.set(sourceName, resolvedFile);

    return resolvedFile;
  }

  /**
   * Resolves an import from an already resolved file.
   * @param from The file where the import statement is present.
   * @param importName The path in the import statement.
   */
  public async resolveImport(from: CircomResolvedFile, importName: string): Promise<CircomResolvedFile> {
    const scheme = this._getUriScheme(importName);

    if (scheme !== undefined) {
      throw new HardhatZKitError(
        `Invalid import ${importName} from ${from.sourceName}. Hardhat doesn't support imports via ${scheme}`,
      );
    }

    if (replaceBackslashes(importName) !== importName) {
      throw new HardhatZKitError(
        `Invalid import ${importName} from ${from.sourceName}. Imports must use / instead of \\, even in Windows`,
      );
    }

    if (isAbsolutePathSourceName(importName)) {
      throw new HardhatZKitError(
        `Invalid import ${importName} from ${from.sourceName}. Hardhat doesn't support imports with absolute paths`,
      );
    }

    // Edge-case where an import can contain the current package's name in monorepos.
    // The path can be resolved because there's a symlink in the node modules.
    if (await includesOwnPackageName(importName)) {
      throw new HardhatZKitError(
        `Invalid import ${importName} from ${from.sourceName}. Trying to import file using the own package's name`,
      );
    }

    try {
      let sourceName: string;

      const isRelativeImport = this._isRelativeImport(from, importName);

      if (isRelativeImport) {
        sourceName = await this._relativeImportToSourceName(from, importName);
      } else {
        sourceName = normalizeSourceName(importName); // The sourceName of the imported file is not transformed
      }

      const cached = this._cache.get(sourceName);

      if (cached !== undefined) {
        return cached;
      }

      let resolvedFile: CircomResolvedFile;

      // We have this special case here, because otherwise local relative
      // imports can be treated as library imports. For example if
      // `circuits/c.circom` imports `../non-existent/a.circom`
      if (from.library === undefined && isRelativeImport && !this._isRelativeImportToLibrary(from, importName)) {
        resolvedFile = await this._resolveLocalSourceName(sourceName);
      } else {
        resolvedFile = await this.resolveSourceName(sourceName);
      }

      this._cache.set(sourceName, resolvedFile);

      return resolvedFile;
    } catch (error) {
      console.log(error);

      if (
        HardhatError.isHardhatError(error)
        // HardhatError.ERRORS.RESOLVER.FILE_NOT_FOUND || ERRORS.RESOLVER.LIBRARY_FILE_NOT_FOUND
      ) {
        throw new Error("todo");
        // throw new HardhatError(
        //   ERRORS.RESOLVER.IMPORTED_FILE_NOT_FOUND,
        //   {
        //     imported: importName,
        //     from: from.sourceName,
        //   },
        //   error,
        // );
      }

      if (HardhatError.isHardhatError(error)) {
        // ERRORS.RESOLVER.WRONG_SOURCE_NAME_CASING
        throw new Error("todo");
        // throw new HardhatError(
        //   ERRORS.RESOLVER.INVALID_IMPORT_WRONG_CASING,
        //   {
        //     imported: importName,
        //     from: from.sourceName,
        //   },
        //   error,
        // );
      }

      if (HardhatError.isHardhatError(error)) {
        //ERRORS.RESOLVER.LIBRARY_NOT_INSTALLED
        throw new Error("todo");
        // throw new HardhatError(
        //   ERRORS.RESOLVER.IMPORTED_LIBRARY_NOT_INSTALLED,
        //   {
        //     library: error.messageArguments.library,
        //     from: from.sourceName,
        //   },
        //   error,
        // );
      }

      if (HardhatError.isHardhatError(error)) {
        //ERRORS.GENERAL.INVALID_READ_OF_DIRECTORY
        throw new Error("todo");
        // throw new HardhatError(
        //   ERRORS.RESOLVER.INVALID_IMPORT_OF_DIRECTORY,
        //   {
        //     imported: importName,
        //     from: from.sourceName,
        //   },
        //   error,
        // );
      }

      throw error;
    }
  }

  private async _resolveLocalSourceName(sourceName: string): Promise<CircomResolvedFile> {
    await this._validateSourceNameExistenceAndCasing(this._projectRoot, sourceName, false);

    const absolutePath = path.join(this._projectRoot, sourceName);
    return this._resolveFile(sourceName, absolutePath);
  }

  private async _resolveLibrarySourceName(sourceName: string): Promise<CircomResolvedFile> {
    const normalizedSourceName = sourceName.replace(NODE_MODULES_REG_EXP, "");
    const libraryName = this._getLibraryName(normalizedSourceName);

    let packageJsonPath;

    try {
      packageJsonPath = this._resolveNodeModulesFileFromProjectRoot(path.join(libraryName, "package.json"));
    } catch (error) {
      throw new Error("todo");
      // throw new HardhatError(
      //   HardhatError.ERRORS.RESOLVER.LIBRARY_NOT_INSTALLED,
      //   {
      //     library: libraryName,
      //   },
      //   error as Error,
      // );
    }

    let nodeModulesPath = path.dirname(path.dirname(packageJsonPath));

    if (this._isScopedPackage(normalizedSourceName)) {
      nodeModulesPath = path.dirname(nodeModulesPath);
    }

    let absolutePath: string;

    if (path.basename(nodeModulesPath) !== NODE_MODULES) {
      // this can happen in monorepos that use PnP, in those
      // cases we handle resolution differently
      const packageRoot = path.dirname(packageJsonPath);
      const pattern = new RegExp(`^${libraryName}/?`);
      const fileName = normalizedSourceName.replace(pattern, "");

      await this._validateSourceNameExistenceAndCasing(
        packageRoot,
        // TODO: this is _not_ a source name; we should handle this scenario in
        // a better way
        fileName,
        true,
      );
      absolutePath = path.join(packageRoot, fileName);
    } else {
      await this._validateSourceNameExistenceAndCasing(nodeModulesPath, normalizedSourceName, true);
      absolutePath = path.join(nodeModulesPath, normalizedSourceName);
    }

    const packageInfo: {
      name: string;
      version: string;
    } = await fsExtra.readJson(packageJsonPath);

    const libraryVersion = packageInfo.version;

    return this._resolveFile(
      sourceName,
      // We resolve to the real path here, as we may be resolving a linked library
      await getRealPath(absolutePath),
      libraryName,
      libraryVersion,
    );
  }

  private async _relativeImportToSourceName(from: CircomResolvedFile, imported: string): Promise<string> {
    // This is a special case, were we turn relative imports from local files
    // into library imports if necessary. The reason for this is that many
    // users just do `import "../node_modules/lib/a.circom";`.
    if (this._isRelativeImportToLibrary(from, imported)) {
      return this._relativeImportToLibraryToSourceName(from, imported);
    }

    const sourceName = normalizeSourceName(path.join(path.dirname(from.sourceName), imported));

    // If the file with the import is local, and the normalized version
    // starts with ../ means that it's trying to get outside of the project.
    if (from.library === undefined && sourceName.startsWith("../")) {
      throw new Error("todo");
      //throw new HardhatError(ERRORS.RESOLVER.INVALID_IMPORT_OUTSIDE_OF_PROJECT, { from: from.sourceName, imported });
    }

    if (from.library !== undefined && !this._isInsideSameDir(from.sourceName, sourceName)) {
      // If the file is being imported from a library, this means that it's
      // trying to reach another one.

      throw new Error("todo");
      // throw new HardhatError(ERRORS.RESOLVER.ILLEGAL_IMPORT, {
      //   from: from.sourceName,
      //   imported,
      // });
    }

    return sourceName;
  }

  private async _resolveFile(
    sourceName: string,
    absolutePath: string,
    libraryName?: string,
    libraryVersion?: string,
  ): Promise<CircomResolvedFile> {
    const rawContent = await this._readFile(absolutePath);
    const stats = await fsExtra.stat(absolutePath);
    const lastModificationDate = new Date(stats.ctime);

    const contentHash = await getFileHash(absolutePath);
    const circuitsFilesCacheEntry = CircuitsCompileCache!.getEntry(absolutePath);

    let fileData;

    // reading the cache if the entry is available and up to date
    if (circuitsFilesCacheEntry === undefined || circuitsFilesCacheEntry.contentHash !== contentHash) {
      fileData = this._parser.parse(rawContent, absolutePath, contentHash);
    } else {
      fileData = circuitsFilesCacheEntry.fileData;
    }

    const resolvedFile = new CircomResolvedFile(
      sourceName,
      absolutePath,
      contentHash,
      lastModificationDate,
      fileData,
      libraryName,
      libraryVersion,
    );

    return resolvedFile;
  }

  private _isRelativeImport(from: CircomResolvedFile, imported: string): boolean {
    return (
      imported.startsWith("./") ||
      imported.startsWith("../") ||
      fsExtra.existsSync(this._getImportAbsolutePath(from.absolutePath, imported))
    );
  }

  private _getImportAbsolutePath(fromAbsolutePath: string, imported: string): string {
    return fromAbsolutePath.replace(CIRCOM_FILE_REG_EXP, imported);
  }

  private _resolveNodeModulesFileFromProjectRoot(fileName: string) {
    return resolve.sync(fileName, {
      basedir: this._projectRoot,
      preserveSymlinks: true,
    });
  }

  private _getLibraryName(sourceName: string): string {
    let endIndex: number;
    if (this._isScopedPackage(sourceName)) {
      endIndex = sourceName.indexOf("/", sourceName.indexOf("/") + 1);
    } else if (sourceName.indexOf("/") === -1) {
      endIndex = sourceName.length;
    } else {
      endIndex = sourceName.indexOf("/");
    }

    return sourceName.slice(0, endIndex);
  }

  private _getUriScheme(s: string): string | undefined {
    const match = URI_SCHEME_REG_EXP.exec(s);
    if (match === null) {
      return undefined;
    }

    return match[1];
  }

  private _isInsideSameDir(sourceNameInDir: string, sourceNameToTest: string) {
    const firstSlash = sourceNameInDir.indexOf("/");
    const dir = firstSlash !== -1 ? sourceNameInDir.substring(0, firstSlash) : sourceNameInDir;

    return sourceNameToTest.startsWith(dir);
  }

  private _isScopedPackage(packageOrPackageFile: string): boolean {
    return packageOrPackageFile.startsWith("@");
  }

  private _isRelativeImportToLibrary(from: CircomResolvedFile, imported: string): boolean {
    return (
      this._isRelativeImport(from, imported) && from.library === undefined && imported.includes(`${NODE_MODULES}/`)
    );
  }

  private _relativeImportToLibraryToSourceName(from: CircomResolvedFile, imported: string): string {
    const sourceName = normalizeSourceName(path.join(path.dirname(from.sourceName), imported));

    const nmIndex = sourceName.indexOf(`${NODE_MODULES}/`);
    return sourceName.substring(nmIndex + NODE_MODULES.length + 1);
  }

  private async _validateSourceNameExistenceAndCasing(fromDir: string, sourceName: string, isLibrary: boolean) {
    try {
      await validateSourceNameExistenceAndCasing(fromDir, sourceName);
    } catch (error) {
      if (HardhatError.isHardhatError(error)) {
        //ERRORS.SOURCE_NAMES.FILE_NOT_FOUND
        throw new Error("todo");

        // throw new HardhatError(
        //   isLibrary ? ERRORS.RESOLVER.LIBRARY_FILE_NOT_FOUND : ERRORS.RESOLVER.FILE_NOT_FOUND,
        //   { file: sourceName },
        //   error,
        // );
      }

      if (Error.toString() == "SOURCE_NAMES.WRONG_CASING") {
        throw new Error("todo");
        // throw new HardhatError(
        //   ERRORS.RESOLVER.WRONG_SOURCE_NAME_CASING,
        //   {
        //     incorrect: sourceName,
        //     correct: error.messageArguments.correct,
        //   },
        //   error,
        // );
      }

      throw error;
    }
  }
}
