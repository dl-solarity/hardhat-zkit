import { ContributionTemplateType } from "../zkit-config";

export type SetupCacheEntry = {
  circuitSourceName: string;
  r1csContentHash: string;
  r1csSourceName: string;
  lastModificationDate: number;
  setupSettings: SetupSettings;
};

export type SetupCache = {
  _format: string;
  files: Record<string, SetupCacheEntry>;
};

export type SetupSettings = {
  contributionTemplate: ContributionTemplateType;
  contributions: number;
};
