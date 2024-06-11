import os from "os";
import path from "path";

import { ProjectPathsConfig } from "hardhat/types";
import { normalizeSourceName, localSourceNameToPath } from "hardhat/utils/source-names";

import { CIRCOM_CIRCUITS_CACHE_FILENAME } from "../internal/constants";

export function getCircomFilesCachePath(paths: ProjectPathsConfig): string {
  return localSourceNameToPath(paths.cache, CIRCOM_CIRCUITS_CACHE_FILENAME);
}

export function getCircuitsDirFullPath(projectRoot: string, circuitsDir: string): string {
  return localSourceNameToPath(projectRoot, normalizeSourceName(circuitsDir));
}

export function getArtifactsDirFullPath(projectRoot: string, artifactsDir: string): string {
  return localSourceNameToPath(projectRoot, normalizeSourceName(artifactsDir));
}

export function getPtauDirFullPath(projectRoot: string, ptauDir: string | undefined): string {
  if (ptauDir) {
    return path.isAbsolute(ptauDir) ? ptauDir : localSourceNameToPath(projectRoot, normalizeSourceName(ptauDir));
  } else {
    return path.join(os.homedir(), ".zkit", ".ptau");
  }
}
