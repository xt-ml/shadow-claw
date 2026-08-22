import path from "node:path";

import { toPosixPath } from "./to-posix-path.mjs";

describe("toPosixPath", () => {
  it("normalizes system separators to posix slashes", () => {
    const input = ["posts", "2026", "entry.md"].join(path.sep);
    expect(toPosixPath(input)).toBe("posts/2026/entry.md");
  });
});
