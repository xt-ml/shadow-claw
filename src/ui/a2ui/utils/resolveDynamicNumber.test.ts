import { resolveDynamicNumber } from "./resolveDynamicNumber.js";

describe("resolveDynamicNumber", () => {
  it("returns a literal number", () => {
    expect(resolveDynamicNumber(42, {})).toBe(42);
  });

  it("resolves a path reference", () => {
    expect(resolveDynamicNumber({ path: "/n" }, { n: 7 })).toBe(7);
  });

  it("returns 0 for null", () => {
    expect(resolveDynamicNumber(null, {})).toBe(0);
  });
});
