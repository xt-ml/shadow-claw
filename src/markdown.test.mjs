import { renderMarkdown } from "./markdown.mjs";

describe("renderMarkdown", () => {
  it("renders markdown and keeps safe html", () => {
    const html = renderMarkdown("**bold**");
    expect(html).toContain("<strong>bold</strong>");
  });

  it("sanitizes dangerous tags", () => {
    const html = renderMarkdown("<script>alert(1)</script><p>ok</p>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("ok");
  });
});
