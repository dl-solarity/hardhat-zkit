import { useEnvironment } from "@test-helpers";
import { TASK_CIRCUITS_MAKE, ZKIT_SCOPE_NAME } from "../../../../src/task-names";
import fsExtra from "fs-extra";
import path from "path";
import { CircuitArtifact } from "../../../../src/types/artifacts/circuit-artifacts";
import { expect } from "chai";
import { HardhatRuntimeEnvironment } from "hardhat/types";

describe.only("Types Generation", () => {
  describe("types generation:with duplicated main components", () => {
    useEnvironment("with-duplicated-circuits");

    beforeEach(async function () {
      await this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_CIRCUITS_MAKE });
    });

    function getCircuitArtifact(hre: HardhatRuntimeEnvironment, pathToCircuit: string): CircuitArtifact {
      return JSON.parse(fsExtra.readFileSync(path.join(hre.config.paths.root, pathToCircuit)) as any);
    }

    it("should correctly resolve dimensions for circuits with multiple main components", async function () {
      const artifact1: CircuitArtifact = getCircuitArtifact(
        this.hre,
        "zkit/artifacts/circuits/mul3Arr.circom/Multiplier3Arr_artifacts.json",
      );
      const artifact2: CircuitArtifact = getCircuitArtifact(
        this.hre,
        "zkit/artifacts/circuits/mul3Arr2.circom/Multiplier3Arr_artifacts.json",
      );

      expect(artifact1.baseCircuitInfo.signals[0].dimension).to.be.deep.eq([3]);
      expect(artifact2.baseCircuitInfo.signals[0].dimension).to.be.deep.eq([6]);
    });

    it.only("should correctly resolve dimensions for circuits with multiple main components from cache", async function () {
      fsExtra.removeSync(path.join(this.hre.config.paths.root, "generated-types"));

      await this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_CIRCUITS_MAKE });

      expect(fsExtra.readdirSync(path.join(this.hre.config.paths.root, "generated-types")).length !== 0).to.be.true;
    });
  });
});
