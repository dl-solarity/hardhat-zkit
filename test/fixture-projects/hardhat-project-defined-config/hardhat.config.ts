import { HardhatUserConfig } from "hardhat/config";

import config from "../hardhat.config";

const defaultConfig: HardhatUserConfig = {
  ...config,
  zkit: {
    circuitsDir: "circuits",
    compilationSettings: {
      skipFiles: ["vendor"],
      simplification: {
        o1: true,
        simplificationSubstitution: true,
      },
    },
    setupSettings: {
      ptauDir: "zkit/ptau",
      ptauDownload: true,
    },
    quiet: true,
    verifiersSettings: {
      verifiersDir: "contracts/verifiers",
      verifiersType: "vy",
    },
    compilerVersion: "2.1.8",
  },
};

export default defaultConfig;
