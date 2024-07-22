import fs from "fs";
import path from "path";

import { normalizeSourceName, localSourceNameToPath } from "hardhat/utils/source-names";
import { FileSystemAccessError, InvalidDirectoryError } from "hardhat/internal/util/fs-utils";

import { FileFilterSettings } from "../types/zkit-config";

export function getNormalizedFullPath(projectRoot: string, dirPath: string): string {
  return localSourceNameToPath(projectRoot, normalizeSourceName(dirPath));
}

export function getAllDirsMatchingSync(
  absolutePathToDir: string,
  matches?: (absolutePath: string) => boolean,
): string[] {
  const dir = readdirSync(absolutePathToDir);

  const results = dir.map((file) => {
    const absolutePath = path.join(absolutePathToDir, file);
    const stats = fs.statSync(absolutePath);

    if (stats.isDirectory() && (matches === undefined || matches(absolutePath))) {
      return absolutePath;
    } else if (stats.isDirectory()) {
      return getAllDirsMatchingSync(absolutePath, matches).flat();
    } else {
      return [];
    }
  });

  return results.flat();
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
    }

    if (entry.isDirectory()) {
      renameFilesRecursively(newEntryPath, searchValue, replaceValue);
    }
  }
}

function readdirSync(absolutePathToDir: string) {
  try {
    return fs.readdirSync(absolutePathToDir);
  } catch (e: any) {
    if (e.code === "ENOENT") {
      return [];
    }

    if (e.code === "ENOTDIR") {
      throw new InvalidDirectoryError(absolutePathToDir, e);
    }

    throw new FileSystemAccessError(e.message, e);
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
      const parentTokens = parent.split(path.posix.sep).filter((i) => i.length);
      const childTokens = child.split(path.posix.sep).filter((i) => i.length);

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
