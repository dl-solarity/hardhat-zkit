import path from "path";

import { lazyObject } from "hardhat/plugins";
import { extendConfig, extendEnvironment, task, subtask, types } from "hardhat/config";
import { ActionType, HardhatRuntimeEnvironment } from "hardhat/types";
import { TASK_COMPILE_SOLIDITY_READ_FILE as TASK_READ_FILE } from "hardhat/builtin-tasks/task-names";

import { CircuitZKit } from "@solarity/zkit";

import "./type-extensions";

import { TASK_ZKIT_GET_CIRCUIT_ZKIT, TASK_CIRCUITS_COMPILE, TASK_GENERATE_VERIFIERS } from "./task-names";

import { zkitConfigExtender } from "./config/config";

import { CircomCircuitsCache, createCircuitsCache } from "./cache/CircomCircuitsCache";
import { CompilationFilesManager, CompilationProcessor } from "./compile/core";

import { CompileTaskConfig, GenerateVerifiersTaskConfig, GetCircuitZKitConfig } from "./types/tasks";
import { CompileFlags, ResolvedFileWithDependencies } from "./types/compile";

import { getAllDirsMatchingSync, getNormalizedFullPath } from "./utils/path-utils";
import { CIRCOM_CIRCUITS_CACHE_FILENAME } from "./constants";
import { HardhatZKitError } from "./errors";

extendConfig(zkitConfigExtender);

extendEnvironment((hre) => {
  hre.zkit = lazyObject(() => {
    return {
      getCircuit: async (circuitName: string): Promise<CircuitZKit> => {
        return hre.run(TASK_ZKIT_GET_CIRCUIT_ZKIT, { circuitName });
      },
    };
  });
});

const compile: ActionType<CompileTaskConfig> = async (taskArgs: CompileTaskConfig, env: HardhatRuntimeEnvironment) => {
  const circuitsCacheFullPath: string = getNormalizedFullPath(env.config.paths.cache, CIRCOM_CIRCUITS_CACHE_FILENAME);

  await createCircuitsCache(circuitsCacheFullPath);

  const compilationFilesManager: CompilationFilesManager = new CompilationFilesManager(
    {
      artifactsDir: taskArgs.artifactsDir,
      ptauDir: taskArgs.ptauDir,
      force: taskArgs.force,
      ptauDownload: taskArgs.ptauDownload ?? true,
    },
    (absolutePath: string) => env.run(TASK_READ_FILE, { absolutePath }),
    env.config,
  );

  const compileFlags: CompileFlags = {
    r1cs: true,
    wasm: true,
    sym: taskArgs.sym || env.config.zkit.compilationSettings.sym,
    json: taskArgs.json || env.config.zkit.compilationSettings.json,
    c: taskArgs.c || env.config.zkit.compilationSettings.c,
  };

  const resolvedFilesWithDependencies: ResolvedFileWithDependencies[] =
    await compilationFilesManager.getResolvedFilesToCompile(compileFlags, taskArgs.force);

  const compilationProcessor: CompilationProcessor = new CompilationProcessor(
    compilationFilesManager.getCircuitsDirFullPath(),
    compilationFilesManager.getArtifactsDirFullPath(),
    compilationFilesManager.getPtauDirFullPath(),
    {
      quiet: taskArgs.quiet || env.config.zkit.compilationSettings.quiet,
      compilerVersion: "0.2.18",
      compileFlags,
    },
    env.config,
  );

  await compilationProcessor.compile(resolvedFilesWithDependencies.map((file) => file.resolvedFile));

  for (const resolvedFileWithDependencies of resolvedFilesWithDependencies) {
    for (const file of [resolvedFileWithDependencies.resolvedFile, ...resolvedFileWithDependencies.dependencies]) {
      CircomCircuitsCache!.addFile(file.absolutePath, {
        lastModificationDate: file.lastModificationDate.valueOf(),
        contentHash: file.contentHash,
        sourceName: file.sourceName,
        compileFlags,
        imports: file.content.imports,
        versionPragmas: file.content.versionPragmas,
      });
    }
  }

  await CircomCircuitsCache!.writeToFile(circuitsCacheFullPath);
};

