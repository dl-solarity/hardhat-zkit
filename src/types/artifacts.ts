import { ArtifactsFileType } from "@solarity/zkit";
import { CircomCompilerOutput } from "@solarity/zktype";

export interface ICircuitArtifacts {
  readCircuitArtifact(circuitNameOrFullyQualifiedName: string): Promise<CircuitArtifact>;

  circuitArtifactExists(circuitNameOrFullyQualifiedName: string): Promise<boolean>;

  getAllCircuitFullyQualifiedNames(): Promise<string[]>;

  getCircuitArtifactPaths(): Promise<string[]>;

  saveCircuitArtifact(circuitArtifact: CircuitArtifact): Promise<void>;

  clearCache(): void;

  disableCache(): void;
}

export type CircuitArtifact = {
  _format: string;
  circuitFileName: string;
  circuitTemplateName: string;
  sourcePath: string;
  compilerOutputFiles: CompilerOutputFiles;
  circomCompilerOutput: CircomCompilerOutput[];
};

export type CompilerOutputFiles = {
  [fileType in ArtifactsFileType]: CompilerOutputFileInfo;
};

export type CompilerOutputFileInfo = {
  fileSourceName: string;
  fileHash: string;
};

export type ArtifactsCache = {
  artifactPaths?: string[];
  artifactNameToArtifactPathCache: Map<string, string>;
};
