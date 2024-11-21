import { ActionType, HardhatRuntimeEnvironment } from "hardhat/types";

import { ZKIT_SCOPE_NAME, TASK_CIRCUITS_COMPILE, TASK_CIRCUITS_SETUP } from "../task-names";

import { Reporter } from "../reporter";

import { MakeTaskConfig } from "../types/tasks";

export const make: ActionType<MakeTaskConfig> = async (taskArgs: MakeTaskConfig, env: HardhatRuntimeEnvironment) => {
  await env.run({ scope: ZKIT_SCOPE_NAME, task: TASK_CIRCUITS_COMPILE }, taskArgs);

  Reporter!.reportCompilationBottomLine();

  await env.run(
    { scope: ZKIT_SCOPE_NAME, task: TASK_CIRCUITS_SETUP },
    { force: taskArgs.force, quiet: taskArgs.quiet },
  );
};
