import { hasPathTraversal } from "./hasPathTraversal.js";

describe("hasPathTraversal", () => {
  it("returns true for paths containing .. segments", () => {
    expect(hasPathTraversal("../secret")).toBe(true);
    expect(hasPathTraversal("dir/../secret")).toBe(true);
    expect(hasPathTraversal("foo/bar/../../baz")).toBe(true);
    expect(hasPathTraversal("..")).toBe(true);
  });

  it("returns false for valid paths without .. segments", () => {
    expect(hasPathTraversal("")).toBe(false);
    expect(hasPathTraversal("file.txt")).toBe(false);
    expect(hasPathTraversal("foo/bar/baz.txt")).toBe(false);
    expect(hasPathTraversal("./foo/bar")).toBe(false);
    expect(hasPathTraversal("foo..bar")).toBe(false);
    expect(hasPathTraversal(".../bar")).toBe(false);
  });
});
