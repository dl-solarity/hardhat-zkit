import { expect } from "chai";

import { TASK_CIRCUITS_COMPILE, ZKIT_SCOPE_NAME } from "@src/task-names";

import { useEnvironment } from "@test-helpers";
import { updateProvingSystems, updateTypesDir } from "../../../utils";

describe("CircuitZKitBuilder", () => {
  const defaultTypesDir = "generated-types/zkit";

  describe("getCircuitZKit", async function () {
    const groth16PlonkTypesDir = "zkit/types-groth16-plonk";

    useEnvironment("with-circuits", true);

    it("should return correct CircuitZKit object for the 'groth16' proving system", async function () {
      await this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_CIRCUITS_COMPILE });

      const circuit = await this.hre.zkit.circuitZKitBuilder.getCircuitZKit("Multiplier2");

      expect(circuit.getProvingSystemType()).to.be.eq("groth16");
    });

    it("should throw an error if pass proving system instead of undefined", async function () {
      await this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_CIRCUITS_COMPILE });

      await expect(this.hre.zkit.circuitZKitBuilder.getCircuitZKit("Multiplier2", "groth16")).to.be.rejectedWith(
        "Found single proving system. No need to specify the exact proving system in the getCircuit function.",
      );

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
