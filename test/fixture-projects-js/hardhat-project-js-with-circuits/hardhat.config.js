import config from '../hardhat.config.js';

/** @type import('hardhat/config').HardhatUserConfig */
const defaultConfig = {
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

export default defaultConfig;
