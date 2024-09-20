import { CompileFlags, ContributionSettings, ResolvedFileData } from "../src/types/core";
import { CompileCacheEntry, SetupCacheEntry } from "../src/types/cache";
import { getNormalizedFullPath } from "../src/utils/path-utils";
import { getFileHash } from "../src/utils/utils";
import { CircomFilesParser } from "../src/core";
import fsExtra from "fs-extra";
import { defaultCompileFlags, defaultContributionSettings } from "./constants";

export async function getCompileCacheEntry(
  projectRoot: string,
  sourceName: string,
  compileFlags: CompileFlags = defaultCompileFlags,
  contentHash?: string,
): Promise<CompileCacheEntry> {
  const circuitPath = getNormalizedFullPath(projectRoot, sourceName);

  if (!contentHash) {
    contentHash = getFileHash(circuitPath);
  }

  const parser: CircomFilesParser = new CircomFilesParser();
  const fileData: ResolvedFileData = parser.parse(fsExtra.readFileSync(circuitPath, "utf-8"), circuitPath, contentHash);

  const stats = await fsExtra.stat(circuitPath);
  const lastModificationDate: Date = new Date(stats.ctime);

  return {
    sourceName,
    contentHash,
    lastModificationDate: lastModificationDate.valueOf(),
    compileFlags,
    fileData,
  };
}

export async function getSetupCacheEntry(
  sourceName: string,
  r1csSourcePath: string,
  contributionSettings: ContributionSettings = defaultContributionSettings,
  r1csContentHash?: string,
): Promise<SetupCacheEntry> {
  if (!r1csContentHash) {
    r1csContentHash = getFileHash(r1csSourcePath);
  }

  return {
    circuitSourceName: sourceName,
    r1csSourcePath,
    r1csContentHash,
    contributionSettings,
  };
}
