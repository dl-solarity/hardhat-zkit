import fs from "fs";
import { expect } from "chai";

import { getCircomParser, VariableContext, ParseTreeVisitor } from "@tawny0wl/test-circom-parser";

import { useEnvironment } from "../../../helpers.js";
import { CircomFilesParser } from "../../../../src/core/resolve/parser/CircomFilesParser.js";
import { getNormalizedFullPath } from "../../../../src/utils/path-utils.js";
import { CIRCUITS_COMPILE_CACHE_FILENAME } from "../../../../src/constants.js";
import { TASK_CIRCUITS_COMPILE, ZKIT_SCOPE_NAME } from "../../../../src/task-names.js";
import { ResolvedFileData } from "../../../../src/types/core/dependencies/circom-files-resolver.js";
import { CircomFilesVisitor } from "../../../../src/core/resolve/parser/CircomFilesVisitor.js";
import { CircomTemplateInputsVisitor } from "../../../../src/core/resolve/parser/CircomTemplateInputsVisitor.js";
import { CircomResolvedFile } from "../../../../src/core/resolve/CircomFilesResolver.js";
import { BaseCacheType } from "../../../../src/types/cache/base-cache.js";
import { createReporter } from "../../../../src/reporter/ReporterFacade.js";
import { createCircuitsCompileCache } from "../../../../src/cache/CircuitsCompileCache.js";

describe("CircomFilesParser", () => {
  describe("parse", () => {
    let parser: CircomFilesParser;

    let circuitPath: string;
    let fileContent: string;
    let contentHash: string;

    let circuitsCacheFullPath: string;

    useEnvironment({ fixtureProjectName: "with-circuits" });

    beforeEach("setup", async function () {
      circuitsCacheFullPath = getNormalizedFullPath(this.hre.config.paths.cache, CIRCUITS_COMPILE_CACHE_FILENAME);

      parser = new CircomFilesParser();

      circuitPath = getNormalizedFullPath(this.hre.config.paths.root, "circuits/main/mul2.circom");
      fileContent = fs.readFileSync(circuitPath, "utf-8");
      contentHash = createNonCryptographicHashBasedIdentifier(Buffer.from(fileContent)).toString("hex");

      await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_COMPILE]).run({});
    });

    it("should correctly parse file with empty circuit files cache", async function () {
      const newParser: CircomFilesParser = new CircomFilesParser();

      const result: ResolvedFileData = newParser.parse(fileContent, circuitPath, contentHash);

      expect(result.parsedFileData.includes).to.be.deep.eq(["../base/mul2Base.circom", "../base/sumMul.circom"]);
      expect(result.parsedFileData.pragmaInfo.compilerVersion).to.be.eq("2.0.0");
    });

    it("should correctly parse circuit file content without cache", async function () {
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
      const mainComponentData: VariableContext = {
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
      };

      const testFilePath = getNormalizedFullPath(this.hre.config.paths.root, "circuits/main/curve.circom");

      const visitor = new CircomFilesVisitor(testFilePath);

      const parser = getCircomParser(testFilePath);

      (visitor as ParseTreeVisitor).visit(parser.circuit());

      const circomTemplateInputsVisitor = new CircomTemplateInputsVisitor(
        testFilePath,
        visitor.fileData.templates["RegisterIdentityBuilder"].context,
        mainComponentData,
      );

      circomTemplateInputsVisitor.startParse();

      const result = circomTemplateInputsVisitor.templateInputs;

      expect(result["encapsulatedContent"].dimension).to.be.deep.equal([256 * 512]);
      expect(result["dg1"].dimension).to.be.deep.equal([1024]);
      expect(result["dg15"].dimension).to.be.deep.equal([64 * 512]);
      expect(result["signedAttributes"].dimension).to.be.deep.equal([1024]);
      expect(result["signature"].dimension).to.be.deep.equal([32]);
      expect(result["pubkey"].dimension).to.be.deep.equal([32]);
      expect(result["slaveMerkleInclusionBranches"].dimension).to.be.deep.equal([80]);
    });
  });

  describe("parse with resolution of main component", () => {
    useEnvironment({ fixtureProjectName: "with-circuits-main-component" });

    beforeEach("setup", async function () {
      await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_COMPILE]).run({});
    });

    it("should correctly resolve the arguments for the main component", async function () {
      const circuitPath = getNormalizedFullPath(this.hre.config.paths.root, "circuits/base/SomeCircuit.circom");
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const cache: BaseCacheType<CircomResolvedFile> = require(
        getNormalizedFullPath(this.hre.config.paths.root, "cache/circuits-compile-cache.json"),
      );

      const signals = cache.files[circuitPath].fileData.mainComponentData!.signals;

      const signalIn1 = signals.find((signal: { name: string }) => signal.name === "in1")!;
      const signalIn2 = signals.find((signal: { name: string }) => signal.name === "in2")!;
      const signalOut = signals.find((signal: { name: string }) => signal.name === "out")!;

      expect(signalIn1.dimension).to.deep.equal([]);
      expect(signalIn2.dimension).to.deep.equal([15, 30]);
      expect(signalOut.dimension).to.deep.equal([]);
    });
  });

  describe("invalid parse", () => {
    useEnvironment({ fixtureProjectName: "with-complex-circuits" });

    it("should get exception if circuit has function call inside main component parameters", async function () {
      createReporter(true);
      await createCircuitsCompileCache(undefined);

      const parser = new CircomFilesParser();

      const circuitPath = getNormalizedFullPath(this.hre.config.paths.root, "circuits/mul3Arr.circom");
      const fileContent = fs.readFileSync(circuitPath, "utf-8");
      const contentHash = createNonCryptographicHashBasedIdentifier(Buffer.from(fileContent)).toString("hex");

      expect(function () {
        parser.parse(fileContent, circuitPath, contentHash);
      }).to.throw("Failed to parse array parameter with index 0. Parameter: getValue() (16:32)");
    });
  });
});

export function createNonCryptographicHashBasedIdentifier(input: Buffer): Buffer {
  const { createHash } = require("crypto");

  return createHash("md5").update(input).digest();
}
