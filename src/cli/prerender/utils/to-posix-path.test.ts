import { describe, it, expect } from "@jest/globals";
import path from "node:path";
import { toPosixPath } from "./to-posix-path.js";

describe("toPosixPath", () => {
  it("converts path separators to forward slashes", () => {
    const input = ["a", "b", "c"].join(path.sep);
    expect(toPosixPath(input)).toBe("a/b/c");
  });
});
