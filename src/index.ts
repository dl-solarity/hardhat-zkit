import "./type-extensions.js";

import type { HardhatPlugin } from "hardhat/types/plugins";
import { emptyTask, overrideTask, task } from "hardhat/config";
import { ArgumentType } from "hardhat/types/arguments";

import { PLUGIN_NAME } from "./constants.js";

import {
  ZKIT_SCOPE_NAME,
  TASK_CIRCUITS_COMPILE,
  TASK_CIRCUITS_MAKE,
  TASK_CIRCUITS_SETUP,
  TASK_GENERATE_VERIFIERS,
  TASK_ZKIT_CLEAN,
  SUBTASK_ZKIT_GET_CIRCUIT_ZKIT,
} from "./task-names.js";

const hardhatPlugin: HardhatPlugin = {
  id: PLUGIN_NAME,
  hookHandlers: {
    config: () => import("./config/config.js"),
    hre: () => import("./environment/environment.js"),
  },
  tasks: [
    overrideTask("clean")
      .setAction(async () => ({
        default: async (args, hre, runSuper) => {
          await runSuper(args);

          await hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_ZKIT_CLEAN]).run();
        },
      }))
      .build(),
    emptyTask(ZKIT_SCOPE_NAME, "The ultimate TypeScript environment for Circom development").build(),
    task([ZKIT_SCOPE_NAME, TASK_CIRCUITS_MAKE], "Compile Circom circuits and setup proving and verification keys.")
      .addFlag({
        name: "json",
        description: "Output constraints in the 'json' file in the compilation artifacts directory.",
      })
      .addFlag({
        name: "c",
        description: "Enable the generation of 'cpp' files in the compilation artifacts directory.",
      })
      .addFlag({ name: "force", description: "Force compilation and setup ignoring cache." })
      .addFlag({ name: "quiet", description: "Suppress logs during the compilation and setup processes." })
      .setAction(() => import("./tasks/make.js"))
      .build(),
    task([ZKIT_SCOPE_NAME, TASK_CIRCUITS_COMPILE], "Compile Circom circuits")
      .addFlag({
        name: "json",
        description: "Output constraints in the 'json' file in the compilation artifacts directory.",
      })
      .addFlag({
        name: "c",
        description: "Enable the generation of 'cpp' files in the compilation artifacts directory.",
      })
      .addFlag({ name: "force", description: "Force compilation ignoring cache." })
      .addFlag({ name: "quiet", description: "Suppress logs during the compilation process." })
      .addOption({
        name: "optimization",
        description:
          "Optimization flag for constraint simplification. Use 'O0' for no simplification, 'O1' for signal-to-signal and signal-to-constant simplification, and 'O2' for full simplification.",
        type: ArgumentType.STRING,
        defaultValue: "O1",
      })
      .setAction(() => import("./tasks/compile.js"))
      .build(),
    task([ZKIT_SCOPE_NAME, TASK_CIRCUITS_SETUP], "Setup ZKey and VKey keys for previously compiled circuits.")
      .addFlag({ name: "force", description: "Force setup ignoring cache." })
      .addFlag({ name: "quiet", description: "Suppress logs during the setup process." })
      .setAction(() => import("./tasks/setup.js"))
      .build(),
    task(
      [ZKIT_SCOPE_NAME, TASK_GENERATE_VERIFIERS],
      "Generate Solidity | Vyper verifier contracts for Circom circuits.",
    )
      .addOption({
        name: "verifiersDir",
        description: "Relative path to the directory where to save the generated verifier contracts.",
        defaultValue: undefined,
        type: ArgumentType.STRING_WITHOUT_DEFAULT,
      })
      .addOption({
        name: "verifiersType",
        description: "Verifier contracts language to generate. Use 'sol' for Solidity and 'vy' for Vyper.",
        defaultValue: undefined,
        type: ArgumentType.STRING_WITHOUT_DEFAULT,
      })
      .addFlag({ name: "noCompile", description: "Disable compilation before verifiers generation." })
      .addFlag({ name: "force", description: "Force compilation ignoring cache." })
      .addFlag({ name: "quiet", description: "Suppress logs during the verifier generation process." })
      .setAction(() => import("./tasks/generate-verifiers.js"))
      .build(),
    task([ZKIT_SCOPE_NAME, TASK_ZKIT_CLEAN], "Clean all zkit artifacts, circom generated files, keys, types, etc.")
      .setAction(() => import("./tasks/clean.js"))
      .build(),
    task([ZKIT_SCOPE_NAME, SUBTASK_ZKIT_GET_CIRCUIT_ZKIT])
      .addOption({ name: "circuitName", description: undefined, defaultValue: "undefined", type: ArgumentType.STRING })
      .addOption({
        name: "verifiersDir",
        description: undefined,
        defaultValue: undefined,
        type: ArgumentType.STRING_WITHOUT_DEFAULT,
      })
      .addOption({
        name: "provingSystem",
        description: undefined,
        defaultValue: undefined,
        type: ArgumentType.STRING_WITHOUT_DEFAULT,
      })

      .setAction(() => import("./tasks/get-circuit-zkit.js"))
      .build(),
  ],
  npmPackage: "@solarity/hardhat-zkit",
} satisfies HardhatPlugin;

export default hardhatPlugin;