const generateVerifiers: ActionType<GenerateVerifiersTaskConfig> = async (
  taskArgs: GenerateVerifiersTaskConfig,
  env: HardhatRuntimeEnvironment,
) => {
  if (!taskArgs.noCompile) {
    await env.run(TASK_CIRCUITS_COMPILE, { artifactsDir: taskArgs.artifactsDir, quiet: taskArgs.quiet });
  }

  const artifactsDirFullPath = getNormalizedFullPath(
    env.config.paths.root,
    taskArgs.artifactsDir ?? env.config.zkit.compilationSettings.artifactsDir,
  );
  const verifiersDirFullPath = getNormalizedFullPath(
    env.config.paths.root,
    taskArgs.verifiersDir ?? env.config.zkit.verifiersDir,
  );

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
};

const getCircuitZKit: ActionType<GetCircuitZKitConfig> = async (
  taskArgs: GetCircuitZKitConfig,
  env: HardhatRuntimeEnvironment,
): Promise<CircuitZKit> => {
  const artifactsDirFullPath = getNormalizedFullPath(
    env.config.paths.root,
    taskArgs.artifactsDir ?? env.config.zkit.compilationSettings.artifactsDir,
  );

  const foundPaths: string[] = getAllDirsMatchingSync(artifactsDirFullPath, (fullPath: string): boolean => {
    return fullPath.endsWith(`${taskArgs.circuitName}.circom`);
  });

  if (foundPaths.length === 0) {
    throw new HardhatZKitError(
      `The artifacts for '${taskArgs.circuitName}' circuit do not exist. Please compile circuits`,
    );
  }

  if (foundPaths.length > 1) {
    throw new HardhatZKitError(
      `Invalid circuit name ${taskArgs.circuitName}. Multiple artifacts found along ${foundPaths} paths`,
    );
  }

  const verifiersDirFullPath = getNormalizedFullPath(
    env.config.paths.root,
    taskArgs.verifiersDir ?? env.config.zkit.verifiersDir,
  );

  return new CircuitZKit({
    circuitName: taskArgs.circuitName,
    circuitArtifactsPath: foundPaths[0],
    verifierDirPath: verifiersDirFullPath,
    templateType: taskArgs.verifierTemplateType ?? "groth16",
  });
};

task(TASK_CIRCUITS_COMPILE, "Compile circuits")
  .addOptionalParam("artifactsDir", "The circuits artifacts directory path.", undefined, types.string)
  .addOptionalParam("ptauDir", "The ptau files directory path.", undefined, types.string)
  .addOptionalParam("ptauDownload", "The ptau download flag parameter.", true, types.boolean)
  .addFlag("force", "The force flag.")
  .addFlag("sym", "The sym flag.")
  .addFlag("json", "The json flag.")
  .addFlag("c", "The c flag.")
  .addFlag("quiet", "The quiet flag.")
  .setAction(compile);

task(TASK_GENERATE_VERIFIERS, "Generate verifiers for circuits")
  .addOptionalParam("artifactsDir", "The circuits artifacts directory path.", undefined, types.string)
  .addOptionalParam("verifiersDir", "The generated verifiers directory path.", undefined, types.string)
  .addFlag("noCompile", "No compile flag")
  .addFlag("quiet", "The quiet flag.")
  .setAction(generateVerifiers);

subtask(TASK_ZKIT_GET_CIRCUIT_ZKIT)
  .addOptionalParam("artifactsDir", undefined, undefined, types.string)
  .addOptionalParam("verifiersDir", undefined, undefined, types.string)
  .addOptionalParam("verifierTemplateType", undefined, undefined, types.any)
  .addParam("circuitName", undefined, undefined, types.string)
  .setAction(getCircuitZKit);
