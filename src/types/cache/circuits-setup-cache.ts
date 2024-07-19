import { ContributionSettings } from "../setup/setup-processor";

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
