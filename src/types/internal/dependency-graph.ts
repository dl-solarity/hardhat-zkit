import { ResolvedFile } from "hardhat/types/builtin-tasks";

export interface TransitiveDependency {
  dependency: ResolvedFile;

  /**
   * The list of intermediate files between the file and the dependency
   * this is not guaranteed to be the shortest path
   */
  path: ResolvedFile[];
}
