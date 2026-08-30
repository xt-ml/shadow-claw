import {
  applySidebarVisibilityToTemplate,
  applyStaticPagesContent,
  collectPageSources,
  escapeJsonForHtmlScript,
  extractTemplateContent,
  injectPageHeaderDsd,
  injectStaticManifestScript,
  isPageFile,
  markNoSeedPrerenderHost,
  minifyDsdTemplateHtml,
  normalizePrerenderPagesOption,
  prerenderDsdShell,
  renderPageHtml,
  sortPagePaths,
  splitFrontmatterWithGrayMatter,
} from "./prerender-dsd-shell.mjs";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

describe("markNoSeedPrerenderHost", () => {
  it('adds data-prerender-no-seed="true" to shadow-claw element so CSS skeleton rules are active from first paint', () => {
    // Regression: the seeded prerender path was not calling markNoSeedPrerenderHost,
    // so data-prerender-no-seed was missing from the HTML. The shadow-claw.css skeleton
    // CSS rules depend on :host([data-prerender-no-seed="true"]), so without this
    // attribute being in the HTML the skeleton was inactive until JS set it at runtime —
    // creating a window where SSR content bled through the skeleton fade-out animation.
    const html =
      "<html><head></head><body><shadow-claw></shadow-claw></body></html>";
    const result = markNoSeedPrerenderHost(html);
    expect(result).toContain('data-prerender-no-seed="true"');
    expect(result).toMatch(/<shadow-claw[^>]+data-prerender-no-seed="true"/);
  });

  it("does not duplicate data-prerender-no-seed if already present", () => {
    const html =
      '<html><head></head><body><shadow-claw data-prerender-no-seed="true"></shadow-claw></body></html>';
    const result = markNoSeedPrerenderHost(html);
    const matches = result.match(/data-prerender-no-seed/g);
    expect(matches).toHaveLength(1);
  });
});

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

describe("normalizePrerenderPagesOption", () => {
  it("handles all input variations correctly", () => {
    expect(normalizePrerenderPagesOption("all")).toBe("all");
    expect(normalizePrerenderPagesOption("ALL")).toBe("all");
    expect(normalizePrerenderPagesOption("none")).toBe(0);
    expect(normalizePrerenderPagesOption("0")).toBe(0);
    expect(normalizePrerenderPagesOption(0)).toBe(0);
    expect(normalizePrerenderPagesOption("false")).toBe(0);
    expect(normalizePrerenderPagesOption(false)).toBe(0);
    expect(normalizePrerenderPagesOption("1")).toBe(1);
    expect(normalizePrerenderPagesOption(1)).toBe(1);
    expect(normalizePrerenderPagesOption("current")).toBe(1);
    expect(normalizePrerenderPagesOption("single")).toBe(1);
    expect(normalizePrerenderPagesOption(undefined)).toBe(1);
    expect(normalizePrerenderPagesOption("5")).toBe(5);
    expect(normalizePrerenderPagesOption(5)).toBe(5);
  });
});

