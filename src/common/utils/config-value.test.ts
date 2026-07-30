import { isTruthyConfigValue } from "./config-value.mjs";

describe("isTruthyConfigValue", () => {
  it("returns default for nullish input", () => {
    expect(isTruthyConfigValue(undefined)).toBe(false);
    expect(isTruthyConfigValue(null)).toBe(false);
    expect(isTruthyConfigValue(undefined, true)).toBe(true);
    expect(isTruthyConfigValue(null, true)).toBe(true);
  });

  it("returns true for accepted persisted truthy values", () => {
    expect(isTruthyConfigValue(true)).toBe(true);
    expect(isTruthyConfigValue("true")).toBe(true);
    expect(isTruthyConfigValue(1)).toBe(true);
    expect(isTruthyConfigValue("1")).toBe(true);
  });

  it("returns false for other values", () => {
    expect(isTruthyConfigValue(false)).toBe(false);
    expect(isTruthyConfigValue("false")).toBe(false);
    expect(isTruthyConfigValue(0)).toBe(false);
    expect(isTruthyConfigValue("0")).toBe(false);
    expect(isTruthyConfigValue("yes")).toBe(false);
    expect(isTruthyConfigValue("")).toBe(false);
    expect(isTruthyConfigValue({})).toBe(false);
  });
});
