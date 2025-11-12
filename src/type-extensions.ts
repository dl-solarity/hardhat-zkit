import "hardhat/types/config";

import { ZKitConfig, ZKitUserConfig } from "./types/zkit-config.js";
import { HardhatZKit } from "./types/hardhat-zkit.js";

declare module "hardhat/types/config" {
  interface HardhatConfig {
    zkit: ZKitConfig;
  }

  interface HardhatUserConfig {
    zkit?: ZKitUserConfig;
  }
}

declare module "hardhat/types/hre" {
  interface HardhatRuntimeEnvironment {
    zkit: HardhatZKit;
  }
}
