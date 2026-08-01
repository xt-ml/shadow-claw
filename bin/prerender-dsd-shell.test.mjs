import {
  applyStaticPagesContent,
  escapeJsonForHtmlScript,
  injectPageHeaderDsd,
  injectStaticManifestScript,
  renderPageHtml,
  sortPagePaths,
} from "./prerender-dsd-shell.mjs";

describe("sortPagePaths", () => {
  it("places MEMORY.md at bottom and sorts remaining pages in reverse alphabetical order", () => {
    const input = [
      "posts/2003-08-27_03-00-59.md",
      "posts/2026-07-01_03-37-38.md",
      "MEMORY.md",
      "posts/2010-01-02_22-11-19.md",
    ];

    const sorted = sortPagePaths(input);

    expect(sorted).toEqual([
      "posts/2026-07-01_03-37-38.md",
      "posts/2010-01-02_22-11-19.md",
      "posts/2003-08-27_03-00-59.md",
      "MEMORY.md",
    ]);
  });
});

describe("prerender-dsd-shell script tag escaping", () => {
  it("escapes script tags, HTML comments, and special characters so HTML parsing does not truncate script elements", () => {
    const rawManifest = {
      pages: [
        {
          displayPath: "posts/script-test.md",
          content:
            "Here is a code post:\n<script type=\"module\">import 'https://unpkg.com/x-postpress-code@1.0/dist/x-postpress-code.js';</script>\n<!-- end -->",
        },
      ],
    };

    const manifestJson = JSON.stringify(rawManifest);
    const escapedJson = escapeJsonForHtmlScript(manifestJson);

    expect(escapedJson).not.toContain("<");
    expect(escapedJson).not.toContain(">");
    expect(escapedJson).not.toContain("/");
    expect(escapedJson).toContain("\\u003c");
    expect(escapedJson).toContain("\\u002f");

    const htmlHost =
      "<html><head></head><body><shadow-claw></shadow-claw></body></html>";
    const injectedHtml = injectStaticManifestScript(htmlHost, manifestJson);

    // Ensure the injected script tag contains escaped JSON, not raw </script>
    const scriptMatch = injectedHtml.match(
      /<script id="shadow-claw-static-manifest"[^>]*>([\s\S]*?)<\/script>/,
    );
    expect(scriptMatch).not.toBeNull();
    const scriptContent = scriptMatch[1];
    expect(scriptContent).not.toContain("</script>");

    // Ensure JSON.parse correctly parses the escaped script content back to original object
    const parsed = JSON.parse(scriptContent);
    expect(parsed).toEqual(rawManifest);
  });

  it("handles dollar signs ($1, $&, $') in manifest content safely during HTML replacement", () => {
    const rawManifest = {
      pages: [
        {
          displayPath: "posts/dollar-test.md",
          content: "Use str.replace(/foo/, '$1') or $& or $'",
        },
      ],
    };

    const manifestJson = JSON.stringify(rawManifest);
    const htmlHost = "<html><head></head><body></body></html>";
    const injectedHtml = injectStaticManifestScript(htmlHost, manifestJson);

    const scriptMatch = injectedHtml.match(
      /<script id="shadow-claw-static-manifest"[^>]*>([\s\S]*?)<\/script>/,
    );
    expect(scriptMatch).not.toBeNull();
    const parsed = JSON.parse(scriptMatch[1]);
    expect(parsed.pages[0].content).toBe(
      "Use str.replace(/foo/, '$1') or $& or $'",
    );
  });
});

describe("renderPageHtml frontmatter", () => {
  it("strips markdown frontmatter from body text and renders a frontmatter section", async () => {
    const markdown = [
      "---",
      'title: "On Developing Loops"',
      'slug: "on-developing-loops"',
      "---",
      "# Heading",
    ].join("\n");

    const rendered = await renderPageHtml(markdown, "page.md");

    expect(rendered).toContain("markdown-frontmatter");
    expect(rendered).toContain("data-frontmatter=");
    expect(rendered).toContain(
      "&quot;title&quot;: &quot;On Developing Loops&quot;",
    );
    expect(rendered).toContain("<h1>Heading</h1>");
    expect(rendered).not.toContain('slug: "on-developing-loops"');
  });
});

describe("pages DSD prerender parity", () => {
  it("injects page-header declarative shadow root and static title", () => {
    const pagesMarkup = [
      '<shadow-claw-page-header icon="📚" title="Pages">',
      '  <div slot="status" class="pages__status" data-pages-status></div>',
      "</shadow-claw-page-header>",
    ].join("\n");

    const pageHeaderTemplate = [
      '<header class="header">',
      '  <div class="header__main">',
      '    <h2 class="header__title"></h2>',
      '    <details class="header__actions-disclosure">',
      '      <summary class="header__actions-toggle">Actions</summary>',
      '      <div class="header__actions" id="header-actions-panel"></div>',
      "    </details>",
      "  </div>",
      "</header>",
    ].join("\n");

    const next = injectPageHeaderDsd(pagesMarkup, pageHeaderTemplate);

    expect(next).toContain("data-shadow-claw-page-header-dsd");
    expect(next).toContain('<h2 class="header__title">📚 Pages</h2>');
    expect(next).toContain('class="header__actions-disclosure" hidden');
    expect(next).toContain(
      'class="header__actions" id="header-actions-panel" hidden',
    );
  });

  it("renders status, selected path, both static lists, and rendered content", () => {
    const pagesTemplate = [
      '<shadow-claw-page-header icon="📚" title="Pages">',
      '  <div slot="status" class="pages__status" data-pages-status></div>',
      "</shadow-claw-page-header>",
      '<span class="pages__dropdown-selected" data-pages-dropdown-selected>Select a page...</span>',
      '<div class="pages__list" data-pages-list role="list"></div>',
      '<div class="pages__list" data-pages-list role="list"></div>',
      '<div class="pages__empty" data-pages-empty>empty</div>',
      '<div class="pages__rendered" data-pages-rendered hidden></div>',
    ].join("\n");

    const pageHeaderTemplate = [
      '<header class="header">',
      '  <div class="header__main">',
      '    <h2 class="header__title"></h2>',
      '    <details class="header__actions-disclosure">',
      '      <summary class="header__actions-toggle">Actions</summary>',
      '      <div class="header__actions" id="header-actions-panel"></div>',
      "    </details>",
      "  </div>",
      "</header>",
    ].join("\n");

    const next = applyStaticPagesContent(
      pagesTemplate,
      [{ displayPath: "MEMORY.md" }],
      "<h1>Hello</h1>",
      pageHeaderTemplate,
    );

    expect(next).toContain("data-pages-status>1 saved page</div>");
    expect(next).toContain(
      '<span class="pages__dropdown-selected" data-pages-dropdown-selected>MEMORY.md</span>',
    );
    expect(next.match(/data-pages-list/g)).toHaveLength(2);
    expect(next.match(/pages__group-details/g)).toHaveLength(2);
    expect(next).toContain(
      '<div class="pages__empty" data-pages-empty hidden>',
    );
    expect(next).toContain(
      '<div class="pages__rendered" data-pages-rendered><h1>Hello</h1></div>',
    );
  });
});
