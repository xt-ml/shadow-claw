import { parsePath } from "./parsePath.js";

describe("parsePath.js", () => {
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

  it("should strip /home/user/ prefix", () => {
    const { dirs, filename } = parsePath("/home/user/testing");

    expect(dirs).toEqual([]);

    expect(filename).toBe("testing");
  });

  it("should strip /home/user/ prefix with nested path", () => {
    const { dirs, filename } = parsePath("/home/user/data/file.txt");

    expect(dirs).toEqual(["data"]);

    expect(filename).toBe("file.txt");
  });
});
