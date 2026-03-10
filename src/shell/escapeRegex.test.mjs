import { escapeRegex } from "./escapeRegex.mjs";

describe("escapeRegex", () => {
  it("escapes regex metacharacters", () => {
    expect(escapeRegex("a+b?.(x)")).toBe("a\\+b\\?\\.\\(x\\)");
  });
});
