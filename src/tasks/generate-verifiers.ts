import fsExtra from "fs-extra";

import { task, subtask, types } from "hardhat/config";
import { localSourceNameToPath } from "hardhat/utils/source-names";

import { CircomZKit, CircuitInfo, CircuitZKit } from "@solarity/zkit";

import {
  TASK_GENERATE_VERIFIERS,
  TASK_CIRCUITS_COMPILE,
  TASK_ZKIT_GET_CIRCOM_ZKIT,
  TASK_ZKIT_GET_FILTERED_CIRCUITS_INFO,
  TASK_ZKIT_FILTER_CIRCUITS_INFO,
  TASK_GENERATE_VERIFIERS_VERIFY_ARTIFACTS_EXISTENCE,
} from "./task-names";

import { getArtifactsDirFullPath } from "../utils/path-utils";
import { NonExistentCircuitArtifactsError } from "../errors";

subtask(TASK_GENERATE_VERIFIERS_VERIFY_ARTIFACTS_EXISTENCE)
  .addOptionalParam("artifactsDir", undefined, undefined, types.string)
  .addParam("circuitsInfo", undefined, undefined, types.any)
  .setAction(
    async (
      { artifactsDir, circuitsInfo }: { artifactsDir: string; circuitsInfo: CircuitInfo[] },
      { config },
    ): Promise<string[]> => {
      const artifactsRoot = getArtifactsDirFullPath(
        config.paths.root,
        artifactsDir ?? config.zkit.compilationSettings.artifactsDir,
      );
      const circuitsId: string[] = [];

      circuitsInfo.forEach((info) => {
        const circuitSourceName = localSourceNameToPath(config.zkit.circuitsDir, info.path);

        if (info.id == null) {
          throw new Error(circuitSourceName);
        }

        if (!fsExtra.existsSync(localSourceNameToPath(artifactsRoot, info.path))) {
          throw new NonExistentCircuitArtifactsError(info.id);
        }

        circuitsId.push(info.id);
      });

      return circuitsId;
    },
  );

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

      const circomZKit: CircomZKit = await run(TASK_ZKIT_GET_CIRCOM_ZKIT, { artifactsDir, verifiersDir });

      const filteredCompiledCircuitsInfo = await run(TASK_ZKIT_GET_FILTERED_CIRCUITS_INFO, {
        circomZKit,
        filterSettings: config.zkit.compilationSettings,
        withMainComponent: true,
      });

      const circuitsInfo: CircuitInfo[] = await run(TASK_ZKIT_FILTER_CIRCUITS_INFO, {
        circuitsInfo: filteredCompiledCircuitsInfo,
        filterSettings: config.zkit.verifiersSettings,
      });

      const circuitsId: string[] = await run(TASK_GENERATE_VERIFIERS_VERIFY_ARTIFACTS_EXISTENCE, {
        artifactsDir,
        circuitsInfo,
      });

      await Promise.all(
        circuitsId.map((id: string) => {
          const circuit: CircuitZKit = circomZKit.getCircuit(id);

          return circuit.createVerifier();
        }),
      );
    },
  );
