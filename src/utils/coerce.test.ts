import { describe, expect, it } from "@jest/globals";
import {
  coerceNumber,
  coerceStringArray,
  coerceUidArray,
  coerceArray,
  coerce,
  asNumber,
  asStringArray,
  asUidArray,
} from "./coerce.js";

describe("src/utils/coerce", () => {
  describe("coerceNumber / asNumber", () => {
    it("parses valid numbers and numeric strings", () => {
      expect(coerceNumber(42, 0)).toBe(42);
      expect(coerceNumber("123", 0)).toBe(123);
      expect(coerceNumber("3.14", 0)).toBe(3.14);
    });

    it("falls back for non-finite or invalid values", () => {
      expect(coerceNumber("invalid", 10)).toBe(10);
      expect(coerceNumber(null, 5)).toBe(5);
      expect(coerceNumber(undefined, 5)).toBe(5);
      expect(coerceNumber(NaN, 5)).toBe(5);
      expect(coerceNumber(Infinity, 5)).toBe(5);
    });

    it("clamps values with min and max options", () => {
      expect(coerceNumber(50, 0, { min: 100 })).toBe(100);
      expect(coerceNumber(150, 0, { max: 100 })).toBe(100);
      expect(coerceNumber(75, 0, { min: 50, max: 100 })).toBe(75);
    });

    it("asNumber is an alias of coerceNumber", () => {
      expect(asNumber("42", 0)).toBe(42);
    });
  });

  describe("coerceStringArray / asStringArray", () => {
    it("returns empty array for non-array inputs", () => {
      expect(coerceStringArray(null)).toEqual([]);
      expect(coerceStringArray(undefined)).toEqual([]);
      expect(coerceStringArray("string")).toEqual([]);
      expect(coerceStringArray(123)).toEqual([]);
    });

    it("filters out non-strings, trims, and discards empty strings", () => {
      expect(
        coerceStringArray([
          "  hello  ",
          42,
          "",
          "   ",
          "world",
          null,
          undefined,
        ]),
      ).toEqual(["hello", "world"]);
    });

    it("asStringArray is an alias of coerceStringArray", () => {
      expect(asStringArray([" a ", "b"])).toEqual(["a", "b"]);
    });
  });

  describe("coerceUidArray / asUidArray", () => {
    it("returns empty array for non-array inputs", () => {
      expect(coerceUidArray(null)).toEqual([]);
      expect(coerceUidArray(undefined)).toEqual([]);
    });

    it("converts numbers and numeric strings to positive integers and deduplicates", () => {
      expect(coerceUidArray([1, 2, "3", 2, 4.8, 0, -5, "invalid"])).toEqual([
        1, 2, 3, 4,
      ]);
    });

    it("asUidArray is an alias of coerceUidArray", () => {
      expect(asUidArray([10, "20", 10])).toEqual([10, 20]);
    });
  });

  describe("coerceArray (unified array coercion)", () => {
    it("coerces string arrays by default or with 'string'", () => {
      expect(coerceArray([" a ", 1, "b"])).toEqual(["a", "b"]);
      expect(coerceArray([" a ", 1, "b"], "string")).toEqual(["a", "b"]);
    });

    it("coerces uid arrays with 'uid'", () => {
      expect(coerceArray([1, "2", 1, -1], "uid")).toEqual([1, 2]);
    });

    it("coerces number arrays with 'number'", () => {
      expect(coerceArray([1.5, "2.5", "nan", 3], "number")).toEqual([
        1.5, 2.5, 3,
      ]);
    });

    it("supports custom mapper function", () => {
      expect(coerceArray(["1", "2", "3"], (item) => Number(item) * 10)).toEqual(
        [10, 20, 30],
      );
    });
  });

  describe("coerce (unified dual-purpose coercion)", () => {
    it("coerces number", () => {
      expect(coerce("42", "number", 0)).toBe(42);
      expect(coerce("abc", "number", 5)).toBe(5);
    });

    it("coerces string-array and uid-array", () => {
      expect(coerce([" a ", "b "], "string-array")).toEqual(["a", "b"]);
      expect(coerce([1, "2", 1], "uid-array")).toEqual([1, 2]);
    });
  });
});
