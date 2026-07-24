import { parseConfigBoolean } from "./parseConfigBoolean.js";

describe("parseConfigBoolean", () => {
  it("should return boolean values as is", () => {
    expect(parseConfigBoolean(true)).toBe(true);
    expect(parseConfigBoolean(false)).toBe(false);
  });

  it("should parse number values (1 as true, else false)", () => {
    expect(parseConfigBoolean(1)).toBe(true);
    expect(parseConfigBoolean(0)).toBe(false);
    expect(parseConfigBoolean(-1)).toBe(false);
    expect(parseConfigBoolean(2)).toBe(false);
  });

  it("should parse string values ('true' and '1' as true, else false)", () => {
    expect(parseConfigBoolean("true")).toBe(true);
    expect(parseConfigBoolean("TRUE")).toBe(true);
    expect(parseConfigBoolean(" true ")).toBe(true);
    expect(parseConfigBoolean("1")).toBe(true);
    expect(parseConfigBoolean(" 1 ")).toBe(true);
    expect(parseConfigBoolean("false")).toBe(false);
    expect(parseConfigBoolean("0")).toBe(false);
    expect(parseConfigBoolean("")).toBe(false);
    expect(parseConfigBoolean("other")).toBe(false);
  });

  it("should return false for other types", () => {
    expect(parseConfigBoolean(null)).toBe(false);
    expect(parseConfigBoolean(undefined)).toBe(false);
    expect(parseConfigBoolean({})).toBe(false);
    expect(parseConfigBoolean([])).toBe(false);
  });
});
