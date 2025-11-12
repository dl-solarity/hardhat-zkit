import fsExtra from "fs-extra";
import { expect } from "chai";

import { useEnvironment } from "../../helpers.js";
import { getCompileCacheEntry } from "../../utils.js";

import {
  CircuitsCompileCache,
  createCircuitsCompileCache,
  resetCircuitsCompileCache,
} from "../../../src/cache/CircuitsCompileCache.js";

import { CompileCacheEntry } from "../../../src/types/cache/circuits-compile-cache.js";
import { getNormalizedFullPath } from "../../../src/utils/path-utils.js";
import { getFileHash } from "../../../src/utils/utils.js";

import { CIRCUIT_COMPILE_CACHE_VERSION, CIRCUITS_COMPILE_CACHE_FILENAME } from "../../../src/constants.js";
import { TASK_CIRCUITS_COMPILE, TASK_CIRCUITS_MAKE, ZKIT_SCOPE_NAME } from "../../../src/task-names.js";
import { defaultCompileFlags } from "../../constants.js";

describe("CircuitsCompileCache", () => {
  describe("createEmpty", () => {
    it("should correctly create empty CircuitsCompileCache instance", async () => {
      resetCircuitsCompileCache();

      await createCircuitsCompileCache(undefined);

      expect(CircuitsCompileCache!.constructor.name).to.be.eq("BaseCircuitsCompileCache");
      expect(Object.values(CircuitsCompileCache!)[2]._format).to.be.eq(CIRCUIT_COMPILE_CACHE_VERSION);
    });
  });

  describe("readFromFile", () => {
    useEnvironment({
      fixtureProjectName: "with-circuits",
    });

    it("should correctly create CircuitsCompileCache instance from file", async function () {
      CircuitsCompileCache!.getEntries().forEach(async (entry: CompileCacheEntry) => {
        expect(entry).to.be.deep.eq(await getCompileCacheEntry(this.hre.config.paths.root, entry.sourceName));
      });
    });

    it("should correctly create CircuitsCompileCache instance and remove non existing files", async function () {
      await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_COMPILE]).run({});

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
    useEnvironment({
      fixtureProjectName: "with-circuits",
    });

    it("should return correct results", async function () {
      await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_COMPILE]).run({});

      expect(CircuitsCompileCache!.hasFileChanged("invalid-path", "", defaultCompileFlags)).to.be.true;

      const circuitPath = getNormalizedFullPath(this.hre.config.paths.root, "circuits/main/mul2.circom");
      const contentHash = await getFileHash(circuitPath);

      expect(CircuitsCompileCache!.hasFileChanged(circuitPath, contentHash + "1", defaultCompileFlags)).to.be.true;
      expect(CircuitsCompileCache!.hasFileChanged(circuitPath, contentHash, { ...defaultCompileFlags, c: true })).to.be
        .true;

      expect(CircuitsCompileCache!.hasFileChanged(circuitPath, contentHash, defaultCompileFlags)).to.be.false;

      const typesDir: string = getNormalizedFullPath(this.hre.config.paths.root, "generated-types/zkit");

      fsExtra.rmSync(typesDir, { recursive: true, force: true });
    });
  });

  describe("context-caching", () => {
    useEnvironment({
      fixtureProjectName: "with-circuits",
      withCleanUp: true,
    });

    it("should correctly cache the context", async function () {
      await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_MAKE]).run({});

      const mockCircuitSourcePath = getNormalizedFullPath(this.hre.config.paths.root, "mock-circuits/newMul2.circom");
      const mockCircuitDestinationPath = getNormalizedFullPath(this.hre.config.paths.root, "circuits/newMul2.circom");

      fsExtra.copyFileSync(mockCircuitSourcePath, mockCircuitDestinationPath);

      await expect(this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_MAKE]).run()).to.be.fulfilled;

      fsExtra.rmSync(mockCircuitDestinationPath);
    });
  });
});
