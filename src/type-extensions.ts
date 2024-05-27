import "hardhat/types/config";
import "hardhat/types/runtime";

import { ZKitConfig } from "./types/zkit-config";
import { HardhatZKit } from "./types/hardhat-zkit";
import { RecursivePartial } from "./types/utils";

declare module "hardhat/types/config" {
  interface HardhatConfig {
    zkit: ZKitConfig;
  }

  interface HardhatUserConfig {
    zkit?: RecursivePartial<ZKitConfig>;
  }
}

declare module "hardhat/types/runtime" {
  interface HardhatRuntimeEnvironment {
    zkit: HardhatZKit;
  }
}
