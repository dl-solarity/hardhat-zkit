import { NewTaskActionFunction, NewTaskDefinition, TaskDefinition } from "hardhat/types/tasks";

import * as fs from "fs";

import { CompileTaskConfig } from "../types/tasks/index.js";
import { getNormalizedFullPath } from "../utils/path-utils.js";
import { CIRCUITS_COMPILE_CACHE_FILENAME } from "../constants.js";
import { createReporter, Reporter } from "../reporter/ReporterFacade.js";
import { CompilationFilesResolver } from "../core/compile/CompilationFilesResolver.js";
import { CompileFlags } from "../types/core/compiler/circom-compiler.js";
import { CircomResolvedFileInfo } from "../types/core/compile/compilation-files-resolver.js";
import { isVersionValid } from "../core/compiler/versioning.js";
import { HardhatZKitError } from "../errors.js";
import { CompilationProcessor } from "../core/compile/CompilationProcessor.js";
import { TypeGenerationProcessor } from "../core/index.js";
import { CircuitsCompileCache, createCircuitsCompileCache } from "../cache/CircuitsCompileCache.js";

const compileAction: NewTaskActionFunction<CompileTaskConfig> = async (taskArgs, hre) => {
  const circuitsCompileCacheFullPath: string = getNormalizedFullPath(
    hre.config.paths.cache,
    CIRCUITS_COMPILE_CACHE_FILENAME,
  );

  createReporter(taskArgs.quiet || hre.config.zkit.quiet);
  await createCircuitsCompileCache(circuitsCompileCacheFullPath);

  const compilationFileResolver: CompilationFilesResolver = new CompilationFilesResolver(
    (absolutePath: string) => fs.readFileSync(absolutePath).toString(),
    hre.zkit.circuitArtifacts,
    hre.config,
  );

  const optimization = taskArgs.optimization || hre.config.zkit.compilationSettings.optimization;

  // Flags for specifying the necessary configurations during the setup process.
  // R1CS, Wasm, and Sym flags are mandatory
  const compileFlags: CompileFlags = {
    r1cs: true,
    wasm: true,
    sym: true,
    json: taskArgs.json || hre.config.zkit.compilationSettings.json,
    c: taskArgs.c || hre.config.zkit.compilationSettings.c,
    O0: optimization === "O0",
    O1: optimization === "O1",
    O2: optimization === "O2",
  };

  Reporter!.reportCircuitFilesResolvingProcessHeader();
  Reporter!.verboseLog("index", "Compile flags: %O", [compileFlags]);

  const resolvedFilesInfo: CircomResolvedFileInfo[] = await compilationFileResolver.getResolvedFilesToCompile(
    compileFlags,
    taskArgs.force!,
  );

  const configCompilerVersion = hre.config.zkit.compilerVersion;

  if (configCompilerVersion && !isVersionValid(configCompilerVersion)) {
    throw new HardhatZKitError(`Invalid Circom compiler version ${configCompilerVersion} specified in the config`);
  }

  if (resolvedFilesInfo.length > 0) {
    const compilationProcessor: CompilationProcessor = new CompilationProcessor(
      {
        compileFlags,
        quiet: taskArgs.quiet || hre.config.zkit.quiet,
      },
      hre.zkit.circuitArtifacts,
      hre,
    );

    await compilationProcessor.compile(resolvedFilesInfo);

    updateCache(compileFlags, resolvedFilesInfo);
  } else {
    Reporter!.reportNothingToCompile();
  }

  await new TypeGenerationProcessor(hre).generateAllTypes();

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

export default compileAction;
