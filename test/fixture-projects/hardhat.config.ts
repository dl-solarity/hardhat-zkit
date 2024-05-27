import { HardhatUserConfig } from "hardhat/config";

import "@nomicfoundation/hardhat-ethers";

import "../../src";

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      initialDate: "1970-01-01T00:00:00Z",
    },
  },
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "paris",
    },
  },
};

export default config;
