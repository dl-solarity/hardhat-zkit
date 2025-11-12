import { CircomResolvedFile } from "../dependencies/index.js";

export type CircomResolvedFileInfo = {
  circuitName: string;
  circuitFullyQualifiedName: string;
  resolvedFile: CircomResolvedFile;
  dependencies: CircomResolvedFile[];
};
