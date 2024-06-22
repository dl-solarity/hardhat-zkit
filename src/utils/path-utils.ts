import fs from "fs";
import path from "path";

import { normalizeSourceName, localSourceNameToPath } from "hardhat/utils/source-names";
import { FileSystemAccessError, InvalidDirectoryError } from "hardhat/internal/util/fs-utils";

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
