import { resolveDynamicNumber } from "./resolveDynamicNumber.js";

describe("resolveDynamicNumber", () => {
  it("returns a literal number", () => {
    expect(resolveDynamicNumber(42, {})).toBe(42);
  });

  it("resolves a path reference", () => {
    expect(resolveDynamicNumber({ path: "/n" }, { n: 7 })).toBe(7);
  });

  it("resolves a $dataModel reference", () => {
    expect(resolveDynamicNumber({ $dataModel: "/count" }, { count: 99 })).toBe(
      99,
    );
  });

  it("returns 0 for null or undefined", () => {
    expect(resolveDynamicNumber(null, {})).toBe(0);
    expect(resolveDynamicNumber(undefined, {})).toBe(0);
  });

  it("returns 0 for invalid objects without path or $dataModel", () => {
    expect(resolveDynamicNumber({} as any, {})).toBe(0);
    expect(resolveDynamicNumber("not-a-number" as any, {})).toBe(0);
  });
});
