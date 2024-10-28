import { HardhatUserConfig } from "hardhat/config";

import config from "../hardhat.config";

const defaultConfig: HardhatUserConfig = {
  ...config,
  zkit: {
    circuitsDir: "circuits",
    compilationSettings: {
      artifactsDir: "zkit/artifacts",
      skipFiles: ["vendor"],
      json: true,
    },
    setupSettings: {
      ptauDir: "zkit/ptau",
      ptauDownload: true,
    },
    quiet: true,
    verifiersSettings: {
      verifiersDir: "contracts/verifiers",
    },
  },
};

export default defaultConfig;
