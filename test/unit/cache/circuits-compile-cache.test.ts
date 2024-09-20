import fsExtra from "fs-extra";

import { expect } from "chai";

import { useEnvironment } from "../../helpers";
import { getCompileCacheEntry } from "../../utils";
import { getFileHash } from "../../../src/utils/utils";
import { getNormalizedFullPath } from "../../../src/utils/path-utils";

import { defaultCompileFlags } from "../../constants";
import { CompileCacheEntry } from "../../../src/types/cache";
import { TASK_CIRCUITS_COMPILE, ZKIT_SCOPE_NAME } from "../../../src/task-names";
import { CIRCUITS_COMPILE_CACHE_FILENAME, CIRCUIT_COMPILE_CACHE_VERSION } from "../../../src/constants";

import { CircuitsCompileCache, createCircuitsCompileCache, resetCircuitsCompileCache } from "../../../src/cache";

describe("CircuitsCompileCache", () => {
  describe("createEmpty", () => {
    it("should correctly create empty CircuitsCompileCache instance", async () => {
      resetCircuitsCompileCache();

      await createCircuitsCompileCache(undefined);

      expect(CircuitsCompileCache!.constructor.name).to.be.eq("BaseCircuitsCompileCache");
      expect(Object.values(CircuitsCompileCache!)[0]._format).to.be.eq(CIRCUIT_COMPILE_CACHE_VERSION);
    });
  });

  describe("readFromFile", () => {
    useEnvironment("with-circuits");

    it("should correctly create CircuitsCompileCache instance from file", async function () {
      CircuitsCompileCache!.getEntries().forEach(async (entry: CompileCacheEntry) => {
        expect(entry).to.be.deep.eq(await getCompileCacheEntry(this.hre.config.paths.root, entry.sourceName));
      });
    });

    it("should correctly create CircuitsCompileCache instance and remove non existing files", async function () {
      await this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_CIRCUITS_COMPILE });

      const circuitsCacheFullPath: string = getNormalizedFullPath(
        this.hre.config.paths.cache,
        CIRCUITS_COMPILE_CACHE_FILENAME,
      );

      const circuitAbsolutePath: string = getNormalizedFullPath(
        this.hre.config.paths.root,
        "circuits/main/mul2.circom",
      );
      const typesDir: string = getNormalizedFullPath(this.hre.config.paths.root, "generated-types/zkit");

      const fileContent: string = fsExtra.readFileSync(circuitAbsolutePath, "utf-8");

      fsExtra.rmSync(circuitAbsolutePath);

      resetCircuitsCompileCache();
      await createCircuitsCompileCache(circuitsCacheFullPath);

      expect(CircuitsCompileCache!.getEntry(circuitAbsolutePath)).to.be.undefined;

      fsExtra.writeFileSync(circuitAbsolutePath, fileContent);
      fsExtra.rmSync(typesDir, { recursive: true, force: true });
    });

    it("should return empty CircuitsCompileCache instance if pass invalid cache file", async function () {
      const invalidCacheFullPath = getNormalizedFullPath(this.hre.config.paths.cache, "invalid-cache.json");

      fsExtra.writeFileSync(invalidCacheFullPath, JSON.stringify({ a: 1, b: 2 }));

      resetCircuitsCompileCache();
      await createCircuitsCompileCache(invalidCacheFullPath);

      expect(CircuitsCompileCache!.getEntries()).to.be.deep.eq([]);

      fsExtra.rmSync(invalidCacheFullPath);
    });

    it("should return empty CircuitsCompileCache instance if pass invalid cache file path", async function () {
      const invalidCacheFullPath = getNormalizedFullPath(this.hre.config.paths.cache, "invalid-cache.json");

      resetCircuitsCompileCache();
      await createCircuitsCompileCache(invalidCacheFullPath);

      expect(CircuitsCompileCache!.getEntries()).to.be.deep.eq([]);
    });
  });

  describe("hasFileChanged", () => {
    useEnvironment("with-circuits");

    it("should return correct results", async function () {
      await this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_CIRCUITS_COMPILE });

      expect(CircuitsCompileCache!.hasFileChanged("invalid-path", "", defaultCompileFlags)).to.be.true;

      const circuitPath = getNormalizedFullPath(this.hre.config.paths.root, "circuits/main/mul2.circom");
      const contentHash = getFileHash(circuitPath);

      expect(CircuitsCompileCache!.hasFileChanged(circuitPath, contentHash + "1", defaultCompileFlags)).to.be.true;
      expect(CircuitsCompileCache!.hasFileChanged(circuitPath, contentHash, { ...defaultCompileFlags, c: true })).to.be
        .true;

      expect(CircuitsCompileCache!.hasFileChanged(circuitPath, contentHash, defaultCompileFlags)).to.be.false;

      const typesDir: string = getNormalizedFullPath(this.hre.config.paths.root, "generated-types/zkit");

      fsExtra.rmSync(typesDir, { recursive: true, force: true });
    });
  });
});
