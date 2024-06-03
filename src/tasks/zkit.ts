import path from "path";
import * as fs from "fs";

import { subtask, types } from "hardhat/config";
import { localSourceNameToPath } from "hardhat/utils/source-names";

import { CircomZKit, CircuitInfo, CircuitZKit } from "@solarity/zkit";

import {
  TASK_ZKIT_FILTER_CIRCUITS_INFO,
  TASK_ZKIT_GET_CIRCOM_ZKIT,
  TASK_ZKIT_GET_CIRCUITS_INFO,
  TASK_ZKIT_GET_FILTERED_CIRCUITS_INFO,
  TASK_ZKIT_GET_CIRCUIT_ZKIT,
} from "./task-names";
import { NonExistentCircuitError, NonExistentFile } from "../errors";
import { getCircuitsDirFullPath } from "../utils/path-utils";
import { FileFilterSettings } from "../types/zkit-config";
import { MAIN_COMPONENT_REG_EXP } from "../internal/constants";

subtask(TASK_ZKIT_GET_CIRCOM_ZKIT)
  .addOptionalParam("artifactsDir", undefined, undefined, types.string)
  .addOptionalParam("verifiersDir", undefined, undefined, types.string)
  .setAction(
    async (
      { artifactsDir, verifiersDir }: { artifactsDir?: string; verifiersDir?: string },
      { config },
    ): Promise<CircomZKit> => {
      return new CircomZKit({
        circuitsDir: config.zkit.circuitsDir,
        artifactsDir: artifactsDir ?? config.zkit.compilationSettings.artifactsDir,
        verifiersDir: verifiersDir ?? config.zkit.verifiersSettings.verifiersDir,
        ptauDir: config.zkit.ptauDir,
        allowDownload: config.zkit.allowDownload,
      });
    },
  );

subtask(TASK_ZKIT_GET_CIRCUIT_ZKIT)
  .addOptionalParam("circomZKit", undefined, undefined, types.any)
  .addOptionalParam("circuitsDirFullPath", undefined, undefined, types.string)
  .addParam("circuitName", undefined, undefined, types.string)
  .setAction(
    async (
      {
        circomZKit,
        circuitsDirFullPath,
        circuitName,
      }: { circomZKit?: CircomZKit; circuitsDirFullPath?: string; circuitName: string },
      { run },
    ): Promise<CircuitZKit> => {
      const zkit: CircomZKit = circomZKit ?? (await run(TASK_ZKIT_GET_CIRCOM_ZKIT));

      const circuitsInfo: CircuitInfo[] = await run(TASK_ZKIT_GET_CIRCUITS_INFO, {
        circomZKit: zkit,
        circuitsDirFullPath,
        withMainComponent: true,
      });

      const circuitInfo = circuitsInfo.find((info: CircuitInfo) => {
        return info.id === circuitName;
      });

      if (!circuitInfo) {
        throw new NonExistentCircuitError(circuitName);
      }

      return zkit.getCircuit(circuitName);
    },
  );

subtask(TASK_ZKIT_GET_CIRCUITS_INFO)
  .addOptionalParam("circomZKit", undefined, undefined, types.any)
  .addOptionalParam("circuitsDirFullPath", undefined, undefined, types.string)
  .addFlag("withMainComponent", undefined)
  .setAction(
    async (
      {
        circomZKit,
        circuitsDirFullPath,
        withMainComponent,
      }: { circomZKit?: CircomZKit; circuitsDirFullPath?: string; withMainComponent: boolean },
      { config, run },
    ): Promise<CircuitInfo[]> => {
      const zkit: CircomZKit = circomZKit ?? (await run(TASK_ZKIT_GET_CIRCOM_ZKIT));

      let circuitsInfo: CircuitInfo[] = zkit.getCircuits();

      if (withMainComponent) {
        const fullPath = circuitsDirFullPath ?? getCircuitsDirFullPath(config.paths.root, config.zkit.circuitsDir);

        circuitsInfo = circuitsInfo.filter((circuitInfo: CircuitInfo) => {
          return hasMainComponent(localSourceNameToPath(fullPath, circuitInfo.path));
        });
      }

      return circuitsInfo;
    },
  );

subtask(TASK_ZKIT_FILTER_CIRCUITS_INFO)
  .addParam("circuitsInfo", undefined, undefined, types.any)
  .addParam("filterSettings", undefined, undefined, types.any)
  .setAction(
    async ({
      circuitsInfo,
      filterSettings,
    }: {
      circuitsInfo: CircuitInfo[];
      filterSettings: FileFilterSettings;
    }): Promise<CircuitInfo[]> => {
      return circuitsInfo.filter((circuitInfo: CircuitInfo) => {
        return (
          (filterSettings.onlyFiles.length == 0 || contains(filterSettings.onlyFiles, circuitInfo.path)) &&
          !contains(filterSettings.skipFiles, circuitInfo.path)
        );
      });
    },
  );

subtask(TASK_ZKIT_GET_FILTERED_CIRCUITS_INFO)
  .addOptionalParam("circomZKit", undefined, undefined, types.any)
  .addOptionalParam("circuitsDirFullPath", undefined, undefined, types.string)
  .addParam("filterSettings", undefined, undefined, types.any)
  .addFlag("withMainComponent", undefined)
  .setAction(
    async (
      {
        circomZKit,
        circuitsDirFullPath,
        filterSettings,
        withMainComponent,
      }: {
        circomZKit?: CircomZKit;
        circuitsDirFullPath?: string;
        filterSettings: FileFilterSettings;
        withMainComponent: boolean;
      },
      { run },
    ): Promise<CircuitInfo[]> => {
      const zkit: CircomZKit = circomZKit ?? (await run(TASK_ZKIT_GET_CIRCOM_ZKIT));
      const circuitsInfo: CircuitInfo[] = await run(TASK_ZKIT_GET_CIRCUITS_INFO, {
        circomZKit: zkit,
        circuitsDirFullPath: circuitsDirFullPath,
        withMainComponent: withMainComponent,
      });

      return await run(TASK_ZKIT_FILTER_CIRCUITS_INFO, {
        circuitsInfo: circuitsInfo,
        filterSettings: filterSettings,
      });
    },
  );

function hasMainComponent(circuitSourcePath: string): boolean {
  if (!fs.existsSync(circuitSourcePath)) {
    throw new NonExistentFile(circuitSourcePath);
  }

  const circuitFile: string = fs.readFileSync(circuitSourcePath, "utf-8");

  return new RegExp(MAIN_COMPONENT_REG_EXP).test(circuitFile);
}

function contains(pathList: string[], source: any) {
  const isSubPath = (parent: string, child: string) => {
    const parentTokens = parent.split(path.posix.sep).filter((i) => i.length);
    const childTokens = child.split(path.posix.sep).filter((i) => i.length);

    return parentTokens.every((t, i) => childTokens[i] === t);
  };

  return pathList.some((p: any) => isSubPath(p, source));
}
