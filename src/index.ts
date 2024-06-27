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
import { Reporter, createReporter } from "./reporter";

import { CompileTaskConfig, GenerateVerifiersTaskConfig, GetCircuitZKitConfig } from "./types/tasks";
import { CompileFlags, ResolvedFileWithDependencies } from "./types/compile";

import { getAllDirsMatchingSync, getNormalizedFullPath } from "./utils/path-utils";
import { CIRCOM_CIRCUITS_CACHE_FILENAME, COMPILER_VERSION } from "./constants";
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
  createReporter(taskArgs.quiet || env.config.zkit.quiet);

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

  Reporter!.reportCompilerVersion(COMPILER_VERSION);
  Reporter!.verboseLog("index", "Compile flags: %O", [compileFlags]);

  const resolvedFilesWithDependencies: ResolvedFileWithDependencies[] =
    await compilationFilesManager.getResolvedFilesToCompile(compileFlags, taskArgs.force);

  const compilationProcessor: CompilationProcessor = new CompilationProcessor(
    compilationFilesManager.getCircuitsDirFullPath(),
    compilationFilesManager.getArtifactsDirFullPath(),
    compilationFilesManager.getPtauDirFullPath(),
    {
      compilerVersion: COMPILER_VERSION,
      compileFlags,
    },
    env,
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
    await env.run(TASK_CIRCUITS_COMPILE, {
      artifactsDir: taskArgs.artifactsDir,
      quiet: taskArgs.quiet,
      force: taskArgs.force,
    });
  } else {
    createReporter(taskArgs.quiet || env.config.zkit.quiet);
  }

  const artifactsDirFullPath: string = getNormalizedFullPath(
    env.config.paths.root,
    taskArgs.artifactsDir ?? env.config.zkit.compilationSettings.artifactsDir,
  );
  const verifiersDirFullPath: string = getNormalizedFullPath(
    env.config.paths.root,
    taskArgs.verifiersDir ?? env.config.zkit.verifiersDir,
  );

  const artifactsDirArr: string[] = getAllDirsMatchingSync(artifactsDirFullPath, (f) => f.endsWith(".circom"));

  Reporter!.verboseLog("index", "Verifiers generation info: %o", [{ artifactsDirFullPath, verifiersDirFullPath }]);

  Reporter!.reportVerifiersGenerationHeader();

  for (const artifactDirPath of artifactsDirArr) {
    const circuitName: string = path.parse(artifactDirPath).name;
    const spinnerId: string | null = Reporter!.reportVerifierGenerationStartWithSpinner(circuitName);

    await new CircuitZKit({
      circuitName,
      circuitArtifactsPath: artifactDirPath,
      verifierDirPath: verifiersDirFullPath,
    }).createVerifier();

    Reporter!.reportVerifierGenerationResult(spinnerId, circuitName);
  }
};

const getCircuitZKit: ActionType<GetCircuitZKitConfig> = async (
  taskArgs: GetCircuitZKitConfig,
  env: HardhatRuntimeEnvironment,
): Promise<CircuitZKit> => {
  const artifactsDirFullPath: string = getNormalizedFullPath(
    env.config.paths.root,
    taskArgs.artifactsDir ?? env.config.zkit.compilationSettings.artifactsDir,
  );

  const foundPaths: string[] = getAllDirsMatchingSync(artifactsDirFullPath, (fullPath: string): boolean => {
    return fullPath.endsWith(`${taskArgs.circuitName}.circom`);
  });

  if (foundPaths.length === 0) {
    throw new HardhatZKitError(
      `The artifacts for '${taskArgs.circuitName}' circuit do not exist. Please compile the circuits.`,
    );
  }

  if (foundPaths.length > 1) {
    throw new HardhatZKitError(
      `Invalid circuit name ${taskArgs.circuitName}. Multiple artifacts found along ${foundPaths} paths.`,
    );
  }

  const verifiersDirFullPath: string = getNormalizedFullPath(
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

task(TASK_CIRCUITS_COMPILE, "Compile Circom circuits and generate all necessary artifacts")
  .addOptionalParam(
    "artifactsDir",
    "Relative path to the directory where compilation artifacts will be saved.",
    undefined,
    types.string,
  )
  .addOptionalParam(
    "ptauDir",
    "Absolute or relative path to the directory where Ptau files will be searched for.",
    undefined,
    types.string,
  )
  .addOptionalParam("ptauDownload", "Flag that indicates if Ptau files dowloading is allowed.", true, types.boolean)
  .addFlag("sym", "Outputs witness in sym file in the compilation artifacts directory.")
  .addFlag("json", "Outputs constraints in json file in the compilation artifacts directory.")
  .addFlag("c", "Enables the generation of cpp files in the compilation artifacts directory.")
  .addFlag("force", "Force compilation ignoring cache.")
  .addFlag("quiet", "Suppresses logs during the compilation process.")
  .setAction(compile);

task(TASK_GENERATE_VERIFIERS, "Generate Solidity verifier contracts for Circom circuits")
  .addOptionalParam(
    "artifactsDir",
    "Relative path to the directory with compilation artifacts.",
    undefined,
    types.string,
  )
  .addOptionalParam(
    "verifiersDir",
    "Relative path to the directory where the generated Solidity verifier contracts will be saved.",
    undefined,
    types.string,
  )
  .addFlag("noCompile", "Disable compilation before verifiers generation.")
  .addFlag("force", "Force compilation ignoring cache.")
  .addFlag("quiet", "Suppresses logs during the verifier generation process.")
  .setAction(generateVerifiers);

subtask(TASK_ZKIT_GET_CIRCUIT_ZKIT)
  .addOptionalParam("artifactsDir", undefined, undefined, types.string)
  .addOptionalParam("verifiersDir", undefined, undefined, types.string)
  .addOptionalParam("verifierTemplateType", undefined, undefined, types.any)
  .addParam("circuitName", undefined, undefined, types.string)
  .setAction(getCircuitZKit);
