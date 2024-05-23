import fs from "fs";
import { expect } from "chai";

import { CircomZKitManager } from "../../src/zkit/CircomZKitManager";
import { useEnvironment } from "../helpers";
import { CircuitInfo, CircuitZKit } from "@solarity/zkit";

describe("CircomZKitManager", () => {
  describe("compile", () => {
    let circomZKitManager: CircomZKitManager;

    useEnvironment("with-circuits");

    beforeEach("setup", async function () {
      circomZKitManager = new CircomZKitManager(this.hre);
    });

    it("should correctly compile contracts", async () => {
      await circomZKitManager.compile();

      expect(fs.existsSync("zkit/artifacts/main/mul2/mul2.circom")).to.be.true;
      expect(fs.existsSync("zkit/artifacts/main/mul3Arr/mul3Arr.circom")).to.be.true;

      expect(fs.existsSync("zkit/artifacts/vendor")).to.be.false;
      expect(fs.existsSync("zkit/artifacts/base")).to.be.false;
    });
  });

  describe("generateVerifiers", () => {
    let circomZKitManager: CircomZKitManager;

    useEnvironment("with-circuits");

    beforeEach("setup", async function () {
      fs.rmSync("zkit", { recursive: true, force: true });
      fs.rmSync("contracts/verifiers", { recursive: true, force: true });

      circomZKitManager = new CircomZKitManager(this.hre);
    });

    it("should correctly generate verifiers", async () => {
      await circomZKitManager.compile();

      expect(fs.existsSync("contracts/verifiers/main/mul2/mul2Verifier.sol")).to.be.false;

      await circomZKitManager.generateVerifiers();

      expect(fs.existsSync("contracts/verifiers/main/mul2/mul2Verifier.sol")).to.be.true;
    });

    it("should get exception if try to generate verifiers without compilation", async () => {
      const reason = `Circuit 'mul2' was not compiled yet. Please compile circuits and try again`;

      await expect(circomZKitManager.generateVerifiers()).to.be.rejectedWith(reason);
    });
  });

  describe("getCircuit", () => {
    let circomZKitManager: CircomZKitManager;

    useEnvironment("with-circuits");

    beforeEach("setup", async function () {
      circomZKitManager = new CircomZKitManager(this.hre);
    });

    it("should correctly return circuit instance", async () => {
      const mul2Circuit: CircuitZKit = await circomZKitManager.getCircuit("mul2");

      expect(mul2Circuit.getCircuitId()).to.be.eq("mul2");
      expect(mul2Circuit.getVerifierId()).to.be.eq("mul2Verifier");
    });

    it("should get exception if try to get non-existent circuit", async () => {
      const circuitName = "someCircuit";
      const reason = `Circuit '${circuitName}' does not exist`;

      await expect(circomZKitManager.getCircuit(circuitName)).to.be.rejectedWith(reason);
    });

    it("should get exception if try to get circuit without main component", async () => {
      const circuitName = "mul2Base";
      const reason = `Circuit '${circuitName}' does not have a main component definition`;

      await expect(circomZKitManager.getCircuit(circuitName)).to.be.rejectedWith(reason);
    });
  });

  describe("getCircuitsInfo", () => {
    let circomZKitManager: CircomZKitManager;

    useEnvironment("with-circuits");

    beforeEach("setup", async function () {
      circomZKitManager = new CircomZKitManager(this.hre);
    });

    it("should return correct circuits info", async function () {
      const expectedCircuitsInfo: CircuitInfo[] = [
        { path: "base/mul2Base.circom", id: "mul2Base" },
        { path: "base/sumMul.circom", id: null },
        { path: "main/mul2/mul2.circom", id: "mul2" },
        { path: "main/mul3Arr/mul3Arr.circom", id: "mul3Arr" },
        { path: "vendor/sumMul.circom", id: null },
      ];

      const circuitsInfo = circomZKitManager.getCircuitsInfo();

      expect(expectedCircuitsInfo).to.be.deep.eq(circuitsInfo);
    });
  });
});
