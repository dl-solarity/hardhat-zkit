import { CircomResolvedFile } from "./circom-files-resolver";

export interface TransitiveDependency {
  dependency: CircomResolvedFile;

  /**
   * The list of intermediate files between the file and the dependency
   * this is not guaranteed to be the shortest path
   */
  path: CircomResolvedFile[];
}
