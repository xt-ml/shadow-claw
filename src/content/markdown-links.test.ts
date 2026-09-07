import { normalizeMarkdownLinks } from "./markdown-links.js";

describe("normalizeMarkdownLinks", () => {
  it("wraps relative link destinations with spaces in angle brackets", () => {
    const input =
      "[My File With Spaces In The Name.md](./My File With Spaces In The Name.md)";
    const expected =
      "[My File With Spaces In The Name.md](<./My File With Spaces In The Name.md>)";
    expect(normalizeMarkdownLinks(input)).toBe(expected);
  });

  it("wraps bare filename destinations with spaces in angle brackets", () => {
    const input =
      "[My File With Spaces In The Name.md](My File With Spaces In The Name.md)";
    const expected =
      "[My File With Spaces In The Name.md](<My File With Spaces In The Name.md>)";
    expect(normalizeMarkdownLinks(input)).toBe(expected);
  });

  it("wraps subfolder paths with spaces in angle brackets", () => {
    const input =
      "[My File](folder with spaces/My File With Spaces In The Name.md)";
    const expected =
      "[My File](<folder with spaces/My File With Spaces In The Name.md>)";
    expect(normalizeMarkdownLinks(input)).toBe(expected);
  });

  it("wraps relative parent paths with spaces in angle brackets", () => {
    const input =
      "[My File](../parent folder/sub folder/My File With Spaces In The Name.md)";
    const expected =
      "[My File](<../parent folder/sub folder/My File With Spaces In The Name.md>)";
    expect(normalizeMarkdownLinks(input)).toBe(expected);
  });

  it("wraps HTTP/HTTPS URLs with spaces in angle brackets", () => {
    const input =
      "[My File With Spaces In The Name.md](https://karlherrick.com/What About This)";
    const expected =
      "[My File With Spaces In The Name.md](<https://karlherrick.com/What About This>)";
    expect(normalizeMarkdownLinks(input)).toBe(expected);
  });

  it("wraps image destinations with spaces in angle brackets", () => {
    const input = "![My Image](./sub folder/My Image With Spaces.png)";
    const expected = "![My Image](<./sub folder/My Image With Spaces.png>)";
    expect(normalizeMarkdownLinks(input)).toBe(expected);
  });

  it("supports link titles when destination contains spaces", () => {
    const input = '[My File](./My File With Spaces.md "File Title")';
    const expected = '[My File](<./My File With Spaces.md> "File Title")';
    expect(normalizeMarkdownLinks(input)).toBe(expected);
  });

  it("supports single-quoted link titles when destination contains spaces", () => {
    const input = "[My File](./My File With Spaces.md 'File Title')";
    const expected = "[My File](<./My File With Spaces.md> 'File Title')";
    expect(normalizeMarkdownLinks(input)).toBe(expected);
  });

  it("does not modify links that are already wrapped in angle brackets", () => {
    const input = "[My File](<./My File With Spaces.md>)";
    expect(normalizeMarkdownLinks(input)).toBe(input);
  });

  it("does not modify links that have no spaces", () => {
    const input = "[My File](./MyFile.md)";
    expect(normalizeMarkdownLinks(input)).toBe(input);
  });

  it("preserves fenced code blocks without modifying link-like text inside them", () => {
    const input = [
      "Here is some code:",
      "```markdown",
      "[My File With Spaces In The Name.md](./My File With Spaces In The Name.md)",
      "```",
      "And a real link outside:",
      "[My Real File](./Real File.md)",
    ].join("\n");

    const expected = [
      "Here is some code:",
      "```markdown",
      "[My File With Spaces In The Name.md](./My File With Spaces In The Name.md)",
      "```",
      "And a real link outside:",
      "[My Real File](<./Real File.md>)",
    ].join("\n");

    expect(normalizeMarkdownLinks(input)).toBe(expected);
  });

  it("preserves inline code spans without modifying link-like text inside them", () => {
    const input =
      "Inline: `[My File](./My File.md)` and link: [My Link](./My Link.md)";
    const expected =
      "Inline: `[My File](./My File.md)` and link: [My Link](<./My Link.md>)";
    expect(normalizeMarkdownLinks(input)).toBe(expected);
  });

  it("handles multiple links on the same line", () => {
    const input =
      "See [File 1](File 1.md) and [File 2](File 2.md) for details.";
    const expected =
      "See [File 1](<File 1.md>) and [File 2](<File 2.md>) for details.";
    expect(normalizeMarkdownLinks(input)).toBe(expected);
  });
});
