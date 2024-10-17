import fs from "fs";
import { expect } from "chai";

import { createNonCryptographicHashBasedIdentifier } from "hardhat/internal/util/hash";

import { useEnvironment } from "@test-helpers";
import { CircomFilesParser } from "@src/core";
import { TASK_CIRCUITS_COMPILE, ZKIT_SCOPE_NAME } from "@src/task-names";
import { getNormalizedFullPath } from "@src/utils/path-utils";
import { CIRCUITS_COMPILE_CACHE_FILENAME } from "@src/constants";
import { createCircuitsCompileCache } from "@src/cache";
import { createReporter } from "@src/reporter";

import { ResolvedFileData, ResolvedMainComponentData } from "@src/types/core";

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

      const result: ResolvedFileData = newParser.parse(fileContent, circuitPath, contentHash);

      expect(result.parsedFileData.includes).to.be.deep.eq(["../base/mul2Base.circom", "../base/sumMul.circom"]);
      expect(result.parsedFileData.pragmaInfo.compilerVersion).to.be.eq("2.0.0");
    });

    it("should correctly parse circuit file content wihout cache", async function () {
      fs.rmSync(circuitsCacheFullPath, { force: true });

      const result: ResolvedFileData = parser.parse(fileContent, circuitPath, contentHash);

      expect(result.parsedFileData.includes).to.be.deep.eq(["../base/mul2Base.circom", "../base/sumMul.circom"]);
      expect(result.parsedFileData.pragmaInfo.compilerVersion).to.be.eq("2.0.0");
    });

    it("should return parsed data from the parser cache", async function () {
      fs.rmSync(circuitsCacheFullPath, { force: true });

      const result1: ResolvedFileData = parser.parse(fileContent, circuitPath, contentHash);
      const result2: ResolvedFileData = parser.parse(fileContent, circuitPath, contentHash);

      expect(result1).to.be.deep.eq(result2);
    });

    it("should get parsed data from the extension cache", async function () {
      const result: ResolvedFileData = parser.parse(fileContent, circuitPath, contentHash);

      expect(result.parsedFileData.includes).to.be.deep.eq(["../base/mul2Base.circom", "../base/sumMul.circom"]);
      expect(result.parsedFileData.pragmaInfo.compilerVersion).to.be.eq("2.0.0");
    });

    it("should correctly parse data if the content hash in cache is not equal to passed content hash", async function () {
      const result: ResolvedFileData = parser.parse(fileContent, circuitPath, contentHash + "1");

      expect(result.parsedFileData.includes).to.be.deep.eq(["../base/mul2Base.circom", "../base/sumMul.circom"]);
      expect(result.parsedFileData.pragmaInfo.compilerVersion).to.be.eq("2.0.0");
    });

    it("should correctly parse data and resolve var definitions and if statements", async function () {
      const mainComponentData: ResolvedMainComponentData = {
        parameters: {
          SIGNATURE_TYPE: 8n,
          DG_HASH_TYPE: 8n,
          DOCUMENT_TYPE: 512n,
          EC_BLOCK_NUMBER: 256n,
          EC_SHIFT: 2n,
          DG1_SHIFT: 0n,
          AA_SIGNATURE_ALGO: 17n,
          DG15_SHIFT: 64n,
          DG15_BLOCK_NUMBER: 64n,
          AA_SHIFT: 256n,
        },
        signals: [],
      };

      const testFilePath = getNormalizedFullPath(this.hre.config.paths.root, "circuits/main/curve.circom");

      const result = parser.parseTemplateInputs(testFilePath, "RegisterIdentityBuilder", mainComponentData.parameters);

      expect(result["encapsulatedContent"].dimension).to.be.deep.equal([String(256n * 512n)]);
      expect(result["dg1"].dimension).to.be.deep.equal(["1024"]);
      expect(result["dg15"].dimension).to.be.deep.equal([String(64n * 512n)]);
      expect(result["signedAttributes"].dimension).to.be.deep.equal(["1024"]);
      expect(result["signature"].dimension).to.be.deep.equal(["32"]);
      expect(result["pubkey"].dimension).to.be.deep.equal(["32"]);
      expect(result["slaveMerkleInclusionBranches"].dimension).to.be.deep.equal(["80"]);
    });
  });

  describe("invalid parse", () => {
    useEnvironment("with-complex-circuits");

    it("should get exception if circuit has function call inside main component parameters", async function () {
      createReporter(true);
      await createCircuitsCompileCache(undefined);

      const parser = new CircomFilesParser();

      const circuitPath = getNormalizedFullPath(this.hre.config.paths.root, "circuits/mul3Arr.circom");
      const fileContent = fs.readFileSync(circuitPath, "utf-8");
      const contentHash = createNonCryptographicHashBasedIdentifier(Buffer.from(fileContent)).toString("hex");

      expect(function () {
        parser.parse(fileContent, circuitPath, contentHash);
      }).to.throw("Expression value must be of type bigint or bigint array (16:32)");
    });
  });
});
