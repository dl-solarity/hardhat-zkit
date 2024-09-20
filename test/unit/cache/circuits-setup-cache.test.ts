import fsExtra from "fs-extra";

import { expect } from "chai";

import { useEnvironment } from "../../helpers";
import { getSetupCacheEntry } from "../../utils";
import { getFileHash } from "../../../src/utils/utils";
import { getNormalizedFullPath } from "../../../src/utils/path-utils";

import { defaultContributionSettings } from "../../constants";
import { SetupCacheEntry } from "../../../src/types/cache";
import { CircuitArtifact } from "../../../src/types/artifacts/circuit-artifacts";
import { TASK_CIRCUITS_MAKE, ZKIT_SCOPE_NAME } from "../../../src/task-names";
import { CIRCUITS_SETUP_CACHE_FILENAME, CIRCUIT_SETUP_CACHE_VERSION } from "../../../src/constants";

import { CircuitsSetupCache, createCircuitsSetupCache, resetCircuitsSetupCache } from "../../../src/cache";

describe("CircuitsSetupCache", () => {
  describe("createEmpty", () => {
    it("should correctly create empty CircuitsSetupCache instance", async () => {
      resetCircuitsSetupCache();

      await createCircuitsSetupCache(undefined);

      expect(CircuitsSetupCache!.constructor.name).to.be.eq("BaseCircuitsSetupCache");
      expect(Object.values(CircuitsSetupCache!)[0]._format).to.be.eq(CIRCUIT_SETUP_CACHE_VERSION);
    });
  });

  describe("readFromFile", () => {
    useEnvironment("with-circuits");

    it("should correctly create CircuitsSetupCache instance from file", async function () {
      CircuitsSetupCache!.getEntries().forEach(async (entry: SetupCacheEntry) => {
        expect(entry).to.be.deep.eq(await getSetupCacheEntry(entry.circuitSourceName, entry.r1csSourcePath));
      });
    });

    it("should correctly create CircuitsSetupCache instance and remove non existing files", async function () {
      const circuitsCacheFullPath: string = getNormalizedFullPath(
        this.hre.config.paths.cache,
        CIRCUITS_SETUP_CACHE_FILENAME,
      );

      const circuitAbsolutePath: string = getNormalizedFullPath(
        this.hre.config.paths.root,
        "circuits/main/mul2.circom",
      );
      const typesDir: string = getNormalizedFullPath(this.hre.config.paths.root, "generated-types/zkit");

      const fileContent: string = fsExtra.readFileSync(circuitAbsolutePath, "utf-8");

      fsExtra.rmSync(circuitAbsolutePath);

      resetCircuitsSetupCache();
      await createCircuitsSetupCache(circuitsCacheFullPath);

      expect(CircuitsSetupCache!.getEntry(circuitAbsolutePath)).to.be.undefined;

      fsExtra.writeFileSync(circuitAbsolutePath, fileContent);
      fsExtra.rmSync(typesDir, { recursive: true, force: true });
    });

    it("should return empty CircuitsSetupCache instance if pass invalid cache file", async function () {
      const invalidCacheFullPath = getNormalizedFullPath(this.hre.config.paths.cache, "invalid-cache.json");

      fsExtra.writeFileSync(invalidCacheFullPath, JSON.stringify({ a: 1, b: 2 }));

      resetCircuitsSetupCache();
      await createCircuitsSetupCache(invalidCacheFullPath);

      expect(CircuitsSetupCache!.getEntries()).to.be.deep.eq([]);

      fsExtra.rmSync(invalidCacheFullPath);
    });

    it("should return empty CircuitsSetupCache instance if pass invalid cache file path", async function () {
      const invalidCacheFullPath = getNormalizedFullPath(this.hre.config.paths.cache, "invalid-cache.json");

      resetCircuitsSetupCache();
      await createCircuitsSetupCache(invalidCacheFullPath);

      expect(CircuitsSetupCache!.getEntries()).to.be.deep.eq([]);
    });
  });

  describe("hasFileChanged", () => {
    useEnvironment("with-circuits");

    it("should return correct results", async function () {
      await this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_CIRCUITS_MAKE }, { quiet: false });

      expect(CircuitsSetupCache!.hasFileChanged("invalid-path", "", defaultContributionSettings)).to.be.true;

      const mul2FullName: string = "circuits/main/mul2.circom:Multiplier2";

      const mul2Artifact: CircuitArtifact = await this.hre.zkit.circuitArtifacts.readCircuitArtifact(mul2FullName);
      const mul2ArtifactFullPath: string =
        await this.hre.zkit.circuitArtifacts.formCircuitArtifactPathFromFullyQualifiedName(mul2FullName);
      const mul2R1CSFilePath: string = await this.hre.zkit.circuitArtifacts.getCircuitArtifactFileFullPath(
        mul2Artifact,
        "r1cs",
      );

      const contentHash = getFileHash(mul2R1CSFilePath);

      expect(CircuitsSetupCache!.hasFileChanged(mul2ArtifactFullPath, contentHash + "1", defaultContributionSettings))
        .to.be.true;
      expect(
        CircuitsSetupCache!.hasFileChanged(mul2ArtifactFullPath, contentHash, {
          ...defaultContributionSettings,
          contributions: 2,
        }),
      ).to.be.true;

      expect(CircuitsSetupCache!.hasFileChanged(mul2ArtifactFullPath, contentHash, defaultContributionSettings)).to.be
        .false;

      const typesDir: string = getNormalizedFullPath(this.hre.config.paths.root, "generated-types/zkit");

      fsExtra.rmSync(typesDir, { recursive: true, force: true });
    });
  });
});