describe("minifyDsdTemplateHtml", () => {
  it("flatly collapses whitespace and elements inside template shadowrootmode tags", () => {
    const input = [
      '<shadow-claw data-prerender-no-seed="true">',
      '  <template shadowrootmode="open" data-shadow-claw-dsd="true">',
      "    <style data-dsd-style>body { color: red; }</style>",
      '    <div class="app">',
      '      <header class="header">',
      '        <button aria-label="Open menu" id="menu-button">',
      "          <span>Menu</span>",
      "        </button>",
      "      </header>",
      "    </div>",
      "  </template>",
      "</shadow-claw>",
    ].join("\n");

    const result = minifyDsdTemplateHtml(input);

    expect(result).toContain(
      '<template shadowrootmode="open" data-shadow-claw-dsd="true"><style data-dsd-style>body { color: red; }</style><div class="app"><header class="header"><button aria-label="Open menu" id="menu-button"><span>Menu</span></button></header></div></template>',
    );
    expect(result).not.toContain('    <div class="app">');
    expect(result).not.toContain("\n    <header");
  });

  it("handles nested DSD templates correctly without truncating closing tags", () => {
    const input = [
      "<shadow-claw>",
      '  <template shadowrootmode="open" data-shadow-claw-dsd="true">',
      "    <style data-dsd-style>/* shadow-claw */</style>",
      '    <div class="app">',
      "      <shadow-claw-pages>",
      '        <template shadowrootmode="open" data-shadow-claw-pages-dsd="true">',
      "          <style data-dsd-style>/* pages */</style>",
      "          <shadow-claw-page-header>",
      '            <template shadowrootmode="open" data-shadow-claw-page-header-dsd="true">',
      "              <style data-dsd-style>/* header */</style>",
      '              <header class="header">',
      '                <h2 class="header__title">Pages</h2>',
      "              </header>",
      "            </template>",
      "          </shadow-claw-page-header>",
      '          <div class="pages__list">',
      '            <details class="pages__group-details" open>',
      '              <summary class="pages__group-label">Main</summary>',
      '              <div class="pages__group-pages">',
      '                <div class="pages__list-item active">',
      "                  <span>Item</span>",
      "                </div>",
      "              </div>",
      "            </details>",
      "          </div>",
      "        </template>",
      "      </shadow-claw-pages>",
      "    </div>",
      "    <shadow-claw-dialog>",
      "      <template>",
      '        <form method="dialog">',
      "          <h2>Confirm</h2>",
      "        </form>",
      "      </template>",
      "    </shadow-claw-dialog>",
      "  </template>",
      "</shadow-claw>",
    ].join("\n");

    const result = minifyDsdTemplateHtml(input);

    expect(result).toContain(
      '<template shadowrootmode="open" data-shadow-claw-page-header-dsd="true"><style data-dsd-style>/* header */</style><header class="header"><h2 class="header__title">Pages</h2></header></template>',
    );
    expect(result).toContain(
      '<template shadowrootmode="open" data-shadow-claw-pages-dsd="true"><style data-dsd-style>/* pages */</style><shadow-claw-page-header><template shadowrootmode="open" data-shadow-claw-page-header-dsd="true"><style data-dsd-style>/* header */</style><header class="header"><h2 class="header__title">Pages</h2></header></template></shadow-claw-page-header><div class="pages__list"><details class="pages__group-details" open><summary class="pages__group-label">Main</summary><div class="pages__group-pages"><div class="pages__list-item active"><span>Item</span></div></div></details></div></template>',
    );
    expect(result).toContain(
      '<shadow-claw-dialog><template><form method="dialog"><h2>Confirm</h2></form></template></shadow-claw-dialog>',
    );
    expect(result).toMatch(/<\/template>\s*<\/shadow-claw>$/);
  });

  it("safely preserves formatting and newlines inside <pre> code blocks", () => {
    const codeContent =
      "function hello() {\n    const a = 1;\n    return a;\n}";
    const input = [
      "<shadow-claw>",
      '  <template shadowrootmode="open" data-shadow-claw-dsd="true">',
      '    <div class="pages__rendered" data-pages-rendered>',
      `      <pre class="code"><code>${codeContent}</code></pre>`,
      "    </div>",
      "  </template>",
      "</shadow-claw>",
    ].join("\n");

    const result = minifyDsdTemplateHtml(input);

    expect(result).toContain(
      `<pre class="code"><code>${codeContent}</code></pre>`,
    );
    expect(result).toContain(
      '<div class="pages__rendered" data-pages-rendered>',
    );
  });

  it("handles null, undefined, and non-template html gracefully", () => {
    expect(minifyDsdTemplateHtml(null)).toBeNull();
    expect(minifyDsdTemplateHtml(undefined)).toBeUndefined();
    expect(minifyDsdTemplateHtml("<div>hello</div>")).toBe("<div>hello</div>");
  });
});

