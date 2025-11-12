import { NewTaskActionFunction } from "hardhat/types/tasks";

import { CircuitZKit, ProvingSystemType } from "@solarity/zkit";

import { GetCircuitZKitConfig } from "../types/tasks/index.js";
import { HardhatZKitError } from "../../src/errors.js";

const getCircuitZKit: NewTaskActionFunction<GetCircuitZKitConfig> = async (
  taskArgs,
  hre,
): Promise<CircuitZKit<ProvingSystemType>> => {
  if (taskArgs.provingSystem && taskArgs.provingSystem != "groth16" && taskArgs.provingSystem != "plonk") {
    throw new HardhatZKitError("Invalid proving system is passed.");
  }

  return hre.zkit.circuitZKitBuilder.getCircuitZKit(
    taskArgs.circuitName,
    taskArgs.provingSystem as ProvingSystemType,
    taskArgs.verifiersDir,
  );
};

export default getCircuitZKit;
