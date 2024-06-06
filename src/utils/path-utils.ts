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