describe("collectPageSources without a pages directory", () => {
  it("returns the built-in default pages", async () => {
    const sourcePath = path.join(
      os.tmpdir(),
      `sc-dsd-missing-pages-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );

    const pages = await collectPageSources(sourcePath);

    expect(pages.map(({ displayPath }) => displayPath)).toEqual([
      "index.html",
      "MEMORY.md",
    ]);
    expect(
      pages.every(({ inlineContent }) => typeof inlineContent === "string"),
    ).toBe(true);
  });
});

describe("prerenderDsdShell purge flag pages", () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = path.join(
      os.tmpdir(),
      `sc-dsd-purge-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("excludes purge flag page from DSD pages list and rendered HTML while populating preRenderedStaticPages and purgeId in static manifest", async () => {
    const publicDir = path.join(tmpDir, "dist/public");
    const indexPath = path.join(publicDir, "index.html");
    const sourcePath = path.join(tmpDir, "pages/main");

    await mkdir(path.join(publicDir, "components/shadow-claw"), {
      recursive: true,
    });
    await mkdir(path.join(publicDir, "components/shadow-claw-pages"), {
      recursive: true,
    });
    await mkdir(path.join(publicDir, "components/shadow-claw-page-header"), {
      recursive: true,
    });
    await mkdir(sourcePath, { recursive: true });

    await writeFile(
      indexPath,
      '<!doctype html><html><head><base href="/"><title>ShadowClaw</title></head><body><shadow-claw></shadow-claw></body></html>',
      "utf8",
    );
    await writeFile(
      path.join(publicDir, "components/shadow-claw/shadow-claw.html"),
      '<template><div class="app"><shadow-claw-pages></shadow-claw-pages></div></template>',
      "utf8",
    );
    await writeFile(
      path.join(
        publicDir,
        "components/shadow-claw-pages/shadow-claw-pages.html",
      ),
      '<template><div class="pages__list" data-pages-list role="list"></div><div class="pages__rendered" data-pages-rendered hidden></div><div class="pages__empty" data-pages-empty></div><shadow-claw-page-header title="Pages"></shadow-claw-page-header></template>',
      "utf8",
    );
    await writeFile(
      path.join(
        publicDir,
        "components/shadow-claw-page-header/shadow-claw-page-header.html",
      ),
      '<template><header class="header"><h2 class="header__title"></h2><details class="header__actions-disclosure"></details><div class="header__actions" id="header-actions-panel"></div></header></template>',
      "utf8",
    );

    // 1. Regular post
    await writeFile(
      path.join(sourcePath, "post.md"),
      '---\ntitle: "My First Post"\nslug: "my-first-post"\n---\n# My First Post Content',
      "utf8",
    );

    // 2. Memory reset / purge flag page
    await writeFile(
      path.join(sourcePath, "MEMORY.md"),
      '---\ntitle: "MEMORY"\ncreated: "0000-01-01T00:00:00Z"\nupdated: "0000-01-01T00:00:00Z"\nslug: "shadow-claw--purge-pages"\npurge-id: "build-test-999"\n---\n',
      "utf8",
    );

    await prerenderDsdShell({
      indexPath,
      sourcePath,
      publicDir,
      prerenderPages: "all",
      silent: true,
    });

    const outputHtml = await readFile(indexPath, "utf8");

    // Must NOT contain MEMORY.md in pages list or as rendered page
    expect(outputHtml).not.toContain("shadow-claw--purge-pages");
    expect(outputHtml).not.toContain("MEMORY.md");
    expect(outputHtml).toContain("My First Post");
    expect(outputHtml).toContain("My First Post Content");

    // Static manifest script tag in index.html
    const scriptMatch = outputHtml.match(
      /<script id="shadow-claw-static-manifest"[^>]*>([\s\S]*?)<\/script>/,
    );
    expect(scriptMatch).not.toBeNull();
    const embeddedManifest = JSON.parse(scriptMatch[1]);

    // Pages array must only contain the real post, not the purge page
    expect(embeddedManifest.pages).toHaveLength(1);
    expect(embeddedManifest.pages[0].displayPath).toBe("post.md");
    expect(embeddedManifest.purgeId).toBe("build-test-999");
    expect(embeddedManifest.preRenderedStaticPages["br-main"]).toBeDefined();

    // static-main-manifest.json
    const manifestPath = path.join(publicDir, "static-main-manifest.json");
    const manifestJson = JSON.parse(await readFile(manifestPath, "utf8"));
    expect(manifestJson.pages).toHaveLength(1);
    expect(manifestJson.pages[0].displayPath).toBe("post.md");
    expect(manifestJson.purgeId).toBe("build-test-999");
    expect(manifestJson.preRenderedStaticPages["br-main"]).toBeDefined();
  });

  describe("prerender helper functions", () => {
    it("splits frontmatter with gray-matter", () => {
      const src = "---\ntitle: Hello\n---\n# Content";
      const res = splitFrontmatterWithGrayMatter(src);
      expect(res.data.title).toBe("Hello");
      expect(res.content.trim()).toBe("# Content");
    });

    it("extracts template content and throws on missing template", () => {
      const html = "<template><div>Hello</div></template>";
      expect(extractTemplateContent(html)).toBe("<div>Hello</div>");
      expect(() => extractTemplateContent("<div>No template</div>")).toThrow(
        "Template wrapper not found",
      );
    });

    it("identifies page files by extension", () => {
      expect(isPageFile("index.md")).toBe(true);
      expect(isPageFile("page.html")).toBe(true);
      expect(isPageFile("script.js")).toBe(false);
    });

    it("applies sidebar visibility config to template", () => {
      const tpl =
        '<li class="nav-item" data-page="chat">Chat</li><li class="nav-item" data-page="files">Files</li>';
      const modified = applySidebarVisibilityToTemplate(tpl, {
        chatHidden: true,
      });
      expect(modified).toContain('data-page="chat" hidden aria-hidden="true"');
      expect(modified).not.toContain('data-page="files" hidden');
    });

    it("minifies DSD template HTML removing excess whitespace and comments", () => {
      const html =
        '<template shadowrootmode="open">\n<div>\n  <span>Text</span>\n</div>\n</template>';
      const minified = minifyDsdTemplateHtml(html);
      expect(minified).toBe(
        '<template shadowrootmode="open"><div><span>Text</span></div></template>',
      );
    });
  });
});
