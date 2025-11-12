import { TASK_CIRCUITS_COMPILE, TASK_CIRCUITS_SETUP, ZKIT_SCOPE_NAME } from "../task-names.js";

import { Reporter } from "../reporter/index.js";

import { MakeTaskConfig } from "../types/tasks/index.js";
import { NewTaskActionFunction } from "hardhat/types/tasks";

const makeAction: NewTaskActionFunction<MakeTaskConfig> = async (taskArgs, hre) => {
  await hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_COMPILE]).run({ ...taskArgs });

  Reporter!.reportCompilationBottomLine();

  await hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_SETUP]).run({ force: taskArgs.force, quiet: taskArgs.quiet });
};

export default makeAction;
