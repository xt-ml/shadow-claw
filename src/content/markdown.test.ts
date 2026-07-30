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

  it("renders frontmatter as visible html and data attributes when enabled", async () => {
    const html = await renderMarkdown(
      [
        "---",
        'title: "On Developing Loops"',
        'slug: "on-developing-loops"',
        "---",
        "# Heading",
      ].join("\n"),
      { renderFrontmatter: true },
    );

    expect(html).toContain("markdown-frontmatter");
    expect(html).toContain("data-frontmatter=");
    expect(html).toContain("Frontmatter");
    expect(html).toContain(
      "&quot;title&quot;: &quot;On Developing Loops&quot;",
    );
    expect(html).toContain('<h1 id="heading">Heading</h1>');
  });

  it("preserves double newlines as separate paragraphs", async () => {
    const html = await renderMarkdown("paragraph one\n\nparagraph two");

    // Should produce two separate <p> tags
    const pCount = (html.match(/<p>/g) || []).length;
    expect(pCount).toBe(2);
    expect(html).toContain("paragraph one");
    expect(html).toContain("paragraph two");
  });

  it("renders html inside fenced code blocks as escaped literal text", async () => {
    const html = await renderMarkdown(
      [
        "```",
        "<h1>Useful Resources</h1>",
        '<li><a href="https://www.wikipedia.org">Wikipedia</a></li>',
        "```",
      ].join("\n"),
    );

    expect(html).toContain("<pre><code");
    expect(html).toContain("&lt;h1&gt;Useful Resources&lt;/h1&gt;");
    expect(html).toContain("&lt;li&gt;&lt;a href=");
    expect(html).toContain("https://www.wikipedia.org");
    expect(html).toContain("&gt;Wikipedia&lt;/a&gt;&lt;/li&gt;");
    expect(html).not.toContain("<h1>Useful Resources</h1>");
    expect(html).not.toContain(
      '<li><a href="https://www.wikipedia.org">Wikipedia</a></li>',
    );
  });

  it("preserves safe youtube iframes and figures in markdown", async () => {
    const markdown = [
      '<figure class="wp-block-embed">',
      '<div class="wp-block-embed__wrapper">',
      '<iframe title="YouTube video player" width="525" height="295" src="https://www.youtube.com/embed/h1les1A3gcg?feature=oembed" frameborder="0" allowfullscreen></iframe>',
      "</div>",
      "</figure>",
    ].join("\n");

    const html = await renderMarkdown(markdown);

    expect(html).toContain("<figure");
    expect(html).toContain("<iframe");
    expect(html).toContain(
      'src="https://www.youtube.com/embed/h1les1A3gcg?feature=oembed"',
    );
  });

  it("strips malicious or non-whitelisted iframes in markdown", async () => {
    const markdown =
      '<iframe src="https://phishing-site.example.com"></iframe>';

    const html = await renderMarkdown(markdown);

    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("phishing-site.example.com");
  });
});
