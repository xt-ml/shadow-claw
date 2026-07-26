import { resolveJsonPointer } from "./resolveJsonPointer.js";

describe("resolveJsonPointer", () => {
  const obj = { a: { b: { c: 42 } }, arr: [1, 2, 3] };

  it("returns root object for empty pointer", () => {
    expect(resolveJsonPointer(obj, "")).toBe(obj);
  });

  it("returns root object for '/'", () => {
    expect(resolveJsonPointer(obj, "/")).toBe(obj);
  });

  it("resolves top-level key", () => {
    expect(resolveJsonPointer(obj, "/a")).toEqual({ b: { c: 42 } });
  });

  it("resolves nested key", () => {
    expect(resolveJsonPointer(obj, "/a/b/c")).toBe(42);
  });

  it("returns undefined for missing path", () => {
    expect(resolveJsonPointer(obj, "/x/y")).toBeUndefined();
  });
});
