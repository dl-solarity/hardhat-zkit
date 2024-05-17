import "hardhat/types/config";
import "hardhat/types/runtime";

import { ZKitConfig } from "./types/zkit-config";
import { HardhatZKit } from "./types/hardhat-zkit";

declare module "hardhat/types/config" {
  interface HardhatConfig {
    zkit: ZKitConfig;
  }

  interface HardhatUserConfig {
    zkit?: Partial<ZKitConfig>;
  }
}

declare module "hardhat/types/runtime" {
  interface HardhatRuntimeEnvironment {
    zkit: HardhatZKit;
  }
}
