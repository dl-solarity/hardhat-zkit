import fsExtra from "fs-extra";

import { task, subtask, types } from "hardhat/config";
import { TASK_COMPILE_SOLIDITY_READ_FILE } from "hardhat/builtin-tasks/task-names";
import { localPathToSourceName } from "hardhat/utils/source-names";
import { getAllFilesMatching } from "hardhat/internal/util/fs-utils";

import { CircomZKit, CircuitInfo, CircuitZKit, CompileOptions } from "@solarity/zkit";

import {
  TASK_CIRCUITS_COMPILE,
  TASK_CIRCUITS_COMPILE_GET_SOURCE_PATHS,
  TASK_CIRCUITS_COMPILE_GET_SOURCE_NAMES,
  TASK_CIRCUITS_COMPILE_FILTER_SOURCE_NAMES,
  TASK_ZKIT_GET_CIRCOM_ZKIT,
  TASK_CIRCUITS_COMPILE_GET_DEPENDENCY_GRAPH,
  TASK_CIRCUITS_COMPILE_GET_REMAPPINGS,
  TASK_CIRCUITS_COMPILE_FILTER_RESOLVED_FILES_TO_COMPILE,
  TASK_CIRCUITS_COMPILE_COMPILE_CIRCUITS,
  TASK_ZKIT_GET_FILTERED_CIRCUITS_INFO,
} from "./task-names";

import { getArtifactsDirFullPath, getCircuitsDirFullPath, getCircomFilesCachePath } from "../utils/path-utils";

import { ResolvedFileWithDependencies } from "../types/compile";
import { Parser } from "../internal/Parser";
import { ResolvedFile, Resolver } from "../internal/Resolver";
import { DependencyGraph } from "../internal/DependencyGraph";
import { CircomCircuitsCache } from "../internal/CircomCircuitsCache";
import { DuplicateCircuitsNameError, MultipleCircuitsInfoError, ZeroCircuitsInfoError } from "../errors";

subtask(TASK_CIRCUITS_COMPILE_GET_SOURCE_PATHS)
  .addParam("sourcePath", undefined, undefined, types.string)
  .setAction(async ({ sourcePath }: { sourcePath: string }): Promise<string[]> => {
    return getAllFilesMatching(sourcePath, (f) => f.endsWith(".circom"));
  });

subtask(TASK_CIRCUITS_COMPILE_GET_SOURCE_NAMES)
  .addParam("projectRoot", undefined, undefined, types.string)
  .addParam("sourcePaths", undefined, undefined, types.any)
  .setAction(
    async ({ projectRoot, sourcePaths }: { projectRoot: string; sourcePaths: string[] }): Promise<string[]> => {
      return Promise.all(sourcePaths.map((p) => localPathToSourceName(projectRoot, p)));
    },
  );

subtask(TASK_CIRCUITS_COMPILE_GET_REMAPPINGS).setAction(async (): Promise<Record<string, string>> => {
  return {};
});

subtask(TASK_CIRCUITS_COMPILE_GET_DEPENDENCY_GRAPH)
  .addOptionalParam("rootPath", undefined, undefined, types.string)
  .addParam("sourceNames", undefined, undefined, types.any)
  .addOptionalParam("circuitFilesCache", undefined, undefined, types.any)
  .setAction(
    async (
      {
        rootPath,
        sourceNames,
        circuitFilesCache,
      }: {
        rootPath?: string;
        sourceNames: string[];
        circuitFilesCache?: CircomCircuitsCache;
      },
      { config, run },
    ): Promise<DependencyGraph> => {
      const parser = new Parser(circuitFilesCache);
      const remappings = await run(TASK_CIRCUITS_COMPILE_GET_REMAPPINGS);
      const resolver = new Resolver(rootPath ?? config.paths.root, parser, remappings, (absolutePath: string) =>
        run(TASK_COMPILE_SOLIDITY_READ_FILE, { absolutePath }),
      );

      const resolvedFiles = await Promise.all(sourceNames.map((sn) => resolver.resolveSourceName(sn)));

      return DependencyGraph.createFromResolvedFiles(resolver, resolvedFiles);
    },
  );

