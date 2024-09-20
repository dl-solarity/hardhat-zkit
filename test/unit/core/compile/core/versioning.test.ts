import { expect } from "chai";

import { isVersionHigherOrEqual, isVersionValid } from "../../../../../src/core/compiler/versioning";

describe("Versioning", () => {
  describe("isVersionHigherOrEqual", () => {
    it("should correctly identify whether circom version is higher or equal", async function () {
      expect(isVersionHigherOrEqual("2.1.9", "2.0.0")).to.be.true;
      expect(isVersionHigherOrEqual("2.1.9", "2.1.8")).to.be.true;
      expect(isVersionHigherOrEqual("2.1.9", "2.1.9")).to.be.true;

      expect(isVersionHigherOrEqual("2.1.8", "2.1.9")).to.be.false;

      expect(isVersionHigherOrEqual("", "2.1.9")).to.be.false;
      expect(isVersionHigherOrEqual("0.0.0", "2.1.9")).to.be.false;
      expect(isVersionHigherOrEqual("2.1.8", "")).to.be.true;
      expect(isVersionHigherOrEqual("2.1.8", "0.0.0")).to.be.true;

      expect(isVersionHigherOrEqual("", "")).to.be.true;
    });
  });

  describe("isVersionValid", () => {
    it("should correctly identify whether circom version is correct", async function () {
      expect(isVersionValid("2.1.9")).to.be.true;
      expect(isVersionValid("2.0.0")).to.be.true;

      expect(isVersionValid("")).to.be.false;
      expect(isVersionValid("1")).to.be.false;
      expect(isVersionValid("2.1")).to.be.false;
      expect(isVersionValid("2.a.1")).to.be.false;
      expect(isVersionValid("2.1.b")).to.be.false;
    });
  });
});
