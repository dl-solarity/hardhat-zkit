require("@nomicfoundation/hardhat-ethers");

require("../../../src");

const config = require("../hardhat.config");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  ...config,
  zkit: {
    circuitsDir: "circuits",
    compilationSettings: {
      artifactsDir: "zkit/artifacts",
      skipFiles: ["vendor"],
    },
    setupSettings: {
      contributionSettings: {
        provingSystem: ["groth16"],
      },
      ptauDir: "zkit/ptau",
      ptauDownload: true,
    },
    quiet: true,
    verifiersSettings: {
      verifiersDir: "contracts/verifiers",
    },
    typesDir: "generated-types/zkit",
  },
};
