import { HardhatUserConfig } from "hardhat/config";

import config from "../hardhat.config";

const defaultConfig: HardhatUserConfig = {
  ...config,
  zkit: {
    circuitsDir: "circuits",
    compilationSettings: {
      skipFiles: ["vendor"],
      quiet: true,
    },
    verifiersSettings: {
      onlyFiles: ["mock"],
      verifiersDir: "contracts/verifiers",
    },
    ptauDir: "zkit/ptau",
    ptauDownload: true,
  },
};

export default defaultConfig;
