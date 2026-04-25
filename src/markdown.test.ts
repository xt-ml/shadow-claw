import { renderMarkdown } from "./markdown.js";

describe("renderMarkdown", () => {
  it("renders markdown and keeps safe html", async () => {
    const html = await renderMarkdown("**bold**");

    expect(html).toContain("<strong>bold</strong>");
  });

  it("sanitizes dangerous tags", async () => {
    const html = await renderMarkdown("<script>alert(1)</script><p>ok</p>");

    expect(html).not.toContain("<script>");

    expect(html).toContain("ok");
  });

  it("preserves single newlines as spaces by default", async () => {
    const html = await renderMarkdown("line one\nline two\nline three");

    // By default, single newlines should NOT create <br> tags (standard markdown)
    expect(html).not.toContain("<br");
    expect(html).toContain("line one");
    expect(html).toContain("line two");
    expect(html).toContain("line three");
  });

  it("preserves single newlines as <br> when breaks option is enabled", async () => {
    const html = await renderMarkdown("line one\nline two\nline three", {
      breaks: true,
    });

    expect(html).toContain("<br");
    expect(html).toContain("line one");
    expect(html).toContain("line two");
    expect(html).toContain("line three");
  });

  it("preserves double newlines as separate paragraphs", async () => {
    const html = await renderMarkdown("paragraph one\n\nparagraph two");

    // Should produce two separate <p> tags
    const pCount = (html.match(/<p>/g) || []).length;
    expect(pCount).toBe(2);
    expect(html).toContain("paragraph one");
    expect(html).toContain("paragraph two");
  });
});
