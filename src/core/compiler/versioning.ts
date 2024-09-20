import { CircomResolvedFileInfo } from "../../types/core";

export function getHighestVersion(circomVersions: CircomResolvedFileInfo[] | string[]) {
  let highestVersion = "";

  for (const info of circomVersions) {
    const circomVersion =
      typeof info == "string" ? info : info.resolvedFile.fileData.parsedFileData.pragmaInfo.compilerVersion;

    if (isVersionHigherOrEqual(circomVersion, highestVersion)) {
      highestVersion = circomVersion;
    }
  }

  return highestVersion;
}

export function isVersionHigherOrEqual(version1: string, version2: string): boolean {
  if (!version1 && version2) {
    return false;
  }

  if (!version2) {
    return true;
  }

  const [v1Major, v1Minor, v1Patch] = version1.split(".").map(Number);
  const [v2Major, v2Minor, v2Patch] = version2.split(".").map(Number);

  if (v1Major !== v2Major) {
    return v1Major > v2Major;
  }

  if (v1Minor !== v2Minor) {
    return v1Minor > v2Minor;
  }

  return v1Patch >= v2Patch;
}

export function isVersionValid(version: string) {
  const versionParts = version.trim().split(".");

  if (versionParts.length !== 3) {
    return false;
  }

  return !isNaN(Number(versionParts[0])) && !isNaN(Number(versionParts[1])) && !isNaN(Number(versionParts[2]));
}
