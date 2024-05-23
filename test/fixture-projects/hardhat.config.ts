import { HardhatUserConfig } from "hardhat/config";

import "hardhat-abi-exporter";

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
  abiExporter: {
    flat: true,
  },
};

export default config;
