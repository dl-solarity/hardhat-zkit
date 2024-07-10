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
          contributionTemplate: "groth16",
          contributions: 1,
        },
        typesSettings: {
          typesArtifactsDir: "zkit/abi",
          typesDir: "generated-types/zkit",
        },
        quiet: true,
        verifiersDir: "contracts/verifiers",
        ptauDir: "zkit/ptau",
        ptauDownload: true,
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
          contributionTemplate: "groth16",
          contributions: 1,
        },
        typesSettings: {
          typesArtifactsDir: "zkit/abi",
          typesDir: "generated-types/zkit",
        },
        quiet: false,
        verifiersDir: "contracts/verifiers",
        ptauDir: undefined,
        ptauDownload: true,
      };

      expect(loadedOptions).to.deep.equal(defaultConfig);
    });
  });
});
