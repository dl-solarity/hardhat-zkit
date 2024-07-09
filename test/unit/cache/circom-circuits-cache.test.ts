import fsExtra from "fs-extra";

import { expect } from "chai";

import { createNonCryptographicHashBasedIdentifier } from "hardhat/internal/util/hash";

import { useEnvironment } from "../../helpers";
import { CircomCircuitsCache, resetCircuitsCache, createCircuitsCache } from "../../../src/cache/CircomCircuitsCache";
import { getNormalizedFullPath } from "../../../src/utils/path-utils";
import { CIRCOM_CIRCUITS_CACHE_FILENAME, FORMAT_VERSION } from "../../../src/constants";
import { TASK_CIRCUITS_COMPILE } from "../../../src/task-names";
import { CacheEntry, CompileFlags } from "../../../src/types/compile";

describe("CircomCircuitsCache", () => {
  const defaultCompileFlags: CompileFlags = {
    r1cs: true,
    wasm: true,
    c: false,
    json: false,
    sym: false,
  };

  async function getCacheEntry(
    projectRoot: string,
    sourceName: string,
    imports: string[],
    compileFlags: CompileFlags = defaultCompileFlags,
    versionPragmas: string[] = ["2.0.0"],
    contentHash?: string,
  ): Promise<CacheEntry> {
    const circuitPath = getNormalizedFullPath(projectRoot, sourceName);
    const fileContent = fsExtra.readFileSync(circuitPath, "utf-8");

    if (!contentHash) {
      contentHash = createNonCryptographicHashBasedIdentifier(Buffer.from(fileContent)).toString("hex");
    }

    const stats = await fsExtra.stat(circuitPath);
    const lastModificationDate: Date = new Date(stats.ctime);

    return {
      sourceName,
      contentHash,
      lastModificationDate: lastModificationDate.valueOf(),
      compileFlags,
      versionPragmas,
      imports,
    };
  }

  describe("createEmpty", () => {
    it("should correctly create empty CircomCircuitsCache instance", async () => {
      resetCircuitsCache();

      await createCircuitsCache(undefined);

      expect(CircomCircuitsCache!.constructor.name).to.be.eq("BaseCircomCircuitsCache");
      expect(Object.values(CircomCircuitsCache!)[0]._format).to.be.eq(FORMAT_VERSION);
    });
  });

  describe("readFromFile", () => {
    useEnvironment("with-circuits");

    it("should correctly create CircomCircuitsCache instance from file", async function () {
      CircomCircuitsCache!.getEntries().forEach(async (entry: CacheEntry) => {
        expect(entry).to.be.deep.eq(await getCacheEntry(this.hre.config.paths.root, entry.sourceName, entry.imports));
      });
    });

    it("should correctly create CircomCircuitsCache instance and remove non existing files", async function () {
      await this.hre.run(TASK_CIRCUITS_COMPILE);

      const circuitsCacheFullPath: string = getNormalizedFullPath(
        this.hre.config.paths.cache,
        CIRCOM_CIRCUITS_CACHE_FILENAME,
      );

      const circuitAbsolutePath: string = getNormalizedFullPath(
        this.hre.config.paths.root,
        "circuits/main/mul2.circom",
      );
      const typesDir: string = getNormalizedFullPath(this.hre.config.paths.root, "generated-types/zkit");

      const fileContent: string = fsExtra.readFileSync(circuitAbsolutePath, "utf-8");

      fsExtra.rmSync(circuitAbsolutePath);

      resetCircuitsCache();
      await createCircuitsCache(circuitsCacheFullPath);

      expect(CircomCircuitsCache!.getEntry(circuitAbsolutePath)).to.be.undefined;

      fsExtra.writeFileSync(circuitAbsolutePath, fileContent);
      fsExtra.rmSync(typesDir, { recursive: true, force: true });
    });

    it("should return empty CircomCircuitsCache instance if pass invalid cache file", async function () {
      const invalidCacheFullPath = getNormalizedFullPath(this.hre.config.paths.cache, "invalid-cache.json");

      fsExtra.writeFileSync(invalidCacheFullPath, JSON.stringify({ a: 1, b: 2 }));

      resetCircuitsCache();
      await createCircuitsCache(invalidCacheFullPath);

      expect(CircomCircuitsCache!.getEntries()).to.be.deep.eq([]);

      fsExtra.rmSync(invalidCacheFullPath);
    });

    it("should return empty CircomCircuitsCache instance if pass invalid cache file path", async function () {
      const invalidCacheFullPath = getNormalizedFullPath(this.hre.config.paths.cache, "invalid-cache.json");

      resetCircuitsCache();
      await createCircuitsCache(invalidCacheFullPath);

      expect(CircomCircuitsCache!.getEntries()).to.be.deep.eq([]);
    });
  });

  describe("hasFileChanged", () => {
    useEnvironment("with-circuits");

    it("should return correct results", async function () {
      await this.hre.run(TASK_CIRCUITS_COMPILE);

      expect(CircomCircuitsCache!.hasFileChanged("invalid-path", "", defaultCompileFlags)).to.be.true;

      const circuitPath = getNormalizedFullPath(this.hre.config.paths.root, "circuits/main/mul2.circom");
      const fileContent = fsExtra.readFileSync(circuitPath, "utf-8");
      const contentHash = createNonCryptographicHashBasedIdentifier(Buffer.from(fileContent)).toString("hex");

      expect(CircomCircuitsCache!.hasFileChanged(circuitPath, contentHash + "1", defaultCompileFlags)).to.be.true;
      expect(CircomCircuitsCache!.hasFileChanged(circuitPath, contentHash, { ...defaultCompileFlags, c: true })).to.be
        .true;

      expect(CircomCircuitsCache!.hasFileChanged(circuitPath, contentHash, defaultCompileFlags)).to.be.false;

      const typesDir: string = getNormalizedFullPath(this.hre.config.paths.root, "generated-types/zkit");

      fsExtra.rmSync(typesDir, { recursive: true, force: true });
    });
  });
});
