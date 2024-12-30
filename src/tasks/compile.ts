import { ActionType, HardhatRuntimeEnvironment } from "hardhat/types";
import { TASK_COMPILE_SOLIDITY_READ_FILE as TASK_READ_FILE } from "hardhat/builtin-tasks/task-names";

import { CircuitsCompileCache, createCircuitsCompileCache } from "../cache";
import { CompilationProcessor, CompilationFilesResolver, TypeGenerationProcessor, isVersionValid } from "../core";

import { HardhatZKitError } from "../errors";
import { Reporter, createReporter } from "../reporter";
import { CIRCUITS_COMPILE_CACHE_FILENAME } from "../constants";
import { getNormalizedFullPath } from "../utils";

import { CompileTaskConfig } from "../types/tasks";
import { CompileFlags, CircomResolvedFileInfo } from "../types/core";

export const compile: ActionType<CompileTaskConfig> = async (
  taskArgs: CompileTaskConfig,
  env: HardhatRuntimeEnvironment,
) => {
  const circuitsCompileCacheFullPath: string = getNormalizedFullPath(
    env.config.paths.cache,
    CIRCUITS_COMPILE_CACHE_FILENAME,
  );

  createReporter(taskArgs.quiet || env.config.zkit.quiet);
  await createCircuitsCompileCache(circuitsCompileCacheFullPath);

  const compilationFileResolver: CompilationFilesResolver = new CompilationFilesResolver(
    (absolutePath: string) => env.run(TASK_READ_FILE, { absolutePath }),
    env.zkit.circuitArtifacts,
    env.config,
  );

  const optimization = taskArgs.optimization || env.config.zkit.compilationSettings.optimization;

  // Flags for specifying the necessary configurations during the setup process.
  // R1CS, Wasm, and Sym flags are mandatory
  const compileFlags: CompileFlags = {
    r1cs: true,
    wasm: true,
    sym: true,
    json: taskArgs.json || env.config.zkit.compilationSettings.json,
    c: taskArgs.c || env.config.zkit.compilationSettings.c,
    O0: optimization === "O0",
    O1: optimization === "O1",
    O2: optimization === "O2",
  };

  Reporter!.reportCircuitFilesResolvingProcessHeader();
  Reporter!.verboseLog("index", "Compile flags: %O", [compileFlags]);

  const resolvedFilesInfo: CircomResolvedFileInfo[] = await compilationFileResolver.getResolvedFilesToCompile(
    compileFlags,
    taskArgs.force,
  );

  const configCompilerVersion = env.config.zkit.compilerVersion;

  if (configCompilerVersion && !isVersionValid(configCompilerVersion)) {
    throw new HardhatZKitError(`Invalid Circom compiler version ${configCompilerVersion} specified in the config`);
  }

  if (resolvedFilesInfo.length > 0) {
    const compilationProcessor: CompilationProcessor = new CompilationProcessor(
      {
        compileFlags,
        quiet: taskArgs.quiet || env.config.zkit.quiet,
      },
      env.zkit.circuitArtifacts,
      env,
    );

    await compilationProcessor.compile(resolvedFilesInfo);

    updateCache(compileFlags, resolvedFilesInfo);
  } else {
    Reporter!.reportNothingToCompile();
  }

  await new TypeGenerationProcessor(env).generateAllTypes();

  await CircuitsCompileCache!.writeToFile(circuitsCompileCacheFullPath);
};

function updateCache(compileFlags: CompileFlags, resolvedFilesInfo: CircomResolvedFileInfo[]) {
  for (const fileInfo of resolvedFilesInfo) {
    for (const file of [fileInfo.resolvedFile, ...fileInfo.dependencies]) {
      CircuitsCompileCache!.addFile(file.absolutePath, {
        lastModificationDate: file.lastModificationDate.valueOf(),
        contentHash: file.contentHash,
        sourceName: file.sourceName,
        compileFlags,
        fileData: file.fileData,
      });
    }
  }
}
