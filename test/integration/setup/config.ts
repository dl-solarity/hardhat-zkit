import { expect } from "chai";

import { extendConfig } from "hardhat/config";

import { useEnvironment } from "../../helpers";

import { zkitConfigExtender } from "../../../src/config/config";

import { ZKitConfig } from "../../../src/types/zkit-config";

describe("config", () => {
  describe("loading", () => {
    useEnvironment("defined-config");

    let loadedOptions: ZKitConfig;

    beforeEach(async function () {
      loadedOptions = this.hre.config.zkit;
    });

    it("should apply user defined config", async () => {
      const userDefinedConfig: ZKitConfig = {
        circuitsDir: "circuits",
        compilationSettings: {
          artifactsDir: "zkit/artifacts",
          onlyFiles: [],
          skipFiles: ["vendor"],
          c: false,
          json: false,
          sym: false,
        },
        setupSettings: {
          contributionSettings: {
            contributionTemplate: "groth16",
            contributions: 1,
          },
          ptauDir: "zkit/ptau",
          ptauDownload: true,
          onlyFiles: [],
          skipFiles: [],
        },
        typesSettings: {
          typesArtifactsDir: "zkit/abi",
          typesDir: "generated-types/zkit",
        },
        verifiersDir: "contracts/verifiers",
        nativeCompiler: false,
        quiet: true,
      };

      expect(loadedOptions).to.deep.equal(userDefinedConfig);
    });
  });

  describe("extension", () => {
    useEnvironment("undefined-config");

    let loadedOptions: ZKitConfig;

    beforeEach("setup", async function () {
      extendConfig(zkitConfigExtender);
      loadedOptions = this.hre.config.zkit;
    });

    it("the zkit field should be present", async () => {
      const defaultConfig: ZKitConfig = {
        circuitsDir: "circuits",
        compilationSettings: {
          artifactsDir: "zkit/artifacts",
          onlyFiles: [],
          skipFiles: [],
          c: false,
          json: false,
          sym: false,
        },
        setupSettings: {
          contributionSettings: {
            contributionTemplate: "groth16",
            contributions: 1,
          },
          ptauDir: undefined,
          ptauDownload: true,
          onlyFiles: [],
          skipFiles: [],
        },
        typesSettings: {
          typesArtifactsDir: "zkit/abi",
          typesDir: "generated-types/zkit",
        },
        verifiersDir: "contracts/verifiers",
        nativeCompiler: false,
        quiet: false,
      };

      expect(loadedOptions).to.deep.equal(defaultConfig);
    });
  });
});
