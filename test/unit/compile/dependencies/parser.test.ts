import fs from "fs";
import { expect } from "chai";

import { createNonCryptographicHashBasedIdentifier } from "hardhat/internal/util/hash";

import { useEnvironment } from "../../../helpers";
import { Parser } from "../../../../src/compile/dependencies";
import { getNormalizedFullPath } from "../../../../src/utils/path-utils";
import { CIRCUITS_COMPILE_CACHE_FILENAME } from "../../../../src/constants";
import { TASK_CIRCUITS_COMPILE_SHALLOW } from "../../../../src/task-names";
import { ParsedData } from "../../../../src/types/compile";

describe("Parser", () => {
  describe("parse", () => {
    let parser: Parser;

    let circuitPath: string;
    let fileContent: string;
    let contentHash: string;

    let circuitsCacheFullPath: string;

    useEnvironment("with-circuits");

    beforeEach("setup", async function () {
      circuitsCacheFullPath = getNormalizedFullPath(this.hre.config.paths.cache, CIRCUITS_COMPILE_CACHE_FILENAME);

      parser = new Parser();

      circuitPath = getNormalizedFullPath(this.hre.config.paths.root, "circuits/main/mul2.circom");
      fileContent = fs.readFileSync(circuitPath, "utf-8");
      contentHash = createNonCryptographicHashBasedIdentifier(Buffer.from(fileContent)).toString("hex");

      await this.hre.run(TASK_CIRCUITS_COMPILE_SHALLOW);
    });

    it("should correctly parse file with empty circuit files cahce", async function () {
      const newParser: Parser = new Parser();

      const result: ParsedData = newParser.parse(fileContent, circuitPath, contentHash);

      expect(result.imports).to.be.deep.eq(["../base/mul2Base.circom", "../base/sumMul.circom"]);
      expect(result.versionPragmas).to.be.deep.eq(["2.0.0"]);
    });

    it("should correctly parse circuit file content wihout cache", async function () {
      fs.rmSync(circuitsCacheFullPath, { force: true });

      const result: ParsedData = parser.parse(fileContent, circuitPath, contentHash);

      expect(result.imports).to.be.deep.eq(["../base/mul2Base.circom", "../base/sumMul.circom"]);
      expect(result.versionPragmas).to.be.deep.eq(["2.0.0"]);
    });

    it("should return parsed data from the parser cache", async function () {
      fs.rmSync(circuitsCacheFullPath, { force: true });

      const result1: ParsedData = parser.parse(fileContent, circuitPath, contentHash);
      const result2: ParsedData = parser.parse(fileContent, circuitPath, contentHash);

      expect(result1).to.be.deep.eq(result2);
    });

    it("should get parsed data from the extension cache", async function () {
      const result: ParsedData = parser.parse(fileContent, circuitPath, contentHash);

      expect(result.imports).to.be.deep.eq(["../base/mul2Base.circom", "../base/sumMul.circom"]);
      expect(result.versionPragmas).to.be.deep.eq(["2.0.0"]);
    });

    it("should correctly parse data if the content hash in cache is not equal to passed content hash", async function () {
      const result: ParsedData = parser.parse(fileContent, circuitPath, contentHash + "1");

      expect(result.imports).to.be.deep.eq(["../base/mul2Base.circom", "../base/sumMul.circom"]);
      expect(result.versionPragmas).to.be.deep.eq(["2.0.0"]);
    });
  });
});
