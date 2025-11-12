import { CircuitZKit, ProvingSystemType } from "@solarity/zkit";
import { HardhatRuntimeEnvironmentHooks } from "hardhat/types/hooks";

import { CircuitArtifacts } from "../artifacts/CircuitArtifacts.js";
import { CircuitZKitBuilder } from "../core/index.js";
import { SUBTASK_ZKIT_GET_CIRCUIT_ZKIT, ZKIT_SCOPE_NAME } from "../task-names.js";

export default async (): Promise<Partial<HardhatRuntimeEnvironmentHooks>> => ({
  created: async (_, hre) => {
    const circuitArtifacts: CircuitArtifacts = new CircuitArtifacts(hre);
    const circuitZKitBuilder: CircuitZKitBuilder = new CircuitZKitBuilder(hre);

    console.log("env call");
    console.log(hre.config.zkit.setupSettings.contributionSettings.provingSystem);

    hre.zkit = {
      circuitArtifacts,
      circuitZKitBuilder,
      getCircuit: async (
        circuitName: string,
        provingSystem?: ProvingSystemType,
      ): Promise<CircuitZKit<ProvingSystemType>> => {
        return hre.tasks.getTask([ZKIT_SCOPE_NAME, SUBTASK_ZKIT_GET_CIRCUIT_ZKIT]).run({ circuitName, provingSystem });
      },
    };
  },
});
