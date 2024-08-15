import { LibraryInfo } from "hardhat/types/builtin-tasks";

import { CircomFileData } from "./circom-files-visitor";

export interface CircomResolvedFile {
  library?: LibraryInfo;
  sourceName: string;
  absolutePath: string;
  fileData: CircomFileData;
  lastModificationDate: Date;
  contentHash: string;

  getVersionedName(): string;
}
