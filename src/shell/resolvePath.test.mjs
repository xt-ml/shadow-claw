import { resolvePath } from "./resolvePath.mjs";

describe("resolvePath.mjs", () => {
  it("should resolve relative path", () => {
    const ctx = { cwd: "home" };
    expect(resolvePath("test.txt", ctx)).toBe("home/test.txt");
  });

  it("should resolve absolute path", () => {
    const ctx = { cwd: "home" };
    expect(resolvePath("/tmp/test.txt", ctx)).toBe("tmp/test.txt");
  });

  it("should handle . and ..", () => {
    const ctx = { cwd: "home/user" };
    expect(resolvePath("../other/./file.txt", ctx)).toBe("home/other/file.txt");
  });

  it("should handle /workspace prefix", () => {
    const ctx = { cwd: "." };
    expect(resolvePath("/workspace/data/file.txt", ctx)).toBe("data/file.txt");
  });

  it("should return . for empty or / path", () => {
    const ctx = { cwd: "home" };
    expect(resolvePath("/", ctx)).toBe(".");

    expect(resolvePath("", ctx)).toBe(".");
  });

  it("should handle multiple slashes", () => {
    const ctx = { cwd: "." };
    expect(resolvePath("///a//b/", ctx)).toBe("a/b");
  });
});
