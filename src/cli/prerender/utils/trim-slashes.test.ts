import { describe, it, expect } from "@jest/globals";
import { trimSlashes } from "./trim-slashes.js";

describe("trimSlashes", () => {
  it("removes leading and trailing slashes", () => {
    expect(trimSlashes("/path/to/page/")).toBe("path/to/page");
    expect(trimSlashes("path/to/page")).toBe("path/to/page");
    expect(trimSlashes("///path///")).toBe("path");
  });
});
