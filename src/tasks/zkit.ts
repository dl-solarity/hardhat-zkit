import { subtask, types } from "hardhat/config";

import { CircuitZKit, VerifierTemplateType } from "@solarity/zkit";

import { TASK_ZKIT_GET_CIRCUIT_ZKIT } from "./task-names";
import { getAllDirsMatchingSync, getNormalizedFullPath } from "../utils/path-utils";
import { HardhatZKitError } from "./errors";

subtask(TASK_ZKIT_GET_CIRCUIT_ZKIT)
  .addOptionalParam("artifactsDir", undefined, undefined, types.string)
  .addOptionalParam("verifiersDir", undefined, undefined, types.string)
  .addOptionalParam("verifierTemplateType", undefined, undefined, types.any)
  .addParam("circuitName", undefined, undefined, types.string)
  .setAction(
    async (
      {
        artifactsDir,
        verifiersDir,
        verifierTemplateType,
        circuitName,
      }: {
        artifactsDir?: string;
        verifiersDir?: string;
        verifierTemplateType?: VerifierTemplateType;
        circuitName: string;
      },
      { config },
    ): Promise<CircuitZKit> => {
      const artifactsDirFullPath = getNormalizedFullPath(
        config.paths.root,
        artifactsDir ?? config.zkit.compilationSettings.artifactsDir,
      );

      const foundPaths: string[] = getAllDirsMatchingSync(artifactsDirFullPath, (fullPath: string): boolean => {
        return fullPath.endsWith(`${circuitName}.circom`);
      });

      if (foundPaths.length === 0) {
        throw new HardhatZKitError(`The artifacts for '${circuitName}' circuit do not exist. Please compile circuits`);
      }

      if (foundPaths.length > 1) {
        throw new HardhatZKitError(
          `Invalid circuit name ${circuitName}. Multiple artifacts found along ${foundPaths} paths`,
        );
      }

      const verifiersDirFullPath = getNormalizedFullPath(config.paths.root, verifiersDir ?? config.zkit.verifiersDir);

      return new CircuitZKit({
        circuitName,
        circuitArtifactsPath: foundPaths[0],
        verifierDirPath: verifiersDirFullPath,
        templateType: verifierTemplateType ?? "groth16",
      });
    },
  );
