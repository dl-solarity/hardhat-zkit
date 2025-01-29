import fs from "fs";
import path from "path";

import { normalizeSourceName, localSourceNameToPath } from "hardhat/utils/source-names";

import { MAKEFILE_NAME } from "../constants";

import { FileFilterSettings } from "../types/zkit-config";

export function getNormalizedFullPath(projectRoot: string, dirPath: string): string {
  return localSourceNameToPath(projectRoot, normalizeSourceName(dirPath));
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
