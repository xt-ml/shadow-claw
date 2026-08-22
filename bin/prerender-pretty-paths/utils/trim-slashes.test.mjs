import { trimSlashes } from "./trim-slashes.mjs";

describe("trimSlashes", () => {
  it("trims leading and trailing slashes", () => {
    expect(trimSlashes("/a/b/")).toBe("a/b");
    expect(trimSlashes("a/b")).toBe("a/b");
  });
});
