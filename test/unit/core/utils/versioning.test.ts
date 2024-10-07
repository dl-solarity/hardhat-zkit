import { expect } from "chai";

import { getHighestVersion, isVersionValid } from "@src/core/compiler/versioning";

describe("Versioning", () => {
  describe("isVersionValid", () => {
    it("should correctly identify whether circom version is correct", async function () {
      expect(isVersionValid("2.1.9")).to.be.true;
      expect(isVersionValid("2.0.0")).to.be.true;

      expect(isVersionValid("")).to.be.false;
      expect(isVersionValid("1")).to.be.false;
      expect(isVersionValid("2.1")).to.be.false;
      expect(isVersionValid("2.a.1")).to.be.false;
      expect(isVersionValid("2.1.b")).to.be.false;
      expect(isVersionValid("^2.1.3")).to.be.false;
    });
  });

  describe("getHighestVersion", () => {
    it("should correctly get the highest version", async function () {
      expect(getHighestVersion(["2.1.9", "0.1.1", "2.1.9", "2.0.0", "2.1.8"])).to.be.equal("2.1.9");
      expect(getHighestVersion(["2.0.0", "2.0.0"])).to.be.equal("2.0.0");
      expect(getHighestVersion([])).to.be.equal("0.0.0");
    });
  });
});
