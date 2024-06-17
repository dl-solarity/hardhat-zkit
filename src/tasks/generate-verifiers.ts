import path from "path";

import { task, types } from "hardhat/config";

import { CircuitZKit } from "@solarity/zkit";

import { TASK_GENERATE_VERIFIERS, TASK_CIRCUITS_COMPILE } from "./task-names";

import { getAllDirsMatchingSync, getNormalizedFullPath } from "../utils/path-utils";

task(TASK_GENERATE_VERIFIERS, "Generate verifiers for circuits")
  .addOptionalParam("artifactsDir", "The circuits artifacts directory path.", undefined, types.string)
  .addOptionalParam("verifiersDir", "The generated verifiers directory path.", undefined, types.string)
  .addFlag("noCompile", "No compile flag")
  .addFlag("quiet", "The quiet flag.")
  .setAction(
    async (
      {
        artifactsDir,
        verifiersDir,
        noCompile,
        quiet,
      }: { artifactsDir: string; verifiersDir: string; noCompile: boolean; quiet: boolean },
      { config, run },
    ) => {
      if (!noCompile) {
        await run(TASK_CIRCUITS_COMPILE, { artifactsDir, quiet });
      }

      const artifactsDirFullPath = getNormalizedFullPath(
        config.paths.root,
        artifactsDir ?? config.zkit.compilationSettings.artifactsDir,
      );
      const verifiersDirFullPath = getNormalizedFullPath(config.paths.root, verifiersDir ?? config.zkit.verifiersDir);

      const artifactsDirArr: string[] = getAllDirsMatchingSync(artifactsDirFullPath, (f) => f.endsWith(".circom"));

      await Promise.all(
        artifactsDirArr.map(async (artifactDirPath: string) => {
          await new CircuitZKit({
            circuitName: path.parse(artifactDirPath).name,
            circuitArtifactsPath: artifactDirPath,
            verifierDirPath: verifiersDirFullPath,
          }).createVerifier();
        }),
      );
    },
  );
