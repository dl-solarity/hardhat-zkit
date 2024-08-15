import { CircomResolvedFile } from "../dependencies";

export type CircomResolvedFileInfo = {
  circuitName: string;
  circuitFullyQualifiedName: string;
  resolvedFile: CircomResolvedFile;
  dependencies: CircomResolvedFile[];
};
