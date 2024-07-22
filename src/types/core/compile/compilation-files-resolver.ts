import { ResolvedFile } from "hardhat/types/builtin-tasks";

export type ResolvedFileInfo = {
  circuitName: string;
  circuitFullyQualifiedName: string;
  resolvedFile: ResolvedFile;
  dependencies: ResolvedFile[];
};
