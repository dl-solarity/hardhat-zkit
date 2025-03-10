import fsExtra from "fs-extra";
import { expect } from "chai";

import { PtauDownloader } from "@src/core";
import { useEnvironment } from "@test-helpers";

describe("PtauDownloader", () => {
  describe("downloadPtau", () => {
    useEnvironment({
      fixtureProjectName: "with-circuits",
      withCleanUp: true,
    });

    it("should download ptau file correctly", async function () {
      const ptauPath = this.hre.config.zkit.setupSettings.ptauDir;
      await PtauDownloader.downloadPtau(ptauPath, 16);

      expect(fsExtra.readdirSync(ptauPath)).to.be.deep.eq(["powers-of-tau-16.ptau"]);
    });

    it("should throw an error if ptauId is too big", async function () {
      const maxPtauId = PtauDownloader.getMaxPtauID();
      await expect(
        PtauDownloader.downloadPtau(this.hre.config.zkit.setupSettings.ptauDir, maxPtauId + 1),
      ).to.be.rejectedWith(
        `Circuits has too many constraints. The maximum ptauId to download is ${maxPtauId}. Consider passing "ptauDir=PATH_TO_LOCAL_DIR" with existing ptau files.`,
      );
    });

    it("should throw an error if ptauId is less than 8", async function () {
      await expect(PtauDownloader.downloadPtau(this.hre.config.zkit.setupSettings.ptauDir, 0)).to.be.rejectedWith(
        "Failed to download a Ptau file. Please try again or download manually.",
      );
    });
  });
});
