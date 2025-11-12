import zkit from "../../src/index.js";

/** @type import('hardhat/config').HardhatUserConfig */
const config = {
  plugins: [zkit],
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
