import { extendEnvironment } from "hardhat/config";
import { lazyObject } from "hardhat/plugins";

import { CircomZKitManager } from "./CircomZKitManager";

extendEnvironment((hre) => {
  hre.zkit = lazyObject(() => {
    return {
      getCircuit: (circuit: string) => {
        return new CircomZKitManager(hre).getCircuit(circuit);
      },
      getCircuitsInfo: () => {
        return new CircomZKitManager(hre).getCircuitsInfo();
      },
    };
  });
});
