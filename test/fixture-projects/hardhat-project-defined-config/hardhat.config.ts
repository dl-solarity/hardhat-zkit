import { HardhatUserConfig } from "hardhat/config";

import config from "../hardhat.config";

const defaultConfig: HardhatUserConfig = {
  ...config,
  zkit: {
    circuitsDir: "circuits",
    compilationSettings: {
      skipFiles: ["vendor"],
    },
    setupSettings: {
      ptauDir: "zkit/ptau",
      ptauDownload: true,
    },
    quiet: true,
    verifiersDir: "contracts/verifiers",
  },
};

export default defaultConfig;
