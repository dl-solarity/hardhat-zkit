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
          quiet: true,
          sym: false,
          contributionTemplate: "groth16",
          contributions: 1,
        },
        verifiersSettings: {
          onlyFiles: ["mock"],
          skipFiles: [],
          verifiersDir: "contracts/verifiers",
        },
        ptauDir: "zkit/ptau",
        allowDownload: true,
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
          quiet: false,
          sym: false,
          contributionTemplate: "groth16",
          contributions: 1,
        },
        verifiersSettings: {
          verifiersDir: "contracts/verifiers",
          onlyFiles: [],
          skipFiles: [],
        },
        ptauDir: undefined,
        allowDownload: true,
      };

      expect(loadedOptions).to.deep.equal(defaultConfig);
    });
  });
});
