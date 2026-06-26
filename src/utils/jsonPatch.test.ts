import { applyJsonPatch } from "./jsonPatch.js";

describe("applyJsonPatch", () => {
  it("applies add, replace, and remove to objects", () => {
    const doc = { a: 1, b: 2 };
    const patched = applyJsonPatch(doc, [
      { op: "add", path: "/c", value: 3 },
      { op: "replace", path: "/a", value: 10 },
      { op: "remove", path: "/b" },
    ]);

    expect(patched).toEqual({ a: 10, c: 3 });
    expect(doc).toEqual({ a: 1, b: 2 }); // Original is unmodified
  });

  it("applies operations to arrays", () => {
    const doc = { items: [1, 2, 3] };
    const patched = applyJsonPatch(doc, [
      { op: "add", path: "/items/-", value: 4 }, // append
      { op: "add", path: "/items/1", value: 1.5 }, // insert
      { op: "replace", path: "/items/0", value: 0 },
      { op: "remove", path: "/items/3" },
    ]);

    expect(patched).toEqual({ items: [0, 1.5, 2, 4] });
  });

  it("handles path unescaping", () => {
    const doc = {};
    const patched = applyJsonPatch(doc, [
      { op: "add", path: "/a~1b", value: 1 },
      { op: "add", path: "/c~0d", value: 2 },
    ]);

    expect(patched).toEqual({ "a/b": 1, "c~d": 2 });
  });

  it("ignores invalid paths without crashing", () => {
    const doc = { a: 1 };
    const patched = applyJsonPatch(doc, [
      { op: "add", path: "/b/c", value: 2 }, // /b does not exist
      { op: "remove", path: "/d" }, // /d does not exist
    ]);

    expect(patched).toEqual({ a: 1 });
  });
});
