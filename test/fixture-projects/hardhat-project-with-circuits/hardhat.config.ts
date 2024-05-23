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
      onlyFiles: ["main", "base"],
      verifiersDir: "contracts/verifiers",
    },
    ptauDir: "zkit/ptau",
    allowDownload: true,
  },
};

export default defaultConfig;
