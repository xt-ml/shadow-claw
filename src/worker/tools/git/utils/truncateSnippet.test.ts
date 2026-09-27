import { describe, expect, it } from "@jest/globals";
import { truncateSnippet } from "./truncateSnippet.js";

describe("truncateSnippet", () => {
  it("returns unchanged text when line count is less than or equal to maxLines", () => {
    const text = "line 1\nline 2\nline 3";
    expect(truncateSnippet(text, 5)).toBe(text);
    expect(truncateSnippet(text, 3)).toBe(text);
  });

  it("truncates text and appends remaining line count when line count exceeds maxLines", () => {
    const text = "line 1\nline 2\nline 3\nline 4\nline 5";
    const result = truncateSnippet(text, 2);
    expect(result).toBe("line 1\nline 2\n    [... 3 more lines]");
  });
});
