import { SignalInfo } from "../core";

export interface ICircuitArtifacts {
  readCircuitArtifact(circuitNameOrFullyQualifiedName: string): Promise<CircuitArtifact>;

  circuitArtifactExists(circuitNameOrFullyQualifiedName: string): Promise<boolean>;

  getAllCircuitFullyQualifiedNames(): Promise<string[]>;

  getCircuitArtifactPaths(): Promise<string[]>;

  formCircuitArtifactPathFromFullyQualifiedName(fullyQualifiedName: string): string;

  getCircuitFullyQualifiedName(sourceName: string, circuitName: string): string;

  getCircuitArtifactsDirFullPath(): string;

  getCircuitArtifactFileFullPath(circuitArtifact: CircuitArtifact, fileType: ArtifactsFileType): string;

  saveCircuitArtifact(circuitArtifact: CircuitArtifact, updatedFileTypes: ArtifactsFileType[]): Promise<void>;

  clearCache(): void;

  disableCache(): void;
}

export type CircuitArtifact = {
  _format: string;
  circuitFileName: string;
  circuitTemplateName: string;
  circuitSourceName: string;
  baseCircuitInfo: BaseCircuitInfo;
  compilerOutputFiles: Partial<Record<ArtifactsFileType, CompilerOutputFileInfo>>;
};

export type BaseCircuitInfo = {
  constraintsNumber: number;
  signals: SignalInfo[];
};

export type CompilerOutputFileInfo = {
  fileSourcePath: string;
  fileHash: string;
};

export type ArtifactsCache = {
  artifactPaths?: string[];
  artifactNameToArtifactPathCache: Map<string, string>;
};

export const ArtifactsFileTypes = ["r1cs", "zkey", "vkey", "sym", "json", "wasm", "c", "ast"] as const;
export type ArtifactsFileType = (typeof ArtifactsFileTypes)[number];
