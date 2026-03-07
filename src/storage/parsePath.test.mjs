import { parsePath } from "./parsePath.mjs";

describe("parsePath.mjs", () => {
  it("should parse simple filename", () => {
    const { dirs, filename } = parsePath("file.txt");
    expect(dirs).toEqual([]);
    expect(filename).toBe("file.txt");
  });

  it("should parse path with directories", () => {
    const { dirs, filename } = parsePath("a/b/c/file.txt");
    expect(dirs).toEqual(["a", "b", "c"]);
    expect(filename).toBe("file.txt");
  });

  it("should handle leading slashes", () => {
    const { dirs, filename } = parsePath("/a/b/file.txt");
    expect(dirs).toEqual(["a", "b"]);
    expect(filename).toBe("file.txt");
  });

  it("should handle backslashes", () => {
    const { dirs, filename } = parsePath("a\\b\\file.txt");
    expect(dirs).toEqual(["a", "b"]);
    expect(filename).toBe("file.txt");
  });

  it("should throw error for empty path", () => {
    expect(() => parsePath("")).toThrow("Empty file path");
    expect(() => parsePath("///")).toThrow("Empty file path");
  });

  it("should handle redundant slashes", () => {
    const { dirs, filename } = parsePath("a//b///c.txt");
    expect(dirs).toEqual(["a", "b"]);
    expect(filename).toBe("c.txt");
  });
});
