import os from "os";
import fs from "fs";
import path from "path";

import { ProjectPathsConfig } from "hardhat/types";
import { normalizeSourceName, localSourceNameToPath } from "hardhat/utils/source-names";

import { CIRCOM_CIRCUITS_CACHE_FILENAME } from "../internal/constants";
import { FileSystemAccessError, InvalidDirectoryError } from "hardhat/internal/util/fs-utils";

export function getCircomFilesCachePath(paths: ProjectPathsConfig): string {
  return localSourceNameToPath(paths.cache, CIRCOM_CIRCUITS_CACHE_FILENAME);
}

export function getNormalizedFullPath(projectRoot: string, dirPath: string): string {
  return localSourceNameToPath(projectRoot, normalizeSourceName(dirPath));
}

export function getPtauDirFullPath(projectRoot: string, ptauDir: string | undefined): string {
  if (ptauDir) {
    return path.isAbsolute(ptauDir) ? ptauDir : localSourceNameToPath(projectRoot, normalizeSourceName(ptauDir));
  } else {
    return path.join(os.homedir(), ".zkit", ".ptau");
  }
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
