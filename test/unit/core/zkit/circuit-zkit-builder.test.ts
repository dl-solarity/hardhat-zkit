import { expect } from "chai";

import { CircuitZKit } from "@solarity/zkit";

import { TASK_CIRCUITS_COMPILE, ZKIT_SCOPE_NAME } from "@src/task-names";

import { useEnvironment } from "@test-helpers";
import { updateProvingSystems, updateTypesDir } from "../../../utils";

describe("CircuitZKitBuilder", () => {
  const defaultTypesDir = "generated-types/zkit";

  describe("getCircuitZKit", async function () {
    describe("with ts project", async function () {
      const groth16PlonkTypesDir = "zkit/types-groth16-plonk";

      useEnvironment("with-circuits", true);

      it("should return correct CircuitZKit object for the 'groth16' proving system", async function () {
        await this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_CIRCUITS_COMPILE });

        const circuit = await this.hre.zkit.circuitZKitBuilder.getCircuitZKit("Multiplier2");

        expect(circuit.getProvingSystemType()).to.be.eq("groth16");
      });

      it("should get exception if a proving system is provided that does not match the configured one", async function () {
        await this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_CIRCUITS_COMPILE });

        await expect(this.hre.zkit.circuitZKitBuilder.getCircuitZKit("Multiplier2", "plonk")).to.be.rejectedWith(
          "Invalid proving system is passed. Please recompile the circuits or change the proving system.",
        );
      });

      it("should work correctly if pass proving system instead of undefined", async function () {
        await this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_CIRCUITS_COMPILE });

        const circuit = await this.hre.zkit.circuitZKitBuilder.getCircuitZKit("Multiplier2", "groth16");

        expect(circuit.getProvingSystemType()).to.be.eq("groth16");

        updateProvingSystems(this.hre.config.paths.configFile, ["groth16", "plonk"]);
        updateTypesDir(this.hre.config.paths.configFile, defaultTypesDir, groth16PlonkTypesDir);
      });

      it("should return correct CircuitZKit object for the 'groth16' and 'plonk' proving systems", async function () {
        await this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_CIRCUITS_COMPILE });

        let circuit = await this.hre.zkit.circuitZKitBuilder.getCircuitZKit("Multiplier2", "groth16");

        expect(circuit.getProvingSystemType()).to.be.eq("groth16");

        circuit = await this.hre.zkit.circuitZKitBuilder.getCircuitZKit("Multiplier2", "plonk");

        expect(circuit.getProvingSystemType()).to.be.eq("plonk");
      });

      it("should throw an error if pass undefined proving system with several proving systems", async function () {
        await this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_CIRCUITS_COMPILE });

        await expect(this.hre.zkit.circuitZKitBuilder.getCircuitZKit("Multiplier2")).to.be.rejectedWith(
          "Found several proving systems. Please specify the exact proving system in the getCircuit function.",
        );

        updateProvingSystems(this.hre.config.paths.configFile, ["groth16"]);
        updateTypesDir(this.hre.config.paths.configFile, groth16PlonkTypesDir, defaultTypesDir);
      });
    });

    describe("with js project", async function () {
      useEnvironment("js-with-circuits", true, true, false);

      it("should return correct CircuitZKit object for the 'groth16' proving system", async function () {
        await this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_CIRCUITS_COMPILE });

        const circuit = await this.hre.zkit.circuitZKitBuilder.getCircuitZKit("Multiplier2");

        expect(circuit.getProvingSystemType()).to.be.eq("groth16");
        expect(circuit instanceof CircuitZKit).to.be.true;
      });

      it("should get exception if a proving system is provided that does not match the configured one", async function () {
        await this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_CIRCUITS_COMPILE });

        await expect(this.hre.zkit.circuitZKitBuilder.getCircuitZKit("Multiplier2", "plonk")).to.be.rejectedWith(
          "Invalid proving system is passed. Please recompile the circuits or change the proving system.",
        );
      });

      it("should work correctly if pass proving system instead of undefined", async function () {
        await this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_CIRCUITS_COMPILE });

        const circuit = await this.hre.zkit.circuitZKitBuilder.getCircuitZKit("Multiplier2", "groth16");

        expect(circuit.getProvingSystemType()).to.be.eq("groth16");

        updateProvingSystems(this.hre.config.paths.configFile, ["groth16", "plonk"]);
        expect(circuit instanceof CircuitZKit).to.be.true;
      });

      it("should return correct CircuitZKit object for the 'groth16' and 'plonk' proving systems", async function () {
        await this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_CIRCUITS_COMPILE });

        let circuit = await this.hre.zkit.circuitZKitBuilder.getCircuitZKit("Multiplier2", "groth16");

        expect(circuit.getProvingSystemType()).to.be.eq("groth16");
        expect(circuit instanceof CircuitZKit).to.be.true;

        circuit = await this.hre.zkit.circuitZKitBuilder.getCircuitZKit("Multiplier2", "plonk");

        expect(circuit.getProvingSystemType()).to.be.eq("plonk");
        expect(circuit instanceof CircuitZKit).to.be.true;
      });

      it("should throw an error if pass undefined proving system with several proving systems", async function () {
        await this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_CIRCUITS_COMPILE });

        await expect(this.hre.zkit.circuitZKitBuilder.getCircuitZKit("Multiplier2")).to.be.rejectedWith(
          "Found several proving systems. Please specify the exact proving system in the getCircuit function.",
        );

        updateProvingSystems(this.hre.config.paths.configFile, ["groth16"]);
      });
    });
  });

  describe("getProtocolImplementer", async function () {
    useEnvironment("with-circuits", true);

    it("should return correct protocol implementers", async function () {
      let protocolImplementer = this.hre.zkit.circuitZKitBuilder.getProtocolImplementer("groth16");

      expect(protocolImplementer.getProvingSystemType()).to.be.eq("groth16");

      protocolImplementer = this.hre.zkit.circuitZKitBuilder.getProtocolImplementer("plonk");

      expect(protocolImplementer.getProvingSystemType()).to.be.eq("plonk");

      protocolImplementer = this.hre.zkit.circuitZKitBuilder.getProtocolImplementer("groth16");

      expect(protocolImplementer.getProvingSystemType()).to.be.eq("groth16");
    });

    it("should get exception if pass invalid proving system", async function () {
      const invalidProvingSystem = "some";
      const circuitZKitBuilder = this.hre.zkit.circuitZKitBuilder;

      expect(function () {
        circuitZKitBuilder.getProtocolImplementer(invalidProvingSystem);
      }).to.throw(`Unsupported proving system - ${invalidProvingSystem}`);
    });
  });
});
