import { ProvingSystemType } from "@solarity/zkit";

export type ProvingSystemData = {
  provingSystem: ProvingSystemType;
  lastR1CSFileHash: string;
};

export type SetupCacheEntry = {
  circuitSourceName: string;
  r1csSourcePath: string;
  provingSystemsData: ProvingSystemData[];
  contributionsNumber: number;
};
