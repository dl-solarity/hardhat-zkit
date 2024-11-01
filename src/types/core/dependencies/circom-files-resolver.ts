import { LibraryInfo } from "hardhat/types/builtin-tasks";

import { CircomValueType } from "@distributedlab/circom-parser";

import { CircomFileData } from "./parser/circom-files-visitor";

export interface CircomResolvedFile {
  library?: LibraryInfo;
  sourceName: string;
  absolutePath: string;
  fileData: ResolvedFileData;
  lastModificationDate: Date;
  contentHash: string;

  getVersionedName(): string;
}

export type SignalType = "Input" | "Output" | "Intermediate";
export type VisibilityType = "Public" | "Private";

export type SignalInfo = {
  name: string;
  dimension: number[];
  type: SignalType;
  visibility: VisibilityType;
};

export type ResolvedMainComponentData = {
  parameters: Record<string, CircomValueType>;
  signals: SignalInfo[];
};

export type ResolvedFileData = {
  parsedFileData: CircomFileData;
  mainComponentData?: ResolvedMainComponentData;
};
