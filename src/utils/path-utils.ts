import { normalizeSourceName, localSourceNameToPath } from "hardhat/utils/source-names";

export function getCircuitsDirFullPath(projectRoot: string, circuitsDir: string): string {
  return localSourceNameToPath(projectRoot, normalizeSourceName(circuitsDir));
}

export function getArtifactsDirFullPath(projectRoot: string, artifactsDir: string): string {
  return localSourceNameToPath(projectRoot, normalizeSourceName(artifactsDir));
}
