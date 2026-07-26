import {
  applyDataModelPatches,
  applyDataModelUpdate,
} from "./applyDataModelUpdate.js";

describe("applyDataModelUpdate", () => {
  it("sets a top-level key via '/key' path", () => {
    const result = applyDataModelUpdate({ a: 1 }, "/b", 2);
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it("replaces entire data model when path is '/'", () => {
    const result = applyDataModelUpdate({ old: true }, "/", { new: true });
    expect(result).toEqual({ new: true });
  });

  it("replaces entire data model when path is omitted", () => {
    const result = applyDataModelUpdate({ old: true }, undefined, { fresh: 1 });
    expect(result).toEqual({ fresh: 1 });
  });

  it("sets a nested key", () => {
    const result = applyDataModelUpdate(
      { user: { name: "Alice" } },
      "/user/name",
      "Bob",
    );
    expect(result).toEqual({ user: { name: "Bob" } });
  });

  it("deletes a key when hasValue is false", () => {
    const result = applyDataModelUpdate({ a: 1, b: 2 }, "/a", undefined, false);
    expect(result).not.toHaveProperty("a");
    expect(result.b).toBe(2);
  });

  it("does not mutate the original data model", () => {
    const original = { count: 0 };
    applyDataModelUpdate(original, "/count", 99);
    expect(original.count).toBe(0);
  });
});

describe("applyDataModelPatches (deprecated)", () => {
  it("applies multiple patches in one call", () => {
    const result = applyDataModelPatches(
      { a: 1, b: 2 },
      { "/a": 10, "/c": 30 },
    );
    expect(result).toEqual({ a: 10, b: 2, c: 30 });
  });

  it("does not mutate the original", () => {
    const original = { x: 1 };
    applyDataModelPatches(original, { "/x": 99 });
    expect(original.x).toBe(1);
  });
});
