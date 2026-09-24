import {
  parseBooleanConfig,
  isTruthyConfigValue,
} from "./parseBooleanConfig.js";

describe("parseBooleanConfig", () => {
  it("parses truthy values correctly", () => {
    expect(parseBooleanConfig("true")).toBe(true);
    expect(parseBooleanConfig("1")).toBe(true);
    expect(parseBooleanConfig("yes")).toBe(true);
    expect(parseBooleanConfig("on")).toBe(true);
    expect(parseBooleanConfig("  TRUE  ")).toBe(true);
  });

  it("parses falsy values correctly", () => {
    expect(parseBooleanConfig("false")).toBe(false);
    expect(parseBooleanConfig("0")).toBe(false);
    expect(parseBooleanConfig("no")).toBe(false);
    expect(parseBooleanConfig("off")).toBe(false);
    expect(parseBooleanConfig("  FALSE  ")).toBe(false);
  });

  it("returns null for non-boolean or invalid strings", () => {
    expect(parseBooleanConfig(null)).toBeNull();
    expect(parseBooleanConfig(undefined)).toBeNull();
    expect(parseBooleanConfig("other")).toBeNull();
    expect(parseBooleanConfig("")).toBeNull();
  });

  describe("isTruthyConfigValue", () => {
    it("recognizes boolean true, 'true', 1, '1'", () => {
      expect(isTruthyConfigValue(true)).toBe(true);
      expect(isTruthyConfigValue("true")).toBe(true);
      expect(isTruthyConfigValue(1)).toBe(true);
      expect(isTruthyConfigValue("1")).toBe(true);
    });

    it("recognizes falsy or default values", () => {
      expect(isTruthyConfigValue(false)).toBe(false);
      expect(isTruthyConfigValue("false")).toBe(false);
      expect(isTruthyConfigValue(0)).toBe(false);
      expect(isTruthyConfigValue(undefined, true)).toBe(true);
      expect(isTruthyConfigValue(null, false)).toBe(false);
    });
  });
});
