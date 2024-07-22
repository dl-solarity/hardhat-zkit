import os from "os";
import path from "path";
import fs from "fs";

import { lazyObject } from "hardhat/plugins";
import { extendConfig, extendEnvironment, task, subtask, types } from "hardhat/config";
import { ActionType, HardhatRuntimeEnvironment, RunSuperFunction } from "hardhat/types";
import { TASK_CLEAN, TASK_COMPILE_SOLIDITY_READ_FILE as TASK_READ_FILE } from "hardhat/builtin-tasks/task-names";
import { willRunWithTypescript } from "hardhat/internal/core/typescript-support";

import { CircuitZKit, CircuitZKitConfig } from "@solarity/zkit";
import { CircuitTypesGenerator } from "@solarity/zktype";

import "./type-extensions";

import {
  TASK_CIRCUITS_COMPILE,
  TASK_CIRCUITS_MAKE,
  TASK_CIRCUITS_SETUP,
  TASK_GENERATE_VERIFIERS,
  TASK_ZKIT_GET_CIRCUIT_ZKIT,
} from "./task-names";

import { zkitConfigExtender } from "./config/config";

import { CircuitsCompileCache, createCircuitsCompileCache } from "./cache/CircuitsCompileCache";

import { CircomCompilerFactory } from "./compile/core";
import { CompilationProcessor } from "./compile/core/CompilationProcessor";
import { Reporter, createReporter } from "./reporter";

import {
  CompileShallowTaskConfig,
  CompileTaskConfig,
  GenerateVerifiersTaskConfig,
  GetCircuitZKitConfig,
  SetupTaskConfig,
} from "./types/tasks";
import { CompileFlags } from "./types/compile";

import { getNormalizedFullPath } from "./utils/path-utils";
import { CIRCUITS_COMPILE_CACHE_FILENAME, CIRCUITS_SETUP_CACHE_FILENAME, COMPILER_VERSION } from "./constants";
import { CircuitArtifacts } from "./CircuitArtifacts";
import { CompilationFilesResolver } from "./compile/core/CompilationFilesResolver";
import { TypeGenerationProcessor } from "./compile/core/TypeGenerationProcessor";
import { ResolvedFileInfo } from "./types/compile/core/compilation-files-resolver";
import { SetupProcessor } from "./setup/SetupProcessor";
import { CircuitsSetupCache, createCircuitsSetupCache } from "./cache/CircuitsSetupCache";
import { SetupFilesResolver } from "./setup/SetupFilesResolver";
import { CircuitSetupInfo } from "./types/setup/setup-files-resolver";
import { CircuitArtifact } from "./types/circuit-artifacts";

extendConfig(zkitConfigExtender);

extendEnvironment((hre) => {
  hre.zkit = lazyObject(() => {
    const circuitArtifacts: CircuitArtifacts = new CircuitArtifacts(
      getNormalizedFullPath(hre.config.paths.root, hre.config.zkit.compilationSettings.artifactsDir),
    );

    return {
      circuitArtifacts,
      getCircuit: async (circuitName: string): Promise<CircuitZKit> => {
        return hre.run(TASK_ZKIT_GET_CIRCUIT_ZKIT, { circuitName });
      },
    };
  });
});

