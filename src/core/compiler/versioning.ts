import semver from "semver";

import { CircomResolvedFileInfo } from "../../types/core";

export function getHighestVersion(circomVersions: CircomResolvedFileInfo[] | string[]) {
  let highestVersion = "0.0.0";

  for (const info of circomVersions) {
    const circomVersion =
      typeof info == "string" ? info : info.resolvedFile.fileData.parsedFileData.pragmaInfo.compilerVersion;

    if (semver.gte(circomVersion, highestVersion)) {
      highestVersion = circomVersion;
    }
  }

  return highestVersion;
}

export function isVersionValid(version: string): boolean {
  return semver.valid(version) === version;
}
