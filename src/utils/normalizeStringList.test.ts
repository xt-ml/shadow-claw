import { normalizeStringList } from "./normalizeStringList.js";

describe("normalizeStringList", () => {
  it("trims whitespace from each value", () => {
    expect(normalizeStringList([" a ", " b"])).toEqual(["a", "b"]);
  });

  it("filters empty strings", () => {
    expect(normalizeStringList(["a", "", "b"])).toEqual(["a", "b"]);
  });

  it("filters whitespace-only strings", () => {
    expect(normalizeStringList(["a", "  ", "b"])).toEqual(["a", "b"]);
  });

  it("deduplicates values", () => {
    expect(normalizeStringList(["a", "a", "b"])).toEqual(["a", "b"]);
  });

  it("returns an empty array for all-empty input", () => {
    expect(normalizeStringList(["", "  "])).toEqual([]);
  });

  it("returns an empty array for an empty input array", () => {
    expect(normalizeStringList([])).toEqual([]);
  });

  it("preserves insertion order after deduplication", () => {
    expect(normalizeStringList(["c", "a", "b", "a"])).toEqual(["c", "a", "b"]);
  });
});
