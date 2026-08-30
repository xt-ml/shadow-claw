import { parseBooleanConfig } from "./parseBooleanConfig.js";

describe("parseBooleanConfig", () => {
  it("parses truthy boolean strings", () => {
    expect(parseBooleanConfig("true")).toBe(true);
    expect(parseBooleanConfig("1")).toBe(true);
    expect(parseBooleanConfig("yes")).toBe(true);
    expect(parseBooleanConfig("on")).toBe(true);
    expect(parseBooleanConfig("  TRUE  ")).toBe(true);
  });

  it("parses falsy boolean strings", () => {
    expect(parseBooleanConfig("false")).toBe(false);
    expect(parseBooleanConfig("0")).toBe(false);
    expect(parseBooleanConfig("no")).toBe(false);
    expect(parseBooleanConfig("off")).toBe(false);
    expect(parseBooleanConfig("  FALSE  ")).toBe(false);
  });

  it("returns null for null, undefined, or unrecognized strings", () => {
    expect(parseBooleanConfig(null)).toBeNull();
    expect(parseBooleanConfig(undefined)).toBeNull();
    expect(parseBooleanConfig("other")).toBeNull();
  });
});
