import { parseStoredStringList } from "./parseStoredStringList.js";

describe("parseStoredStringList", () => {
  it("returns an empty array for undefined", () => {
    expect(parseStoredStringList(undefined)).toEqual([]);
  });

  it("returns an empty array for an empty string", () => {
    expect(parseStoredStringList("")).toEqual([]);
  });

  it("parses a valid JSON array", () => {
    expect(parseStoredStringList('["a","b","c"]')).toEqual(["a", "b", "c"]);
  });

  it("normalizes JSON array entries (trims whitespace, deduplicates)", () => {
    expect(parseStoredStringList('["  a  "," b","a"]')).toEqual(["a", "b"]);
  });

  it("drops empty strings from a JSON array", () => {
    expect(parseStoredStringList('["a","","b"]')).toEqual(["a", "b"]);
  });

  it("falls back to comma-separated for invalid JSON", () => {
    expect(parseStoredStringList("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("trims and deduplicates comma-separated values", () => {
    expect(parseStoredStringList(" a , a , b ")).toEqual(["a", "b"]);
  });

  it("coerces non-string JSON array entries to strings", () => {
    expect(parseStoredStringList("[1,2,3]")).toEqual(["1", "2", "3"]);
  });
});
