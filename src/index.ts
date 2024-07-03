import path from "path";
import fs from "fs";

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
import { CompileFlags, ResolvedFileInfo } from "./types/compile";

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

  const resolvedFilesInfo: ResolvedFileInfo[] = await compilationFilesManager.getResolvedFilesToCompile(
    compileFlags,
    taskArgs.force,
  );

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

  await compilationProcessor.compile(resolvedFilesInfo);

  for (const fileInfo of resolvedFilesInfo) {
    for (const file of [fileInfo.resolvedFile, ...fileInfo.dependencies]) {
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
    const r1csFileName: string | undefined = fs.readdirSync(artifactDirPath).find((dirEntry: string) => {
      return dirEntry.endsWith(".r1cs");
    });

    if (!r1csFileName) {
      throw new HardhatZKitError(
        `Failed to generate verifier for the ${artifactDirPath} artifacts. Please recompile circuits and try again.`,
      );
    }

    const circuitName: string = path.parse(r1csFileName).name;
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

  let sourceName: string | null = null;
  let circuitName = taskArgs.circuitName;

  if (circuitName.includes(":")) {
    const tokens: string[] = circuitName.split(":");

    if (tokens.length > 2) {
      throw new HardhatZKitError(`Invalid full circuit name ${circuitName}`);
    }

    sourceName = tokens[0];
    circuitName = tokens[1];
  }

  let foundPaths: string[] = [];

  if (!sourceName) {
    foundPaths = getAllDirsMatchingSync(artifactsDirFullPath, (fullPath: string): boolean => {
      return fs.existsSync(getNormalizedFullPath(fullPath, `${circuitName}.r1cs`));
    });
  } else {
    const circuitsDirFullPath: string = getNormalizedFullPath(env.config.paths.root, env.config.zkit.circuitsDir);
    const circuitArtifactsPath: string = getNormalizedFullPath(env.config.paths.root, sourceName).replace(
      circuitsDirFullPath,
      artifactsDirFullPath,
    );

    if (fs.existsSync(getNormalizedFullPath(circuitArtifactsPath, `${circuitName}.r1cs`))) {
      foundPaths.push(circuitArtifactsPath);
    }
  }

  if (foundPaths.length === 0) {
    throw new HardhatZKitError(`The artifacts for '${circuitName}' circuit do not exist. Please compile the circuits.`);
  }

  if (foundPaths.length > 1) {
    throw new HardhatZKitError(
      `Multiple artifacts are found for '${circuitName}' circuit. Please provide the full circuit name.`,
    );
  }

  const verifiersDirFullPath: string = getNormalizedFullPath(
    env.config.paths.root,
    taskArgs.verifiersDir ?? env.config.zkit.verifiersDir,
  );

  return new CircuitZKit({
    circuitName,
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
