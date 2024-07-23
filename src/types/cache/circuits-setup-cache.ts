import { ContributionSettings } from "../core";

export type SetupCacheEntry = {
  circuitSourceName: string;
  r1csContentHash: string;
  r1csSourcePath: string;
  contributionSettings: ContributionSettings;
};

export type SetupCache = {
  _format: string;
  files: Record<string, SetupCacheEntry>;
};