const compileShallow: ActionType<CompileShallowTaskConfig> = async (
  taskArgs: CompileShallowTaskConfig,
  env: HardhatRuntimeEnvironment,
) => {
  const circuitsCompileCacheFullPath: string = getNormalizedFullPath(
    env.config.paths.cache,
    CIRCUITS_COMPILE_CACHE_FILENAME,
  );

  await createCircuitsCompileCache(circuitsCompileCacheFullPath);
  createReporter(taskArgs.quiet || env.config.zkit.quiet);

  if (env.config.zkit.nativeCompiler) {
    await CircomCompilerFactory.checkNativeCompilerExistence();
  }

  const compilationFileResolver: CompilationFilesResolver = new CompilationFilesResolver(
    (absolutePath: string) => env.run(TASK_READ_FILE, { absolutePath }),
    env.zkit.circuitArtifacts,
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

  const resolvedFilesInfo: ResolvedFileInfo[] = await compilationFileResolver.getResolvedFilesToCompile(
    compileFlags,
    taskArgs.force,
  );

  if (resolvedFilesInfo.length > 0) {
    const compilationProcessor: CompilationProcessor = new CompilationProcessor(
      {
        compilerVersion: COMPILER_VERSION,
        compileFlags,
      },
      env.zkit.circuitArtifacts,
      env,
    );

    await compilationProcessor.compile(resolvedFilesInfo);

    const typeGenerationProcessor: TypeGenerationProcessor = new TypeGenerationProcessor(env);

    await typeGenerationProcessor.generateTypes(
      resolvedFilesInfo.map((fileInfo: ResolvedFileInfo) => fileInfo.circuitFullyQualifiedName),
    );

    for (const fileInfo of resolvedFilesInfo) {
      for (const file of [fileInfo.resolvedFile, ...fileInfo.dependencies]) {
        CircuitsCompileCache!.addFile(file.absolutePath, {
          lastModificationDate: file.lastModificationDate.valueOf(),
          contentHash: file.contentHash,
          sourceName: file.sourceName,
          compileFlags,
          imports: file.content.imports,
          versionPragmas: file.content.versionPragmas,
        });
      }
    }
  } else {
    Reporter!.reportNothingToCompile();
  }

  await CircuitsCompileCache!.writeToFile(circuitsCompileCacheFullPath);
};

const setup: ActionType<SetupTaskConfig> = async (taskArgs: SetupTaskConfig, env: HardhatRuntimeEnvironment) => {
  const circuitsSetupCacheFullPath: string = getNormalizedFullPath(
    env.config.paths.cache,
    CIRCUITS_SETUP_CACHE_FILENAME,
  );

  await createCircuitsSetupCache(circuitsSetupCacheFullPath);
  createReporter(taskArgs.quiet || env.config.zkit.quiet);

  const setupFileResolver: SetupFilesResolver = new SetupFilesResolver(env.zkit.circuitArtifacts, env.config);

  const circuitSetupInfoArr: CircuitSetupInfo[] = await setupFileResolver.getCircuitsInfoToSetup(
    env.config.zkit.setupSettings,
    taskArgs.force,
  );

  if (circuitSetupInfoArr.length > 0) {
    let ptauDir = env.config.zkit.setupSettings.ptauDir;

    if (ptauDir) {
      ptauDir = path.isAbsolute(ptauDir) ? ptauDir : getNormalizedFullPath(env.config.paths.root, ptauDir);
    } else {
      ptauDir = path.join(os.homedir(), ".zkit", "ptau");
    }

    const setupProcessor: SetupProcessor = new SetupProcessor(ptauDir, env.zkit.circuitArtifacts);

    await setupProcessor.setup(
      circuitSetupInfoArr.map((setupInfo: CircuitSetupInfo) => setupInfo.circuitArtifact),
      env.config.zkit.setupSettings.contributionSettings,
    );

    for (const setupInfo of circuitSetupInfoArr) {
      CircuitsSetupCache!.addFile(setupInfo.circuitArtifactFullPath, {
        circuitSourceName: setupInfo.circuitArtifact.circuitSourceName,
        r1csSourcePath: setupInfo.r1csSourcePath,
        r1csContentHash: setupInfo.r1csContentHash,
        contributionSettings: env.config.zkit.setupSettings.contributionSettings,
      });
    }
  } else {
    Reporter!.reportNothingToSetup();
  }

  await CircuitsSetupCache!.writeToFile(circuitsSetupCacheFullPath);
};

const make: ActionType<CompileTaskConfig> = async (taskArgs: CompileTaskConfig, env: HardhatRuntimeEnvironment) => {
  await env.run(TASK_CIRCUITS_COMPILE, taskArgs);
  await env.run(TASK_CIRCUITS_SETUP, { force: taskArgs.force, quiet: taskArgs.quiet });
};

const generateVerifiers: ActionType<GenerateVerifiersTaskConfig> = async (
  taskArgs: GenerateVerifiersTaskConfig,
  env: HardhatRuntimeEnvironment,
) => {
  if (!taskArgs.noCompile) {
    await env.run(TASK_CIRCUITS_COMPILE, {
      quiet: taskArgs.quiet,
      force: taskArgs.force,
    });
  } else {
    createReporter(taskArgs.quiet || env.config.zkit.quiet);
  }

  const artifactsDirFullPath: string = getNormalizedFullPath(
    env.config.paths.root,
    env.config.zkit.compilationSettings.artifactsDir,
  );
  const verifiersDirFullPath: string = getNormalizedFullPath(
    env.config.paths.root,
    taskArgs.verifiersDir ?? env.config.zkit.verifiersDir,
  );

  Reporter!.verboseLog("index", "Verifiers generation info: %o", [{ artifactsDirFullPath, verifiersDirFullPath }]);

  Reporter!.reportVerifiersGenerationHeader();

  const allFullyQualifiedNames: string[] = await env.zkit.circuitArtifacts.getAllCircuitFullyQualifiedNames();

  for (const name of allFullyQualifiedNames) {
    const circuitArtifact: CircuitArtifact = await env.zkit.circuitArtifacts.readCircuitArtifact(name);

    const spinnerId: string | null = Reporter!.reportVerifierGenerationStartWithSpinner(
      circuitArtifact.circuitTemplateName,
    );

    await new CircuitZKit({
      circuitName: circuitArtifact.circuitTemplateName,
      circuitArtifactsPath: path.dirname(env.zkit.circuitArtifacts.formCircuitArtifactPathFromFullyQualifiedName(name)),
      verifierDirPath: verifiersDirFullPath,
    }).createVerifier();

    Reporter!.reportVerifierGenerationResult(spinnerId, circuitArtifact.circuitTemplateName);
  }
};

const clean: ActionType<any> = async (
  _taskArgs: any,
  env: HardhatRuntimeEnvironment,
  runSuper: RunSuperFunction<any>,
) => {
  await runSuper();

  const circuitsCompileCacheFullPath: string = getNormalizedFullPath(
    env.config.paths.cache,
    CIRCUITS_COMPILE_CACHE_FILENAME,
  );
  const circuitsSetupCacheFullPath: string = getNormalizedFullPath(
    env.config.paths.cache,
    CIRCUITS_SETUP_CACHE_FILENAME,
  );
  const artifactsDirFullPath: string = getNormalizedFullPath(
    env.config.paths.root,
    env.config.zkit.compilationSettings.artifactsDir,
  );
  const typesArtifactsFullPath: string = getNormalizedFullPath(
    env.config.paths.root,
    env.config.zkit.typesSettings.typesArtifactsDir,
  );
  const circuitTypesFullPath: string = getNormalizedFullPath(
    env.config.paths.root,
    env.config.zkit.typesSettings.typesDir,
  );

  fs.rmSync(circuitsCompileCacheFullPath, { force: true });
  fs.rmSync(circuitsSetupCacheFullPath, { force: true });
  fs.rmSync(artifactsDirFullPath, { recursive: true, force: true });
  fs.rmSync(typesArtifactsFullPath, { recursive: true, force: true });
  fs.rmSync(circuitTypesFullPath, { recursive: true, force: true });
};

const getCircuitZKit: ActionType<GetCircuitZKitConfig> = async (
  taskArgs: GetCircuitZKitConfig,
  env: HardhatRuntimeEnvironment,
): Promise<CircuitZKit> => {
  const circuitArtifact: CircuitArtifact = await env.zkit.circuitArtifacts.readCircuitArtifact(taskArgs.circuitName);

  const verifiersDirFullPath: string = getNormalizedFullPath(
    env.config.paths.root,
    taskArgs.verifiersDir ?? env.config.zkit.verifiersDir,
  );

  const typesGenerator: CircuitTypesGenerator = new CircuitTypesGenerator({
    basePath: env.config.zkit.circuitsDir,
    projectRoot: env.config.paths.root,
    outputArtifactsDir: env.config.zkit.typesSettings.typesArtifactsDir,
    outputTypesDir: env.config.zkit.typesSettings.typesDir,
    circuitsASTPaths: [],
  });

  const circuitZKitConfig: CircuitZKitConfig = {
    circuitName: circuitArtifact.circuitTemplateName,
    circuitArtifactsPath: path.dirname(
      env.zkit.circuitArtifacts.formCircuitArtifactPathFromFullyQualifiedName(taskArgs.circuitName),
    ),
    verifierDirPath: verifiersDirFullPath,
    templateType: taskArgs.verifierTemplateType ?? "groth16",
  };

  if (willRunWithTypescript(env.hardhatArguments.config)) {
    const module = await typesGenerator.getCircuitObject(taskArgs.circuitName);

    return new module(circuitZKitConfig);
  } else {
    return new CircuitZKit(circuitZKitConfig);
  }
};

task(TASK_CIRCUITS_COMPILE, "Compile Circom circuits")
  .addFlag("sym", "Outputs witness in sym file in the compilation artifacts directory.")
  .addFlag("json", "Outputs constraints in json file in the compilation artifacts directory.")
  .addFlag("c", "Enables the generation of cpp files in the compilation artifacts directory.")
  .addFlag("force", "Force compilation ignoring cache.")
  .addFlag("quiet", "Suppresses logs during the compilation process.")
  .setAction(compileShallow);

task(TASK_CIRCUITS_SETUP, "Create ZKey and Vkey files for compiled circuits")
  .addFlag("force", "Force compilation ignoring cache.")
  .addFlag("quiet", "Suppresses logs during the compilation process.")
  .setAction(setup);

task(TASK_CIRCUITS_MAKE, "Compile Circom circuits and generate all necessary artifacts")
  .addFlag("sym", "Outputs witness in sym file in the compilation artifacts directory.")
  .addFlag("json", "Outputs constraints in json file in the compilation artifacts directory.")
  .addFlag("c", "Enables the generation of cpp files in the compilation artifacts directory.")
  .addFlag("force", "Force compilation ignoring cache.")
  .addFlag("quiet", "Suppresses logs during the compilation process.")
  .setAction(make);

task(TASK_GENERATE_VERIFIERS, "Generate Solidity verifier contracts for Circom circuits")
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

task(TASK_CLEAN).setAction(clean);

subtask(TASK_ZKIT_GET_CIRCUIT_ZKIT)
  .addOptionalParam("verifiersDir", undefined, undefined, types.string)
  .addOptionalParam("verifierTemplateType", undefined, undefined, types.any)
  .addParam("circuitName", undefined, undefined, types.string)
  .setAction(getCircuitZKit);
