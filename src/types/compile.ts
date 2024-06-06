import { ResolvedFile } from "hardhat/types";

export type ResolvedFileWithDependencies = {
  resolvedFile: ResolvedFile;
  dependencies: ResolvedFile[];
};
