import { lazyObject } from "hardhat/plugins";
import { extendConfig, extendEnvironment, scope, subtask, task, types } from "hardhat/config";
import { ActionType, HardhatRuntimeEnvironment, RunSuperFunction } from "hardhat/types";
import { TASK_CLEAN } from "hardhat/builtin-tasks/task-names";

import { CircuitZKit, ProvingSystemType } from "@solarity/zkit";

import "./type-extensions";

import {
  ZKIT_SCOPE_NAME,
  TASK_CIRCUITS_COMPILE,
  TASK_CIRCUITS_MAKE,
  TASK_CIRCUITS_SETUP,
  TASK_GENERATE_VERIFIERS,
  TASK_ZKIT_CLEAN,
  SUBTASK_ZKIT_GET_CIRCUIT_ZKIT,
} from "./task-names";

import { zkitConfigExtender } from "./config/config";

import { compile, setup, make, generateVerifiers, clean } from "./tasks";
import { CircuitZKitBuilder } from "./core";
import { CircuitArtifacts } from "./artifacts/CircuitArtifacts";

import { GetCircuitZKitConfig } from "./types/tasks";

const zkitScope = scope(ZKIT_SCOPE_NAME, "The ultimate TypeScript environment for Circom development");

extendConfig(zkitConfigExtender);

extendEnvironment((hre) => {
  hre.zkit = lazyObject(() => {
    const circuitArtifacts: CircuitArtifacts = new CircuitArtifacts(hre);
    const circuitZKitBuilder: CircuitZKitBuilder = new CircuitZKitBuilder(hre);

    return {
      circuitArtifacts,
      circuitZKitBuilder,
      getCircuit: async (
        circuitName: string,
        provingSystem?: ProvingSystemType,
      ): Promise<CircuitZKit<ProvingSystemType>> => {
        return hre.run(SUBTASK_ZKIT_GET_CIRCUIT_ZKIT, { circuitName, provingSystem });
      },
    };
  });
});

const getCircuitZKit: ActionType<GetCircuitZKitConfig> = async (
  taskArgs: GetCircuitZKitConfig,
  env: HardhatRuntimeEnvironment,
): Promise<CircuitZKit<ProvingSystemType>> => {
  return env.zkit.circuitZKitBuilder.getCircuitZKit(
    taskArgs.circuitName,
    taskArgs.provingSystem,
    taskArgs.verifiersDir,
  );
};

task(TASK_CLEAN).setAction(async (_taskArgs: any, env: HardhatRuntimeEnvironment, runSuper: RunSuperFunction<any>) => {
  await runSuper();

  await env.run({ scope: ZKIT_SCOPE_NAME, task: TASK_ZKIT_CLEAN });
});

zkitScope
  .task(TASK_CIRCUITS_MAKE, "Compile Circom circuits and setup proving and verification keys.")
  .addFlag("json", "Output constraints in the 'json' file in the compilation artifacts directory.")
  .addFlag("c", "Enable the generation of 'cpp' files in the compilation artifacts directory.")
  .addFlag("force", "Force compilation and setup ignoring cache.")
  .addFlag("quiet", "Suppress logs during the compilation and setup processes.")
  .setAction(make);

zkitScope
  .task(TASK_CIRCUITS_COMPILE, "Compile Circom circuits.")
  .addFlag("json", "Output constraints in the 'json' file in the compilation artifacts directory.")
  .addFlag("c", "Enable the generation of 'cpp' files in the compilation artifacts directory.")
  .addFlag("force", "Force compilation ignoring cache.")
  .addOptionalParam(
    "optimization",
    "Optimization flag for constraint simplification. Use 'O0' for no simplification, 'O1' for signal-to-signal and signal-to-constant simplification, and 'O2' for full simplification.",
    undefined,
    types.string,
  )
  .setAction(compile);

zkitScope
  .task(TASK_CIRCUITS_SETUP, "Setup ZKey and VKey keys for previously compiled circuits.")
  .addFlag("force", "Force setup ignoring cache.")
  .addFlag("quiet", "Suppress logs during the setup process.")
  .setAction(setup);

zkitScope
  .task(TASK_GENERATE_VERIFIERS, "Generate Solidity | Vyper verifier contracts for Circom circuits.")
  .addOptionalParam(
    "verifiersDir",
    "Relative path to the directory where to save the generated verifier contracts.",
    undefined,
    types.string,
  )
  .addOptionalParam(
    "verifiersType",
    "Verifier contracts language to generate. Use 'sol' for Solidity and 'vy' for Vyper.",
    undefined,
    types.string,
  )
  .addFlag("noCompile", "Disable compilation before verifiers generation.")
  .addFlag("force", "Force compilation ignoring cache.")
  .addFlag("quiet", "Suppress logs during the verifier generation process.")
  .setAction(generateVerifiers);

zkitScope.task(TASK_ZKIT_CLEAN, "Clean all zkit artifacts, circom generated files, keys, types, etc.").setAction(clean);

subtask(SUBTASK_ZKIT_GET_CIRCUIT_ZKIT)
  .addOptionalParam("verifiersDir", undefined, undefined, types.string)
  .addOptionalParam("provingSystem", undefined, undefined, types.any)
  .addParam("circuitName", undefined, undefined, types.string)
  .setAction(getCircuitZKit);
