import { FileNotFoundError, getFileTrueCase } from "@nomicfoundation/hardhat-utils/fs";
import fs from "fs";
import path from "path";

import { MAKEFILE_NAME, NODE_MODULES } from "../constants.js";
import { HardhatZKitError } from "../errors.js";
import { FileFilterSettings } from "../types/zkit-config.js";

export function getNormalizedFullPath(projectRoot: string, dirPath: string): string {
  return localSourceNameToPath(projectRoot, normalizeSourceName(dirPath));
}

/**
 * This function takes a valid local source name and returns its path. The
 * source name doesn't need to point to an existing file.
 */
export function localSourceNameToPath(projectRoot: string, sourceName: string): string {
  return path.join(projectRoot, sourceName);
}

/**
 * Normalizes the source name, for example, by replacing `a/./b` with `a/b`.
 *
 * The sourceName param doesn't have to be a valid source name. It can,
 * for example, be denormalized.
 */
export function normalizeSourceName(sourceName: string): string {
  return replaceBackslashes(path.normalize(sourceName));
}

/**
 * This function replaces backslashes (\\) with slashes (/).
 *
 * Note that a source name must not contain backslashes.
 */
export function replaceBackslashes(str: string): string {
  // Based in the npm module slash
  const isExtendedLengthPath = /^\\\\\?\\/.test(str);
  const hasNonAscii = /[^\u0000-\u0080]+/.test(str);

  if (isExtendedLengthPath || hasNonAscii) {
    return str;
  }

  return str.replace(/\\/g, "/");
}

/**
 * Reads a directory recursively and calls the callback for each file.
 *
 * @dev After Node.js 20.0.0 the `recursive` option is available.
 *
 * @param {string} dir - The directory to read.
 * @param {(dir: string, file: string) => void} callback - The callback function.
 */
export function readDirRecursively(dir: string, callback: (dir: string, file: string) => void): void {
  if (!fs.existsSync(dir)) {
    return;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      readDirRecursively(entryPath, callback);
    }

    if (entry.isFile()) {
      callback(dir, entryPath);
    }
  }
}

export function renameFilesRecursively(dir: string, searchValue: string, replaceValue: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const oldEntryPath: string = path.join(dir, entry.name);
    let newEntryPath: string = oldEntryPath;

    if (entry.name.includes(searchValue)) {
      newEntryPath = path.join(dir, entry.name.replace(searchValue, replaceValue));

      fs.renameSync(oldEntryPath, newEntryPath);
    } else if (dir.endsWith("_cpp") && entry.name === MAKEFILE_NAME) {
      const makefileContent: string = fs.readFileSync(oldEntryPath, "utf-8");

      fs.writeFileSync(oldEntryPath, makefileContent.replaceAll(searchValue, replaceValue));
    }

    if (entry.isDirectory()) {
      renameFilesRecursively(newEntryPath, searchValue, replaceValue);
    }
  }
}

export function filterCircuitFiles<T>(
  circuitsInfo: T[],
  circuitsRoot: string,
  filterSettings: FileFilterSettings,
  getCircuitPath: (circuitInfo: T) => string,
): T[] {
  const contains = (circuitsRoot: string, pathList: string[], source: any) => {
    const isSubPath = (parent: string, child: string) => {
      const parentTokens = parent.split(/\\|\//).filter((i) => i.length);
      const childTokens = child.split(/\\|\//).filter((i) => i.length);

      return parentTokens.every((t, i) => childTokens[i] === t);
    };

    return pathList.some((p: any) => {
      return isSubPath(getNormalizedFullPath(circuitsRoot, p), source);
    });
  };

  return circuitsInfo.filter((circuitInfo: T) => {
    const circuitFullPath: string = getCircuitPath(circuitInfo);

    return (
      (filterSettings.onlyFiles.length == 0 || contains(circuitsRoot, filterSettings.onlyFiles, circuitFullPath)) &&
      !contains(circuitsRoot, filterSettings.skipFiles, circuitFullPath)
    );
  });
}

/**
 * Returns the source name of an existing local file's absolute path.
 *
 * Throws is the file doesn't exist, it's not inside the project, or belongs
 * to a library.
 * @dev Source: hardhat version 2. todo
 */
export async function localPathToSourceName(projectRoot: string, localFileAbsolutePath: string): Promise<string> {
  const relativePath = path.relative(projectRoot, localFileAbsolutePath);
  const normalized = normalizeSourceName(relativePath);

  if (normalized.startsWith("..")) {
    throw new HardhatZKitError(
      `The file path is treated as local but is outside the project, path: ${localFileAbsolutePath}`,
    );
  }

  if (normalized.includes(NODE_MODULES)) {
    throw new HardhatZKitError(
      `The file path is treated as local but is inside a node_modules directory path: ${localFileAbsolutePath}`,
    );
  }

  return getSourceNameTrueCase(projectRoot, relativePath);
}

/**
 * Returns the true casing of `p` as a relative path from `fromDir`. Throws if
 * `p` doesn't exist. `p` MUST be in source name format.
 */
export async function getSourceNameTrueCase(fromDir: string, p: string): Promise<string> {
  try {
    const realCase = await getFileTrueCase(fromDir, slashesToPathSeparator(p));
    return normalizeSourceName(realCase);
  } catch (error) {
    if (error instanceof FileNotFoundError) {
      throw new HardhatZKitError(`Solidity source file ${p} not found`);
    }

    throw error;
  }
}

function slashesToPathSeparator(str: string): string {
  if (path.sep === "/") {
    return str;
  }

  return str.replace(/\//g, path.sep);
}
