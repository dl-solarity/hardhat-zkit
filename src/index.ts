import { lazyObject } from "hardhat/plugins";
import { extendConfig, extendEnvironment, task, types } from "hardhat/config";
import { ActionType, HardhatRuntimeEnvironment } from "hardhat/types";
import { TASK_COMPILE_SOLIDITY_READ_FILE } from "hardhat/builtin-tasks/task-names";

import { TASK_ZKIT_GET_CIRCUIT_ZKIT, TASK_CIRCUITS_COMPILE } from "./tasks/task-names";

import "./tasks/zkit";
import "./type-extensions";

import { zkitConfigExtender } from "./config/config";

import { CIRCOM_CIRCUITS_CACHE_FILENAME } from "./internal/constants";
import { CircomCircuitsCache } from "./internal/CircomCircuitsCache";
import { CompilationFilesManager } from "./internal/CompilationFilesManager";
import { CompilationProcessor } from "./internal/CompilationProcessor";

import { CompileTaskConfig } from "./types/compile";
import { CompileFlags } from "./types/internal/circom-compiler";
import { ResolvedFileWithDependencies } from "./types/internal/compilation-files-manager";

import { getNormalizedFullPath } from "./utils/path-utils";

extendConfig(zkitConfigExtender);

extendEnvironment((hre) => {
  hre.zkit = lazyObject(() => {
    return {
      getCircuit: async (circuitName: string) => {
        return await hre.run(TASK_ZKIT_GET_CIRCUIT_ZKIT, { circuitName });
      },
    };
  });
});

const compile: ActionType<CompileTaskConfig> = async (taskArgs: CompileTaskConfig, env: HardhatRuntimeEnvironment) => {
  const circuitsCacheFullPath: string = getNormalizedFullPath(env.config.paths.cache, CIRCOM_CIRCUITS_CACHE_FILENAME);

  const circuitFilesCache: CircomCircuitsCache = await CircomCircuitsCache.readFromFile(circuitsCacheFullPath);

  const compilationFilesManager: CompilationFilesManager = new CompilationFilesManager(
    {
      artifactsDir: taskArgs.artifactsDir,
      ptauDir: taskArgs.ptauDir,
      force: taskArgs.force,
      ptauDownload: taskArgs.ptauDownload ?? true,
    },
    (absolutePath: string) => env.run(TASK_COMPILE_SOLIDITY_READ_FILE, { absolutePath }),
    circuitFilesCache,
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
      circuitFilesCache.addFile(file.absolutePath, {
        lastModificationDate: file.lastModificationDate.valueOf(),
        contentHash: file.contentHash,
        sourceName: file.sourceName,
        compileFlags,
        imports: file.content.imports,
        versionPragmas: file.content.versionPragmas,
      });
    }
  }

  await circuitFilesCache.writeToFile(circuitsCacheFullPath);
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
