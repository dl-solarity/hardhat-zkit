import { CircomValueType } from "@tawny0wl/test-circom-parser";

import { CircomFileData } from "./parser/circom-files-visitor.js";

export interface CircomResolvedFile {
  library?: LibraryInfo;
  sourceName: string;
  absolutePath: string;
  fileData: ResolvedFileData;
  lastModificationDate: Date;
  contentHash: string;

  getVersionedName(): string;
}

/**
 * Information about an npm library.
 */
export interface LibraryInfo {
  name: string;
  version: string;
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