subtask(TASK_CIRCUITS_COMPILE_FILTER_SOURCE_NAMES)
  .addParam("sourceNames", undefined, undefined, types.any)
  .addParam("filteredCircuitsInfo", undefined, undefined, types.any)
  .setAction(
    async ({
      sourceNames,
      filteredCircuitsInfo,
    }: {
      sourceNames: string[];
      filteredCircuitsInfo: CircuitInfo[];
    }): Promise<string[]> => {
      const filteredSourceNames: string[] = [];

      filteredCircuitsInfo.forEach((circuitInfo: CircuitInfo) => {
        filteredSourceNames.push(
          ...sourceNames.filter((sourceName: string) => {
            return sourceName.includes(circuitInfo.path);
          }),
        );
      });

      return filteredSourceNames;
    },
  );

subtask(TASK_CIRCUITS_COMPILE_FILTER_RESOLVED_FILES_TO_COMPILE)
  .addParam("resolvedFilesToCompile", undefined, undefined, types.any)
  .addParam("dependencyGraph", undefined, undefined, types.any)
  .addParam("circuitFilesCache", undefined, undefined, types.any)
  .addFlag("force", undefined)
  .setAction(
    async ({
      resolvedFilesToCompile,
      dependencyGraph,
      circuitFilesCache,
      force,
    }: {
      resolvedFilesToCompile: ResolvedFile[];
      dependencyGraph: DependencyGraph;
      circuitFilesCache: CircomCircuitsCache;
      force: boolean;
    }): Promise<ResolvedFileWithDependencies[]> => {
      const resolvedFilesWithDependecies: ResolvedFileWithDependencies[] = [];

      for (const file of resolvedFilesToCompile) {
        resolvedFilesWithDependecies.push({
          resolvedFile: file,
          dependencies: dependencyGraph.getTransitiveDependencies(file).map((dep) => dep.dependency),
        });
      }

      if (!force) {
        return resolvedFilesWithDependecies.filter((file) => needsCompilation(file, circuitFilesCache));
      }

      return resolvedFilesWithDependecies;
    },
  );

subtask(TASK_CIRCUITS_COMPILE_COMPILE_CIRCUITS)
  .addParam("resolvedFilesToCompile", undefined, undefined, types.any)
  .addParam("filteredCircuitsInfo", undefined, undefined, types.any)
  .addParam("circomZKit", undefined, undefined, types.any)
  .addParam("compileOptions", undefined, undefined, types.any)
  .setAction(
    async ({
      resolvedFilesToCompile,
      filteredCircuitsInfo,
      circomZKit,
      compileOptions,
    }: {
      resolvedFilesToCompile: ResolvedFile[];
      filteredCircuitsInfo: CircuitInfo[];
      circomZKit: CircomZKit;
      compileOptions: CompileOptions;
    }) => {
      for (const file of resolvedFilesToCompile) {
        const foundCircuitsInfo: CircuitInfo[] = filteredCircuitsInfo.filter((info) =>
          file.sourceName.includes(info.path),
        );

        if (foundCircuitsInfo.length > 1) {
          throw new MultipleCircuitsInfoError(file.sourceName, foundCircuitsInfo);
        }

        if (foundCircuitsInfo.length === 0) {
          throw new ZeroCircuitsInfoError(file.sourceName);
        }

        if (foundCircuitsInfo[0].id === null) {
          throw new DuplicateCircuitsNameError(file.sourceName);
        }

        const circuitToCompile: CircuitZKit = circomZKit.getCircuit(foundCircuitsInfo[0].id);

        await circuitToCompile.compile(compileOptions);
      }
    },
  );

