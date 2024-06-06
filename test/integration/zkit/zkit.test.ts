import fs from "fs";

import { expect } from "chai";

import { useEnvironment } from "../../helpers";
import { CircuitInfo, CircuitZKit } from "@solarity/zkit";
import { TASK_CIRCUITS_COMPILE, TASK_GENERATE_VERIFIERS } from "../../../src/tasks/task-names";

describe("zkit", () => {
  describe("full proof generation flow", () => {
    useEnvironment("with-circuits");

    beforeEach("preparation", async function () {
      fs.rmSync("contracts/verifiers", { recursive: true, force: true });
      fs.rmSync("zkit", { recursive: true, force: true });

      expect(fs.existsSync("zkit")).to.be.false;
      expect(fs.existsSync("contracts/verifiers")).to.be.false;

      await this.hre.run(TASK_CIRCUITS_COMPILE);
      await this.hre.run(TASK_GENERATE_VERIFIERS);

      expect(fs.existsSync("zkit")).to.be.true;
      expect(fs.existsSync("contracts/verifiers")).to.be.true;
    });

    it("should correctly generate and verify proof", async function () {
      const mul2Circuit: CircuitZKit = await this.hre.zkit.getCircuit("mul2");

      const in1 = 30;
      const in2 = 40;

      const proof = await mul2Circuit.generateProof({ in1, in2 });

      expect(await mul2Circuit.verifyProof(proof)).to.be.true;
    });

    it("should correctly generate proof and send transaction", async function () {
      const Mul2VerifierFactory = await this.hre.ethers.getContractFactory("mul2Verifier");
      const Mul2ProofVerifierFactory = await this.hre.ethers.getContractFactory("Mul2ProofVerifier");

      const sender = (await this.hre.ethers.getSigners())[0];

      const verifier = await Mul2VerifierFactory.deploy();
      const mul2ProofVerifier = await Mul2ProofVerifierFactory.deploy(await verifier.getAddress());

      const mul2Circuit: CircuitZKit = await this.hre.zkit.getCircuit("mul2");

      const in1 = 30;
      const in2 = 40;

      const proof = await mul2Circuit.generateProof({ in1, in2 });

      const generatedCalldata = await mul2Circuit.generateCalldata(proof);

      await mul2ProofVerifier.verifyProof(
        generatedCalldata[0],
        generatedCalldata[1],
        generatedCalldata[2],
        generatedCalldata[3],
      );

      expect(await mul2ProofVerifier.isVerified(sender)).to.be.true;
    });

    it("should correctly generate proof with array field and send transaction", async function () {
      const Mul3ArrVerifierFactory = await this.hre.ethers.getContractFactory("mul3ArrVerifier");
      const Mul3ArrProofVerifierFactory = await this.hre.ethers.getContractFactory("Mul3ArrProofVerifier");

      const sender = (await this.hre.ethers.getSigners())[0];

      const verifier = await Mul3ArrVerifierFactory.deploy();
      const mul3ArrProofVerifier = await Mul3ArrProofVerifierFactory.deploy(await verifier.getAddress());

      const mul3Circuit: CircuitZKit = await this.hre.zkit.getCircuit("mul3Arr");

      const expectedPubSignal = 30 * 40 * 50;
      const proof = await mul3Circuit.generateProof({ in: [30, 40, 50] });

      expect(proof.publicSignals[0]).to.be.eq(expectedPubSignal.toString());

      const generatedCalldata = await mul3Circuit.generateCalldata(proof);

      await mul3ArrProofVerifier.verifyProof(
        generatedCalldata[0],
        generatedCalldata[1],
        generatedCalldata[2],
        generatedCalldata[3],
      );

      expect(await mul3ArrProofVerifier.isVerified(sender)).to.be.true;
    });
  });

  describe("getCircuit", () => {
    useEnvironment("with-circuits");

    it("should correctly get circuit instance", async function () {
      const mul2Circuit: CircuitZKit = await this.hre.zkit.getCircuit("mul2");

      expect(mul2Circuit.getCircuitId()).to.be.eq("mul2");
      expect(mul2Circuit.getVerifierId()).to.be.eq("mul2Verifier");
    });

    it("should get exception if try to get non-existent circuit", async function () {
      const circuitName = "someCircuit";
      const reason = `Circuit '${circuitName}' does not exist`;

      await expect(this.hre.zkit.getCircuit(circuitName)).to.be.rejectedWith(reason);
    });

    it("should get exception if try to get circuit without main component", async function () {
      const circuitName = "mul2Base";
      const reason = `Circuit '${circuitName}' does not have a main component definition`;

      await expect(this.hre.zkit.getCircuit(circuitName)).to.be.rejectedWith(reason);
    });
  });

  describe("getCircuitsInfo", () => {
    useEnvironment("with-circuits");

    it("should return correct circuits info", async function () {
      const expectedCircuitsInfo: CircuitInfo[] = [
        { path: "base/mul2Base.circom", id: "mul2Base" },
        { path: "base/sumMul.circom", id: null },
        { path: "main/mul2/mul2.circom", id: "mul2" },
        { path: "main/mul3Arr/mul3Arr.circom", id: "mul3Arr" },
        { path: "vendor/sumMul.circom", id: null },
      ];

      const circuitsInfo = this.hre.zkit.getCircuitsInfo();

      expect(expectedCircuitsInfo).to.be.deep.eq(circuitsInfo);
    });
  });
});
