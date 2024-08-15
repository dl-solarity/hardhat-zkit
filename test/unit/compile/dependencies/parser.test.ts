import fs from "fs";
import { expect } from "chai";

import { createNonCryptographicHashBasedIdentifier } from "hardhat/internal/util/hash";

import { useEnvironment } from "../../../helpers";
import { TASK_CIRCUITS_COMPILE, ZKIT_SCOPE_NAME } from "../../../../src/task-names";
import { CircomFilesParser } from "../../../../src/core/dependencies";
import { getNormalizedFullPath } from "../../../../src/utils/path-utils";
import { CIRCUITS_COMPILE_CACHE_FILENAME } from "../../../../src/constants";

import { CircomFileData } from "../../../../src/types/core";

describe("CircomFilesParser", () => {
  describe("parse", () => {
    let parser: CircomFilesParser;

    let circuitPath: string;
    let fileContent: string;
    let contentHash: string;

    let circuitsCacheFullPath: string;

    useEnvironment("with-circuits");

    beforeEach("setup", async function () {
      circuitsCacheFullPath = getNormalizedFullPath(this.hre.config.paths.cache, CIRCUITS_COMPILE_CACHE_FILENAME);

      parser = new CircomFilesParser();

      circuitPath = getNormalizedFullPath(this.hre.config.paths.root, "circuits/main/mul2.circom");
      fileContent = fs.readFileSync(circuitPath, "utf-8");
      contentHash = createNonCryptographicHashBasedIdentifier(Buffer.from(fileContent)).toString("hex");

      await this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_CIRCUITS_COMPILE });
    });

    it("should correctly parse file with empty circuit files cahce", async function () {
      const newParser: CircomFilesParser = new CircomFilesParser();

      const result: CircomFileData = newParser.parse(fileContent, circuitPath, contentHash);

      expect(result.includes).to.be.deep.eq(["../base/mul2Base.circom", "../base/sumMul.circom"]);
      expect(result.pragmaInfo.compilerVersion).to.be.eq("2.0.0");
    });

    it("should correctly parse circuit file content wihout cache", async function () {
      fs.rmSync(circuitsCacheFullPath, { force: true });

      const result: CircomFileData = parser.parse(fileContent, circuitPath, contentHash);

      expect(result.includes).to.be.deep.eq(["../base/mul2Base.circom", "../base/sumMul.circom"]);
      expect(result.pragmaInfo.compilerVersion).to.be.eq("2.0.0");
    });

    it("should return parsed data from the parser cache", async function () {
      fs.rmSync(circuitsCacheFullPath, { force: true });

      const result1: CircomFileData = parser.parse(fileContent, circuitPath, contentHash);
      const result2: CircomFileData = parser.parse(fileContent, circuitPath, contentHash);

      expect(result1).to.be.deep.eq(result2);
    });

    it("should get parsed data from the extension cache", async function () {
      const result: CircomFileData = parser.parse(fileContent, circuitPath, contentHash);

      expect(result.includes).to.be.deep.eq(["../base/mul2Base.circom", "../base/sumMul.circom"]);
      expect(result.pragmaInfo.compilerVersion).to.be.eq("2.0.0");
    });

    it("should correctly parse data if the content hash in cache is not equal to passed content hash", async function () {
      const result: CircomFileData = parser.parse(fileContent, circuitPath, contentHash + "1");

      expect(result.includes).to.be.deep.eq(["../base/mul2Base.circom", "../base/sumMul.circom"]);
      expect(result.pragmaInfo.compilerVersion).to.be.eq("2.0.0");
    });
  });
});
