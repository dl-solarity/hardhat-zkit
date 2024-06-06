import { extendConfig, extendEnvironment } from "hardhat/config";
import { lazyObject } from "hardhat/plugins";

import * as tasks from "./tasks";
import "./type-extensions";

import { zkitConfigExtender } from "./config/config";

extendConfig(zkitConfigExtender);

extendEnvironment((hre) => {
  hre.zkit = lazyObject(() => {
    return {
      getCircuit: async (circuitName: string) => {
        return await hre.run(tasks.TASK_ZKIT_GET_CIRCUIT_ZKIT, { circuitName });
      },
      getCircuitsInfo: async (withMainComponent?: boolean) => {
        return await hre.run(tasks.TASK_ZKIT_GET_CIRCUITS_INFO, { withMainComponent: withMainComponent ?? false });
      },
    };
  });
});
