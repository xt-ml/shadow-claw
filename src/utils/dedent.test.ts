import { dedentLeadingWhitespace } from "./dedent.js";

describe("dedentLeadingWhitespace", () => {
  it("dedents uniform leading whitespace", () => {
    const indented = "\n    line 1\n    line 2\n      line 3\n  ";
    expect(dedentLeadingWhitespace(indented)).toBe(
      "line 1\nline 2\n  line 3\n",
    );
  });

  it("handles empty or falsy strings", () => {
    expect(dedentLeadingWhitespace("")).toBe("");
  });

  it("leaves unindented multiline text unchanged", () => {
    expect(dedentLeadingWhitespace("hello\nworld")).toBe("hello\nworld");
  });

  it("strips leading newlines before frontmatter dashes", () => {
    expect(dedentLeadingWhitespace("\n---\ntitle: Article\n---")).toBe(
      "---\ntitle: Article\n---",
    );
    expect(dedentLeadingWhitespace("\r\n\r\n---\ntitle: Article\n---")).toBe(
      "---\ntitle: Article\n---",
    );
  });

  it("strips indentation before frontmatter dashes", () => {
    expect(dedentLeadingWhitespace("  ---\n  title: Article\n  ---")).toBe(
      "---\ntitle: Article\n---",
    );
  });
});
