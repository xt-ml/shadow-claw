import { normalizeWorkspacePath } from "./normalizeWorkspacePath.js";

describe("normalizeWorkspacePath", () => {
  it("trims whitespace from the path", () => {
    expect(normalizeWorkspacePath("  foo/bar.txt  ")).toBe("foo/bar.txt");
  });

  it("converts backslashes to forward slashes", () => {
    expect(normalizeWorkspacePath("foo\\bar\\baz.txt")).toBe("foo/bar/baz.txt");
  });

  it("strips leading slashes", () => {
    expect(normalizeWorkspacePath("/foo/bar.txt")).toBe("foo/bar.txt");
    expect(normalizeWorkspacePath("///foo/bar.txt")).toBe("foo/bar.txt");
  });

  it("strips leading ./", () => {
    expect(normalizeWorkspacePath("./foo/bar.txt")).toBe("foo/bar.txt");
  });

  it("handles combination of prefixes and backslashes", () => {
    expect(normalizeWorkspacePath("  \\foo\\bar.txt  ")).toBe("foo/bar.txt");
    expect(normalizeWorkspacePath("./dir\\sub/file.ts")).toBe(
      "dir/sub/file.ts",
    );
  });

  it("throws an error when allowTraversal is false and path contains traversal", () => {
    expect(() =>
      normalizeWorkspacePath("../secret", { allowTraversal: false }),
    ).toThrow("Path traversal not allowed");
    expect(() =>
      normalizeWorkspacePath("foo/../../bar", { allowTraversal: false }),
    ).toThrow("Path traversal not allowed");
  });

  it("permits path when allowTraversal is false and path does not contain traversal", () => {
    expect(
      normalizeWorkspacePath("foo/bar.txt", { allowTraversal: false }),
    ).toBe("foo/bar.txt");
  });
});
