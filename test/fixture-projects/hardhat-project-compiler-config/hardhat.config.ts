import { HardhatUserConfig } from "hardhat/config";

import config from "../hardhat.config.js";

import zkit from "../../../src/index.js";

const defaultConfig: HardhatUserConfig = {
  ...config,
  plugins: [zkit],
  zkit: {
    compilerVersion: "2.1.9",
    circuitsDir: "circuits",
    compilationSettings: {
      artifactsDir: "zkit/artifacts",
      skipFiles: ["vendor"],
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
