import { extendConfig, task, types } from "hardhat/config";
import { ActionType } from "hardhat/types";

import "./type-extensions";
import "./zkit/index";

import { mergeCompilationSettings, mergeVerifiersGenerationSettings, zkitConfigExtender } from "./config";
import { TASK_CIRCUITS_COMPILE, TASK_GENERATE_VERIFIERS } from "./constants";

import { CircomZKitManager } from "./zkit/CircomZKitManager";
import { CompilationSettings, VerifiersGenerationSettings } from "./types/zkit-config";

extendConfig(zkitConfigExtender);

const circuitsCompile: ActionType<CompilationSettings> = async (taskArgs, env) => {
  env.config.zkit.compilationSettings = mergeCompilationSettings(taskArgs, env.config.zkit.compilationSettings);

  await new CircomZKitManager(env).compile();
};

const generateVerifiers: ActionType<VerifiersGenerationSettings> = async (taskArgs, env) => {
  env.config.zkit.verifiersSettings = mergeVerifiersGenerationSettings(taskArgs, env.config.zkit.verifiersSettings);

  await new CircomZKitManager(env).generateVerifiers();
};

task(TASK_CIRCUITS_COMPILE, "Compile circuits")
  .addOptionalParam("artifactsDir", "The circuits directory path.", undefined, types.string)
  .addFlag("sym", "The sym flag.")
  .addFlag("json", "The json flag.")
  .addFlag("c", "The c flag.")
  .addFlag("quiet", "The quiet flag.")
  .setAction(circuitsCompile);

task(TASK_GENERATE_VERIFIERS, "Generate verifiers for circuits")
  .addOptionalParam("verifiersDir", "The generated verifiers directory path.", undefined, types.string)
  .setAction(generateVerifiers);