task(TASK_CIRCUITS_COMPILE, "Compile circuits")
  .addOptionalParam("artifactsDir", "The circuits artifacts directory path.", undefined, types.string)
  .addFlag("force", "The force flag.")
  .addFlag("sym", "The sym flag.")
  .addFlag("json", "The json flag.")
  .addFlag("c", "The c flag.")
  .addFlag("quiet", "The quiet flag.")
  .setAction(
    async (
      {
        artifactsDir,
        force,
        sym,
        json,
        c,
        quiet,
      }: { artifactsDir?: string; force: boolean; sym: boolean; json: boolean; c: boolean; quiet: boolean },
      { config, run },
    ) => {
      const projectRoot = config.paths.root;
      const circuitsRoot: string = getCircuitsDirFullPath(projectRoot, config.zkit.circuitsDir);

      const sourcePaths: string[] = await run(TASK_CIRCUITS_COMPILE_GET_SOURCE_PATHS, { sourcePath: circuitsRoot });
      const sourceNames: string[] = await run(TASK_CIRCUITS_COMPILE_GET_SOURCE_NAMES, {
        projectRoot,
        sourcePaths,
      });

      const circomZKit: CircomZKit = await run(TASK_ZKIT_GET_CIRCOM_ZKIT, { artifactsDir });

      const filteredCircuitsInfo: CircuitInfo[] = await run(TASK_ZKIT_GET_FILTERED_CIRCUITS_INFO, {
        circomZKit,
        circuitsDirFullPath: circuitsRoot,
        filterSettings: config.zkit.compilationSettings,
        withMainComponent: true,
      });

      const filteredSourceNames: string[] = await run(TASK_CIRCUITS_COMPILE_FILTER_SOURCE_NAMES, {
        sourceNames,
        filteredCircuitsInfo,
      });

      const circuitFilesCachePath = getCircomFilesCachePath(config.paths);
      let circuitFilesCache = await CircomCircuitsCache.readFromFile(circuitFilesCachePath);

      const dependencyGraph: DependencyGraph = await run(TASK_CIRCUITS_COMPILE_GET_DEPENDENCY_GRAPH, {
        projectRoot,
        sourceNames: filteredSourceNames,
        circuitFilesCache,
      });

      const resolvedFiles: ResolvedFile[] = dependencyGraph.getResolvedFiles();
      const resolvedFilesToCompile: ResolvedFile[] = resolvedFiles.filter((file) =>
        filteredSourceNames.includes(file.sourceName),
      );

      const artifactsDirFullPath = getArtifactsDirFullPath(
        projectRoot,
        artifactsDir ?? config.zkit.compilationSettings.artifactsDir,
      );
      circuitFilesCache = await invalidateCacheMissingArtifacts(
        circuitsRoot,
        artifactsDirFullPath,
        circuitFilesCache,
        resolvedFilesToCompile,
      );

      const resolvedFilesWithDependencies: ResolvedFileWithDependencies[] = await run(
        TASK_CIRCUITS_COMPILE_FILTER_RESOLVED_FILES_TO_COMPILE,
        {
          resolvedFilesToCompile,
          dependencyGraph,
          circuitFilesCache,
          force,
        },
      );

      const filteredFilesToCompile: ResolvedFile[] = resolvedFilesWithDependencies.map((file) => file.resolvedFile);

      await run(TASK_CIRCUITS_COMPILE_COMPILE_CIRCUITS, {
        resolvedFilesToCompile: filteredFilesToCompile,
        filteredCircuitsInfo,
        circomZKit,
        compileOptions: {
          sym,
          json,
          c,
          quiet,
        },
      });

      for (const resolvedFileWithDependecies of resolvedFilesWithDependencies) {
        for (const file of [resolvedFileWithDependecies.resolvedFile, ...resolvedFileWithDependecies.dependencies]) {
          circuitFilesCache.addFile(file.absolutePath, {
            lastModificationDate: file.lastModificationDate.valueOf(),
            contentHash: file.contentHash,
            sourceName: file.sourceName,
            imports: file.content.imports,
            versionPragmas: file.content.versionPragmas,
          });
        }
      }

      await circuitFilesCache.writeToFile(circuitFilesCachePath);
    },
  );

async function invalidateCacheMissingArtifacts(
  circuitsDirFullPath: string,
  artifactsDirFullPath: string,
  solidityFilesCache: CircomCircuitsCache,
  resolvedFiles: ResolvedFile[],
): Promise<CircomCircuitsCache> {
  for (const file of resolvedFiles) {
    const cacheEntry = solidityFilesCache.getEntry(file.absolutePath);

    if (cacheEntry === undefined) {
      continue;
    }

    if (!fsExtra.existsSync(file.absolutePath.replace(circuitsDirFullPath, artifactsDirFullPath))) {
      solidityFilesCache.removeEntry(file.absolutePath);
    }
  }

  return solidityFilesCache;
}

function needsCompilation(
  resolvedFilesWithDependecies: ResolvedFileWithDependencies,
  cache: CircomCircuitsCache,
): boolean {
  for (const file of [resolvedFilesWithDependecies.resolvedFile, ...resolvedFilesWithDependecies.dependencies]) {
    const hasChanged = cache.hasFileChanged(file.absolutePath, file.contentHash);

    if (hasChanged) {
      return true;
    }
  }

  return false;
}
