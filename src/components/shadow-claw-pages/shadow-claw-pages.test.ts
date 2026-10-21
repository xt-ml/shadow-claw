import { jest } from "@jest/globals";

jest.unstable_mockModule("../../core/effect.js", () => ({
  effect: jest.fn(() => () => undefined),
}));

jest.unstable_mockModule("../../content/markdown.js", () => ({
  renderMarkdown: jest.fn(async (value: string) => `<p>${value}</p>`),
}));

jest.unstable_mockModule("../../security/trusted-types.js", () => ({
  sanitizeToTrustedHtml: jest.fn((html: string) => html),
  sanitizeSrcdocHtml: jest.fn((html: string) =>
    html.replace(/<script[\s\S]*?<\/script>/gi, ""),
  ),
  setSanitizedHtml: jest.fn((element: Element, html: string) => {
    element.innerHTML = html;

    return html;
  }),
  setTrustedSrcdoc: jest.fn((iframe: HTMLIFrameElement, html: string) => {
    iframe.srcdoc = html;

    return html;
  }),
  toTrustedScriptUrl: jest.fn((url: string) => url),
  toTrustedHtmlPresanitized: jest.fn((html: string) => html),
}));

jest.unstable_mockModule("../../stores/file-viewer.js", () => ({
  fileViewerStore: {
    openFile: jest.fn(),
  },
}));

jest.unstable_mockModule("../../stores/orchestrator.js", () => {
  let mockActivePinnedPage: any = null;
  let mockDefaultPinnedPage: any = null;
  const mockSetState = jest.fn((val: any) => {
    mockActivePinnedPage = val;
  });

  return {
    orchestratorStore: {
      whenInitialized: Promise.resolve(),
      whenReady: Promise.resolve(),
      pages: [],
      groups: [],
      activeGroupId: "group-1",
      removePage: jest.fn(),
      removeAllPages: jest.fn(),
      reorderPages: jest.fn(),
      isPageAllowed: jest.fn(() => true),
      setDefaultPinnedPage: jest.fn(async (_db: any, val: any) => {
        mockDefaultPinnedPage = val;
      }),
      get defaultPinnedPage() {
        return mockDefaultPinnedPage;
      },
      get effectiveDefaultPage() {
        const pages = (this as any).pages || [];

        return pages[0] || null;
      },
      get activePinnedPage() {
        return mockActivePinnedPage;
      },
      _activePinnedPage: {
        set: mockSetState,
      },
      setActivePinnedPage: jest.fn(async (_db: any, val: any) => {
        mockActivePinnedPage = val;
      }),
    },
  };
});

jest.unstable_mockModule("../../storage/read-group-file.js", () => ({
  readGroupFile: jest.fn(),
}));

jest.unstable_mockModule("../../storage/write-group-file.js", () => ({
  writeGroupFile: jest.fn(),
}));

jest.unstable_mockModule("../../storage/static-main-site.js", () => ({
  getStaticMainManifest: jest.fn(async () => ({ pages: [] })),
  getStaticPageContent: jest.fn(async () => null),
  seedStaticMainSite: jest.fn(),
  getSiteConfigSeoSettings: jest.fn(() => ({ siteTitle: "ShadowClaw" })),
}));

jest.unstable_mockModule("../../storage/read-group-file-bytes.js", () => ({
  readGroupFileBytes: jest.fn(),
}));

jest.unstable_mockModule("../../ui/toast.js", () => ({
  showError: jest.fn(),
  showSuccess: jest.fn(),
  showWarning: jest.fn(),
}));

jest.unstable_mockModule("../../db/db.js", () => ({
  getDb: jest.fn(async () => ({})),
}));

jest.unstable_mockModule("../../db/get-config.js", () => ({
  getConfig: jest.fn(async () => "0"),
}));

jest.unstable_mockModule("./utils/request-confirmation.js", () => ({
  requestConfirmation: jest.fn(),
}));

const { ShadowClawPages } = await import("./shadow-claw-pages.js");
const { orchestratorStore } = await import("../../stores/orchestrator.js");
const { readGroupFile } = await import("../../storage/read-group-file.js");
const { writeGroupFile } = await import("../../storage/write-group-file.js");
const { getStaticPageContent } =
  await import("../../storage/static-main-site.js");
const { readGroupFileBytes } =
  await import("../../storage/read-group-file-bytes.js");
const { renderMarkdown } = await import("../../content/markdown.js");
const { getConfig } = await import("../../db/get-config.js");
const { setSanitizedHtml, setTrustedSrcdoc } =
  await import("../../security/trusted-types.js");
const { requestConfirmation } = await import("./utils/request-confirmation.js");
const { showError, showSuccess } = await import("../../ui/toast.js");
const { fileViewerStore } = await import("../../stores/file-viewer.js");
const { toolsStore } = await import("../../stores/tools.js");
const { effect } = await import("../../core/effect.js");

describe("shadow-claw-pages", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (orchestratorStore as any).pages = [];
    (orchestratorStore as any).groups = [];
    orchestratorStore._activePinnedPage.set(null);
  });

  it("does not eagerly include the sandboxed preview iframe in template source", async () => {
    const template = await Promise.resolve(
      ShadowClawPages.template.map((e: Element) => e.outerHTML).join(""),
    );

    expect(template).not.toContain("data-pages-iframe");
  });

  it("creates iframe only when rendering an HTML page", async () => {
    const component = new ShadowClawPages();

    const root = component.shadowRoot;
    expect(root).not.toBeNull();
    if (!root) {
      return;
    }

    component.db = {} as any;
    component.selectedPage = { groupId: "group-1", path: "docs/page.html" };

    (
      readGroupFile as jest.MockedFunction<typeof readGroupFile>
    ).mockResolvedValue("<main>Hello</main>");

    await component.renderSelectedPage();

    const iframe = root.querySelector("[data-pages-iframe]");
    expect(iframe).toBeInstanceOf(HTMLIFrameElement);
    expect((iframe as HTMLIFrameElement).hidden).toBe(false);
    expect((iframe as HTMLIFrameElement).getAttribute("allow")).toBe(
      "fullscreen; clipboard-write",
    );
    expect((iframe as HTMLIFrameElement).hasAttribute("allowfullscreen")).toBe(
      false,
    );
    expect(setTrustedSrcdoc).toHaveBeenCalledTimes(1);
  });

  it("inlines relative html preview images as data URLs", async () => {
    const component = new ShadowClawPages();

    component.db = {} as any;
    component.selectedPage = { groupId: "group-1", path: "docs/page.html" };

    (
      readGroupFileBytes as jest.MockedFunction<typeof readGroupFileBytes>
    ).mockResolvedValueOnce(new Uint8Array([255, 216, 255, 217]));

    const srcdoc = await component.buildHtmlPageSrcdoc(
      '<main><img src="pic.jpg" /></main>',
      "docs/page.html",
    );

    expect(srcdoc).toContain('src="data:image/jpeg;base64,');
    expect(readGroupFileBytes).toHaveBeenCalledWith(
      {},
      "group-1",
      "docs/pic.jpg",
    );
  });

  it("injects link, font, and theme styles into html page srcdoc to prevent FOUC", async () => {
    const component = new ShadowClawPages();
    component.selectedPage = { groupId: "group-1", path: "docs/page.html" };

    const srcdoc = await component.buildHtmlPageSrcdoc(
      "<main>Hello</main>",
      "docs/page.html",
    );

    expect(srcdoc).toContain("a {");
    expect(srcdoc).toContain("color: var(--shadow-claw-link);");
    expect(srcdoc).toContain("text-decoration: underline;");
    expect(srcdoc).toContain("text-underline-offset: 0.125rem;");
    expect(srcdoc).toContain("a:hover {");
    expect(srcdoc).toContain("color: var(--shadow-claw-link-hover);");
    expect(srcdoc).toContain("body {");
    expect(srcdoc).toContain("color: var(--shadow-claw-text-primary);");
    expect(srcdoc).toContain("font-family: var(--shadow-claw-font-sans);");
    expect(srcdoc).toContain("pre, code, kbd, samp {");
    expect(srcdoc).toContain("font-family: var(--shadow-claw-font-mono);");
  });

  it("inlines workspace-route html image variants", async () => {
    const component = new ShadowClawPages();

    component.db = {} as any;
    component.selectedPage = { groupId: "group-1", path: "docs/page.html" };

    (
      readGroupFileBytes as jest.MockedFunction<typeof readGroupFileBytes>
    ).mockResolvedValue(new Uint8Array([255, 216, 255, 217]));

    const srcdoc = await component.buildHtmlPageSrcdoc(
      '<main><img src="/files/group-1/pic.jpg" /><img src="./files/group-1/pic.jpg" /><img src="files/group-1/pic.jpg" /></main>',
      "docs/page.html",
    );

    expect(srcdoc).toContain('src="data:image/jpeg;base64,');
    expect(readGroupFileBytes).toHaveBeenNthCalledWith(
      1,
      {},
      "group-1",
      "pic.jpg",
    );
    expect(readGroupFileBytes).toHaveBeenNthCalledWith(
      2,
      {},
      "group-1",
      "pic.jpg",
    );
    expect(readGroupFileBytes).toHaveBeenNthCalledWith(
      3,
      {},
      "group-1",
      "pic.jpg",
    );
  });

  it("inlines workspace-route html image variants for group alias ids", async () => {
    const component = new ShadowClawPages();

    component.db = {} as any;
    component.selectedPage = { groupId: "br:main", path: "docs/page.html" };

    (
      readGroupFileBytes as jest.MockedFunction<typeof readGroupFileBytes>
    ).mockResolvedValue(new Uint8Array([255, 216, 255, 217]));

    const srcdoc = await component.buildHtmlPageSrcdoc(
      '<main><img src="/files/main/pic.jpg" /><img src="./files/main/pic.jpg" /><img src="files/main/pic.jpg" /></main>',
      "docs/page.html",
    );

    expect(srcdoc).toContain('src="data:image/jpeg;base64,');
    expect(readGroupFileBytes).toHaveBeenNthCalledWith(
      1,
      {},
      "br:main",
      "pic.jpg",
    );
    expect(readGroupFileBytes).toHaveBeenNthCalledWith(
      2,
      {},
      "br:main",
      "pic.jpg",
    );
    expect(readGroupFileBytes).toHaveBeenNthCalledWith(
      3,
      {},
      "br:main",
      "pic.jpg",
    );
  });

  it("removes the preview iframe when rendering markdown", async () => {
    const component = new ShadowClawPages();

    const root = component.shadowRoot;
    expect(root).not.toBeNull();
    if (!root) {
      return;
    }

    component.db = {} as any;

    component.selectedPage = { groupId: "group-1", path: "docs/page.html" };
    (
      readGroupFile as jest.MockedFunction<typeof readGroupFile>
    ).mockResolvedValueOnce("<main>Hello</main>");
    await component.renderSelectedPage();
    expect(root.querySelector("[data-pages-iframe]")).toBeInstanceOf(
      HTMLIFrameElement,
    );

    component.selectedPage = { groupId: "group-1", path: "docs/page.md" };
    (
      readGroupFile as jest.MockedFunction<typeof readGroupFile>
    ).mockResolvedValueOnce("# Title");

    await component.renderSelectedPage();

    expect(root.querySelector("[data-pages-iframe]")).toBeNull();
    expect(renderMarkdown).toHaveBeenCalledWith("# Title", {
      renderFrontmatter: true,
    });
    expect(setSanitizedHtml).toHaveBeenCalledTimes(1);
  });

  it("is idempotent: skips re-rendering and DOM wiping when called multiple times with identical markdown content", async () => {
    const component = new ShadowClawPages();
    const root = component.shadowRoot;
    expect(root).not.toBeNull();
    if (!root) {
      return;
    }

    component.db = {} as any;
    component.selectedPage = { groupId: "group-1", path: "docs/page.md" };

    (
      readGroupFile as jest.MockedFunction<typeof readGroupFile>
    ).mockResolvedValue("# Unchanged Content");

    // First render: renders and calls setSanitizedHtml
    await component.renderSelectedPage();
    expect(setSanitizedHtml).toHaveBeenCalledTimes(1);

    // Second render with identical content: skips setSanitizedHtml
    await component.renderSelectedPage();
    expect(setSanitizedHtml).toHaveBeenCalledTimes(1);

    // Third render with identical content: still skipped
    await component.renderSelectedPage();
    expect(setSanitizedHtml).toHaveBeenCalledTimes(1);

    // Fourth render with changed content: re-renders
    (
      readGroupFile as jest.MockedFunction<typeof readGroupFile>
    ).mockResolvedValue("# Changed Content");
    await component.renderSelectedPage();
    expect(setSanitizedHtml).toHaveBeenCalledTimes(2);
  });

  it("preserves initial pre-rendered DSD content without re-rendering when DSD page matches on startup", async () => {
    const component = new ShadowClawPages();
    const root = component.shadowRoot;
    expect(root).not.toBeNull();
    if (!root) {
      return;
    }

    // Simulate DSD DOM state
    const dropdownSelected = root.querySelector(
      "[data-pages-dropdown-selected]",
    );
    if (dropdownSelected) {
      dropdownSelected.textContent = "docs/page.md";
    }
    const rendered = root.querySelector("[data-pages-rendered]") as HTMLElement;
    rendered.innerHTML = "<p>DSD Pre-rendered Markup</p>";
    rendered.hidden = false;

    (component as any).dsdInitialPath = "docs/page.md";
    component.db = {} as any;
    component.selectedPage = { groupId: "group-1", path: "docs/page.md" };

    (
      readGroupFile as jest.MockedFunction<typeof readGroupFile>
    ).mockResolvedValue("Markdown Content");

    await component.renderSelectedPage();

    // setSanitizedHtml should NOT have been called, preserving DSD DOM!
    expect(setSanitizedHtml).toHaveBeenCalledTimes(0);
    expect(rendered.innerHTML).toBe("<p>DSD Pre-rendered Markup</p>");
  });

  it("preserves pre-rendered DSD markup in place without creating an iframe when initial HTML page matches selectedPage and iframe is disabled", async () => {
    const configScript = document.createElement("script");
    configScript.id = "shadow-claw-site-config";
    configScript.type = "application/json";
    configScript.textContent = JSON.stringify({ pages: { iframe: false } });
    document.head.appendChild(configScript);

    try {
      const component = new ShadowClawPages();
      const root = component.shadowRoot;
      if (!root) {
        return;
      }

      const rendered = root.querySelector(
        "[data-pages-rendered]",
      ) as HTMLElement;
      rendered.innerHTML =
        "<div id='siteApp'><main><h1>Pre-rendered HTML Page</h1></main></div>";
      rendered.hidden = false;

      (component as any).dsdInitialPath = "index.html";
      component.db = {} as any;
      component.selectedPage = { groupId: "br:main", path: "index.html" };

      (
        readGroupFile as jest.MockedFunction<typeof readGroupFile>
      ).mockResolvedValue(
        "<!doctype html><html><body><div id='siteApp'><main><h1>Pre-rendered HTML Page</h1></main></div></body></html>",
      );

      await component.renderSelectedPage();

      const iframe = root.querySelector("[data-pages-iframe]");
      expect(iframe).toBeNull();
      expect(rendered.hidden).toBe(false);
      expect(rendered.innerHTML).toBe(
        '<div id="siteApp"><main><h1>Pre-rendered HTML Page</h1></main></div>',
      );

      // Subsequent invocations (e.g. from reactive store/routing effects) must keep the rendered DSD content
      await component.renderSelectedPage();
      expect(root.querySelector("[data-pages-iframe]")).toBeNull();
      expect(rendered.hidden).toBe(false);
    } finally {
      configScript.remove();
    }
  });

  it("creates an iframe and renders srcdoc when navigating to a non-DSD HTML page", async () => {
    const component = new ShadowClawPages();
    const root = component.shadowRoot;
    if (!root) {
      return;
    }

    const rendered = root.querySelector("[data-pages-rendered]") as HTMLElement;
    rendered.innerHTML =
      "<div id='siteApp'><main><h1>Pre-rendered HTML Page</h1></main></div>";
    rendered.hidden = false;

    (component as any).dsdInitialPath = "index.html";
    component.db = {} as any;
    // User navigates to a different HTML page
    component.selectedPage = { groupId: "br:main", path: "other.html" };

    (
      readGroupFile as jest.MockedFunction<typeof readGroupFile>
    ).mockResolvedValue(
      "<!doctype html><html><body><h1>Other HTML Page</h1></body></html>",
    );

    await component.renderSelectedPage();

    const iframe = root.querySelector(
      "[data-pages-iframe]",
    ) as HTMLIFrameElement;
    expect(iframe).not.toBeNull();
    expect(iframe.hidden).toBe(false);
    expect(rendered.hidden).toBe(true);
  });

  it("renders an HTML page with frontmatter directly into rendered container when iframe is disabled", async () => {
    const component = new ShadowClawPages();
    const root = component.shadowRoot;
    if (!root) {
      return;
    }

    const rendered = root.querySelector("[data-pages-rendered]") as HTMLElement;
    rendered.innerHTML =
      "<div id='siteApp'><main><h1>Pre-rendered HTML Page</h1></main></div>";
    rendered.hidden = false;

    (component as any).dsdInitialPath = "index.html";
    component.db = {} as any;
    // User navigates to an HTML template page with frontmatter turning iframe off
    component.selectedPage = { groupId: "br:main", path: "portfolio.html" };

    (
      readGroupFile as jest.MockedFunction<typeof readGroupFile>
    ).mockResolvedValue(
      '---\ntitle: "Portfolio"\nslug: "portfolio"\niframe: false\n---\n<article><h2 id="corporate-sites">Corporate Sites</h2></article>',
    );

    await component.renderSelectedPage();

    const iframe = root.querySelector("[data-pages-iframe]");
    expect(iframe).toBeNull();
    expect(rendered.hidden).toBe(false);
    expect(rendered.querySelector("#corporate-sites")).not.toBeNull();
    expect(component.pageFrontmatter.get()).toEqual({
      title: "Portfolio",
      slug: "portfolio",
      iframe: false,
    });
  });

  it("renders an HTML page with frontmatter inside an iframe by default", async () => {
    const component = new ShadowClawPages();
    const root = component.shadowRoot;
    if (!root) {
      return;
    }

    const rendered = root.querySelector("[data-pages-rendered]") as HTMLElement;
    rendered.innerHTML =
      "<div id='siteApp'><main><h1>Pre-rendered HTML Page</h1></main></div>";
    rendered.hidden = false;

    (component as any).dsdInitialPath = "index.html";
    component.db = {} as any;
    component.selectedPage = { groupId: "br:main", path: "portfolio.html" };

    (
      readGroupFile as jest.MockedFunction<typeof readGroupFile>
    ).mockResolvedValue(
      '---\ntitle: "Portfolio"\nslug: "portfolio"\n---\n<article><h2 id="corporate-sites">Corporate Sites</h2></article>',
    );

    await component.renderSelectedPage();

    const iframe = root.querySelector("[data-pages-iframe]");
    expect(iframe).not.toBeNull();
    expect(component.pageFrontmatter.get()).toEqual({
      title: "Portfolio",
      slug: "portfolio",
    });
  });

  it("renders index.html directly into rendered container when siteConfig has pages.iframe: false", async () => {
    const configScript = document.createElement("script");
    configScript.id = "shadow-claw-site-config";
    configScript.type = "application/json";
    configScript.textContent = JSON.stringify({ pages: { iframe: false } });
    document.head.appendChild(configScript);

    try {
      const component = new ShadowClawPages();
      const root = component.shadowRoot;
      if (!root) {
        return;
      }

      const rendered = root.querySelector(
        "[data-pages-rendered]",
      ) as HTMLElement;
      rendered.innerHTML =
        "<div id='siteApp'><main><h1>Initial Feed</h1></main></div>";
      rendered.hidden = false;

      (component as any).dsdInitialPath = "index.html";
      component.db = {} as any;

      // First navigate to a different page (e.g. portfolio)
      component.selectedPage = { groupId: "br:main", path: "portfolio.html" };
      (
        readGroupFile as jest.MockedFunction<typeof readGroupFile>
      ).mockResolvedValue(
        '---\ntitle: "Portfolio"\nslug: "portfolio"\n---\n<article><h2 id="corporate-sites">Corporate Sites</h2></article>',
      );
      await component.renderSelectedPage();
      expect(root.querySelector("[data-pages-iframe]")).toBeNull();

      // Now return to index.html (the root page without frontmatter)
      component.selectedPage = { groupId: "br:main", path: "index.html" };
      (
        readGroupFile as jest.MockedFunction<typeof readGroupFile>
      ).mockResolvedValue(
        "<!doctype html><html><body><div id='siteApp'><main><div id='postsFeed'><h1>Restored Feed</h1></div></main></div></body></html>",
      );
      await component.renderSelectedPage();

      const iframe = root.querySelector("[data-pages-iframe]");
      expect(iframe).toBeNull();
      expect(rendered.hidden).toBe(false);
      expect(rendered.querySelector("#postsFeed")).not.toBeNull();
    } finally {
      configScript.remove();
    }
  });

  it("adopts pre-rendered DSD DOM immediately without blocking on storage read or network fetch", async () => {
    const component = new ShadowClawPages();
    const root = component.shadowRoot;
    if (!root) {
      return;
    }

    const rendered = root.querySelector("[data-pages-rendered]") as HTMLElement;
    rendered.innerHTML = "<div id='siteApp'><h1>Fast SSR</h1></div>";
    rendered.hidden = false;

    (component as any).dsdInitialPath = "index.md";
    component.db = {} as any;
    component.selectedPage = { groupId: "br:main", path: "index.md" };

    // readGroupFile rejects (file not seeded to OPFS yet)
    (
      readGroupFile as jest.MockedFunction<typeof readGroupFile>
    ).mockRejectedValueOnce(new Error("File not found in OPFS"));

    await component.renderSelectedPage();

    expect(rendered.hidden).toBe(false);
    expect(rendered.innerHTML).toBe(
      '<div id="siteApp"><h1>Fast SSR</h1></div>',
    );
    expect(root.querySelector("[data-pages-iframe]")).toBeNull();
  });

  it("falls back to static main manifest/files when readGroupFile fails and seeds to storage", async () => {
    const component = new ShadowClawPages();
    const root = component.shadowRoot;
    if (!root) {
      return;
    }

    component.db = {} as any;

    (
      readGroupFile as jest.MockedFunction<typeof readGroupFile>
    ).mockRejectedValue(new Error("File not found in storage"));

    (
      getStaticPageContent as jest.MockedFunction<typeof getStaticPageContent>
    ).mockResolvedValue("# Fallback Manifest Content");

    component.selectedPage = { groupId: "br:main", path: "posts/test.md" };
    await component.renderSelectedPage();

    expect(getStaticPageContent).toHaveBeenCalledWith("posts/test.md");
    expect(writeGroupFile).toHaveBeenCalledWith(
      component.db,
      "br:main",
      "posts/test.md",
      "# Fallback Manifest Content",
    );
    expect(renderMarkdown).toHaveBeenCalledWith("# Fallback Manifest Content", {
      renderFrontmatter: true,
    });
  });

  it("inlines relative markdown images as data URLs", async () => {
    const component = new ShadowClawPages();

    component.db = {} as any;
    component.selectedPage = { groupId: "group-1", path: "docs/page.md" };

    (
      readGroupFile as jest.MockedFunction<typeof readGroupFile>
    ).mockResolvedValue("![pic](pic.jpg)");
    (
      renderMarkdown as jest.MockedFunction<typeof renderMarkdown>
    ).mockResolvedValueOnce('<p><img src="pic.jpg" /></p>');
    (
      readGroupFileBytes as jest.MockedFunction<typeof readGroupFileBytes>
    ).mockResolvedValueOnce(new Uint8Array([137, 80, 78, 71]));

    await component.renderSelectedPage();

    const rendered = component.shadowRoot?.querySelector(
      "[data-pages-rendered]",
    ) as HTMLElement;
    const img = rendered.querySelector("img");
    expect(img).toBeInstanceOf(HTMLImageElement);
    expect((img as HTMLImageElement).getAttribute("src")).toMatch(
      /^data:image\/jpeg;base64,/u,
    );
  });

  it("inlines workspace-route markdown image variants", async () => {
    const component = new ShadowClawPages();

    component.db = {} as any;

    const container = document.createElement("div");
    container.innerHTML =
      '<img src="/files/group-1/pic.jpg" /><img src="./files/group-1/pic.jpg" /><img src="files/group-1/pic.jpg" />';

    (
      readGroupFileBytes as jest.MockedFunction<typeof readGroupFileBytes>
    ).mockResolvedValue(new Uint8Array([137, 80, 78, 71]));

    await component.resolveMarkdownImages(container, "group-1", "docs/page.md");

    const images = Array.from(container.querySelectorAll("img"));
    expect(readGroupFileBytes).toHaveBeenNthCalledWith(
      1,
      {},
      "group-1",
      "pic.jpg",
    );
    expect(readGroupFileBytes).toHaveBeenNthCalledWith(
      2,
      {},
      "group-1",
      "pic.jpg",
    );
    expect(readGroupFileBytes).toHaveBeenNthCalledWith(
      3,
      {},
      "group-1",
      "pic.jpg",
    );
    expect(images[0]?.getAttribute("src")).toMatch(
      /^data:image\/jpeg;base64,/u,
    );
    expect(images[1]?.getAttribute("src")).toMatch(
      /^data:image\/jpeg;base64,/u,
    );
    expect(images[2]?.getAttribute("src")).toMatch(
      /^data:image\/jpeg;base64,/u,
    );
  });

  it("inlines workspace-route markdown image variants for group alias ids", async () => {
    const component = new ShadowClawPages();

    component.db = {} as any;

    const container = document.createElement("div");
    container.innerHTML =
      '<img src="/files/main/pic.jpg" /><img src="./files/main/pic.jpg" /><img src="files/main/pic.jpg" />';

    (
      readGroupFileBytes as jest.MockedFunction<typeof readGroupFileBytes>
    ).mockResolvedValue(new Uint8Array([137, 80, 78, 71]));

    await component.resolveMarkdownImages(container, "br:main", "docs/page.md");

    expect(readGroupFileBytes).toHaveBeenNthCalledWith(
      1,
      {},
      "br:main",
      "pic.jpg",
    );
    expect(readGroupFileBytes).toHaveBeenNthCalledWith(
      2,
      {},
      "br:main",
      "pic.jpg",
    );
    expect(readGroupFileBytes).toHaveBeenNthCalledWith(
      3,
      {},
      "br:main",
      "pic.jpg",
    );
  });

  it("inlines nested cross-group workspace route image URLs", async () => {
    const component = new ShadowClawPages();

    component.db = {} as any;
    component.selectedPage = {
      groupId: "br:01KT4NGEM3T94M0FGHJYVNGS7M",
      path: "docs/page.md",
    };

    const previousGroups = (orchestratorStore as any).groups;
    (orchestratorStore as any).groups = [
      { groupId: "br:01KT4NGEM3T94M0FGHJYVNGS7M" },
      { groupId: "br:main" },
    ];

    const container = document.createElement("div");
    const origin = window.location.origin;
    container.innerHTML = `<img src="${origin}/files/br%3A01KT4NGEM3T94M0FGHJYVNGS7M/files/main/pic.jpg" />`;

    (
      readGroupFileBytes as jest.MockedFunction<typeof readGroupFileBytes>
    ).mockResolvedValue(new Uint8Array([137, 80, 78, 71]));

    await component.resolveMarkdownImages(
      container,
      "br:01KT4NGEM3T94M0FGHJYVNGS7M",
      "docs/page.md",
    );

    expect(readGroupFileBytes).toHaveBeenCalledWith({}, "br:main", "pic.jpg");

    (orchestratorStore as any).groups = previousGroups;
  });

  describe("rendered link rewriting", () => {
    it("rewrites relative links and images to /files routes", () => {
      const component = new ShadowClawPages();
      component.selectedPage = { groupId: "group-1", path: "docs/index.md" };

      const html =
        '<p><a href="guide.md">Guide</a><img src="./img/logo.png" /></p>';

      const rewritten = component.rewriteWorkspacePreviewHtml(
        html,
        "docs/index.md",
      );

      expect(rewritten).toContain('href="/files/group-1/docs/guide.md"');
      expect(rewritten).toContain('src="/files/group-1/docs/img/logo.png"');
    });

    it("keeps external links untouched", () => {
      const component = new ShadowClawPages();
      component.selectedPage = { groupId: "group-1", path: "docs/index.md" };

      const html = '<a href="https://example.com/page">External</a>';
      const rewritten = component.rewriteWorkspacePreviewHtml(
        html,
        "docs/index.md",
      );

      expect(rewritten).toContain('href="https://example.com/page"');
    });

    it("keeps same-origin external application links (e.g. block-garden) untouched", () => {
      const component = new ShadowClawPages();
      component.selectedPage = { groupId: "group-1", path: "docs/index.md" };

      const origin = window.location.origin;
      const externalLink = `${origin}/block-garden/?gettingStarted=false`;
      const html = `<a href="${externalLink}">Block Garden</a>`;
      const rewritten = component.rewriteWorkspacePreviewHtml(
        html,
        "docs/index.md",
      );

      expect(rewritten).toContain(`href="${externalLink}"`);
    });

    it("opens same-origin external application links in a new window via handleIframeMessage", () => {
      const windowOpenSpy = jest
        .spyOn(window, "open")
        .mockImplementation(() => null);
      const component = new ShadowClawPages();
      component.db = {} as any;
      component.selectedPage = { groupId: "br:main", path: "README.md" };

      const origin = window.location.origin;
      const targetUrl = `${origin}/block-garden/?gettingStarted=false`;

      const event = {
        source: null,
        data: {
          type: "shadow-claw-file-viewer-link",
          href: targetUrl,
        },
      } as MessageEvent;

      component.handleIframeMessage(event);

      expect(windowOpenSpy).toHaveBeenCalledWith(
        targetUrl,
        "_blank",
        "noopener,noreferrer",
      );
      windowOpenSpy.mockRestore();
    });
  });

  describe("pages sub-sidebar and list enhancements", () => {
    it("sidebar is closed by default and toggle button toggles sidebar and dropdown visibility", async () => {
      const component = new ShadowClawPages();
      await component.connectedCallback();
      const root = component.shadowRoot;
      expect(root).not.toBeNull();
      if (!root) return;

      const toggleBtn = root.querySelector(
        "[data-pages-sidebar-toggle]",
      ) as HTMLButtonElement;
      const dropdown = root.querySelector(
        "[data-pages-dropdown]",
      ) as HTMLDetailsElement;
      const sidebar = root.querySelector(".pages__sidebar");
      const content = root.querySelector(".pages__content");

      expect(toggleBtn).toBeInstanceOf(HTMLButtonElement);
      expect(dropdown).toBeInstanceOf(HTMLDetailsElement);
      expect(component.sidebarOpen).toBe(false);
      expect(sidebar?.classList.contains("collapsed")).toBe(true);
      expect(
        content?.classList.contains("pages__content--sidebar-collapsed"),
      ).toBe(true);
      expect(dropdown.hasAttribute("open")).toBe(false);

      // First click: opens both sidebar and dropdown
      toggleBtn.click();
      expect(component.sidebarOpen).toBe(true);
      expect(sidebar?.classList.contains("collapsed")).toBe(false);
      expect(
        content?.classList.contains("pages__content--sidebar-collapsed"),
      ).toBe(false);
      expect(dropdown.hasAttribute("open")).toBe(true);

      // Second click: closes both sidebar and dropdown
      toggleBtn.click();
      expect(component.sidebarOpen).toBe(false);
      expect(sidebar?.classList.contains("collapsed")).toBe(true);
      expect(
        content?.classList.contains("pages__content--sidebar-collapsed"),
      ).toBe(true);
      expect(dropdown.hasAttribute("open")).toBe(false);
    });

    it("clicking outside closes open dropdown but clicking toggle button closes open dropdown", async () => {
      const component = new ShadowClawPages();
      await component.connectedCallback();
      const root = component.shadowRoot;
      expect(root).not.toBeNull();
      if (!root) return;

      const toggleBtn = root.querySelector(
        "[data-pages-sidebar-toggle]",
      ) as HTMLButtonElement;
      const dropdown = root.querySelector(
        "[data-pages-dropdown]",
      ) as HTMLDetailsElement;
      const empty = root.querySelector("[data-pages-empty]") as HTMLElement;

      toggleBtn.click();
      expect(dropdown.hasAttribute("open")).toBe(true);

      // Click outside dropdown
      empty.click();
      expect(dropdown.hasAttribute("open")).toBe(false);
    });

    it("clicking X calls requestConfirmation rather than immediately calling removePage", async () => {
      const component = new ShadowClawPages();
      await component.connectedCallback();
      component.db = {} as any;
      (
        requestConfirmation as jest.MockedFunction<typeof requestConfirmation>
      ).mockResolvedValueOnce(false);

      const root = component.shadowRoot;
      if (!root) return;

      const pages = [
        { groupId: "group-1", path: "docs/first.md" },
        { groupId: "group-1", path: "docs/second.md" },
      ];
      component.renderPageList(pages, []);

      const removeBtn = root.querySelector(
        ".pages__remove",
      ) as HTMLButtonElement;
      expect(removeBtn).not.toBeNull();

      removeBtn.click();
      await Promise.resolve();

      expect(requestConfirmation).toHaveBeenCalledWith({
        title: "Remove Page",
        message: expect.stringContaining("docs/first.md"),
        confirmLabel: "Remove",
        cancelLabel: "Cancel",
      });
      expect(orchestratorStore.removePage).not.toHaveBeenCalled();
    });

    it("removes page when confirmation dialog is accepted", async () => {
      const component = new ShadowClawPages();
      await component.connectedCallback();
      component.db = {} as any;
      (
        requestConfirmation as jest.MockedFunction<typeof requestConfirmation>
      ).mockResolvedValueOnce(true);

      const root = component.shadowRoot;
      if (!root) return;

      const pages = [{ groupId: "group-1", path: "docs/first.md" }];
      component.renderPageList(pages, []);

      const removeBtn = root.querySelector(
        ".pages__remove",
      ) as HTMLButtonElement;
      removeBtn.click();
      await Promise.resolve();

      expect(orchestratorStore.removePage).toHaveBeenCalledWith(
        component.db,
        "docs/first.md",
        "group-1",
      );
    });

    it("clicking edit icon opens file in fileViewerStore", async () => {
      const { fileViewerStore } = await import("../../stores/file-viewer.js");
      const component = new ShadowClawPages();
      await component.connectedCallback();
      component.db = {} as any;
      const root = component.shadowRoot;
      if (!root) return;

      const pages = [{ groupId: "group-1", path: "docs/page.md" }];
      component.renderPageList(pages, []);

      const editBtn = root.querySelector(".pages__edit") as HTMLButtonElement;
      expect(editBtn).not.toBeNull();

      editBtn.click();
      await Promise.resolve();
      await Promise.resolve();

      expect(fileViewerStore.openFile).toHaveBeenCalledWith(
        component.db,
        "docs/page.md",
        "group-1",
      );
    });

    it("reorders list items and calls orchestratorStore.reorderPages", async () => {
      const component = new ShadowClawPages();
      component.db = {} as any;

      const pages = [
        { groupId: "group-1", path: "docs/first.md" },
        { groupId: "group-1", path: "docs/second.md" },
      ];
      (orchestratorStore as any).pages = pages;

      await component.handleReorder(0, 1);
      expect(orchestratorStore.reorderPages).toHaveBeenCalledWith(
        component.db,
        [
          { groupId: "group-1", path: "docs/second.md" },
          { groupId: "group-1", path: "docs/first.md" },
        ],
      );
    });

    it("only stars the top-most page as default and inherits star when reordered to top", async () => {
      const component = new ShadowClawPages();
      component.db = {} as any;
      const root = component.shadowRoot;
      if (!root) return;

      const pages = [
        { groupId: "group-1", path: "docs/first.md" },
        { groupId: "group-1", path: "docs/second.md" },
      ];
      (orchestratorStore as any).pages = pages;

      component.renderPageList(pages, []);

      const primaryList = root.querySelector("[data-pages-list]");
      const listItems =
        primaryList?.querySelectorAll(".pages__list-item") || [];
      expect(listItems.length).toBe(2);

      // Top-most page (index 0) has the star element
      const topStar = listItems[0]?.querySelector(".pages__default-btn");
      expect(topStar).not.toBeNull();
      expect(topStar?.textContent).toBe("⭐");

      // Second page (index 1) has no star element
      const secondStar = listItems[1]?.querySelector(".pages__default-btn");
      expect(secondStar).toBeNull();

      // When second page is reordered to top position, re-render places star on newly top page
      const reorderedPages = [
        { groupId: "group-1", path: "docs/second.md" },
        { groupId: "group-1", path: "docs/first.md" },
      ];
      (orchestratorStore as any).pages = reorderedPages;
      component.renderPageList(reorderedPages, []);

      const primaryListReordered = root.querySelector("[data-pages-list]");
      const reorderedItems =
        primaryListReordered?.querySelectorAll(".pages__list-item") || [];
      const newTopStar = reorderedItems[0]?.querySelector(
        ".pages__default-btn",
      );
      expect(newTopStar).not.toBeNull();
      expect(newTopStar?.textContent).toBe("⭐");

      const newSecondStar = reorderedItems[1]?.querySelector(
        ".pages__default-btn",
      );
      expect(newSecondStar).toBeNull();
      expect(orchestratorStore.effectiveDefaultPage).toEqual({
        groupId: "group-1",
        path: "docs/second.md",
      });
    });

    it("dispatches shadow-claw-navigate event when a page item in the page list is clicked", async () => {
      const component = new ShadowClawPages();
      component.db = {} as any;
      const root = component.shadowRoot;
      if (!root) return;

      const pages = [{ groupId: "br:main", path: "MEMORY.md" }];
      (orchestratorStore as any).pages = pages;

      component.renderPageList(pages, []);

      const navigateListener = jest.fn();
      document.addEventListener("shadow-claw-navigate", navigateListener);

      const selectBtn = root.querySelector(
        ".pages__select",
      ) as HTMLButtonElement;
      expect(selectBtn).not.toBeNull();

      selectBtn.click();

      expect(navigateListener).toHaveBeenCalledTimes(1);
      const event = navigateListener.mock.calls[0][0] as CustomEvent;
      expect(event.detail).toEqual({
        page: "pages",
        groupId: "br:main",
        path: "MEMORY.md",
      });

      document.removeEventListener("shadow-claw-navigate", navigateListener);
    });

    it("puts page into view, selects it, and dispatches navigate event when reordered to top position", async () => {
      const component = new ShadowClawPages();
      component.db = {} as any;
      const root = component.shadowRoot;
      if (!root) return;

      const renderSpy = jest
        .spyOn(component, "renderSelectedPage")
        .mockImplementation(async () => {});

      const pages = [
        { groupId: "group-1", path: "docs/first.md" },
        { groupId: "group-1", path: "docs/second.md" },
      ];
      (orchestratorStore as any).pages = pages;

      const navigateListener = jest.fn();
      document.addEventListener("shadow-claw-navigate", navigateListener);

      await component.handleReorder(1, 0);

      expect(component.selectedPage).toEqual({
        groupId: "group-1",
        path: "docs/second.md",
      });
      expect(renderSpy).toHaveBeenCalled();
      expect(navigateListener).toHaveBeenCalledTimes(1);
      const event = navigateListener.mock.calls[0][0] as CustomEvent;
      expect(event.detail).toEqual({
        page: "pages",
        groupId: "group-1",
        path: "docs/second.md",
      });

      document.removeEventListener("shadow-claw-navigate", navigateListener);
      renderSpy.mockRestore();
    });

    it("clears static pre-rendered DSD content on connectedCallback when sc-prerender-override class is set on <html>", async () => {
      // The component now reads the authoritative sc-prerender-override class
      // set by theme-init.ts rather than checking localStorage directly.
      // This covers both the explicit "true" case and the null→__PRERENDER_MAIN_MEMORY__
      // default case.
      document.documentElement.classList.add("sc-prerender-override");

      const component = new ShadowClawPages();
      const root = component.shadowRoot;
      if (!root) return;

      const rendered = root.querySelector(
        "[data-pages-rendered]",
      ) as HTMLElement;
      expect(rendered).not.toBeNull();
      rendered.textContent = "Welcome to ShadowClaw Pages (DSD seed)";
      rendered.hidden = false;

      await component.connectedCallback();

      expect(rendered.hidden).toBe(true);
      expect(rendered.textContent).toBe("");

      document.documentElement.classList.remove("sc-prerender-override");
    });

    it("does NOT clear SSR content when sc-prerender-override class is absent and data-prerender-no-seed is absent", async () => {
      // Regression: with localStorage key absent (null), the old code returned
      // false and left SSR content intact. Now we rely on the class, which is
      // absent here — so SSR textContent should NOT be cleared by the
      // isOverride/isNoSeed guard.
      // We spy on renderSelectedPage to prevent it running (it also clears
      // textContent when no page is selected) so we can isolate the guard.
      document.documentElement.classList.remove("sc-prerender-override");

      const component = new ShadowClawPages();
      jest
        .spyOn(component, "renderSelectedPage")
        .mockImplementation(async () => {});

      const root = component.shadowRoot;
      if (!root) return;

      const rendered = root.querySelector(
        "[data-pages-rendered]",
      ) as HTMLElement;
      expect(rendered).not.toBeNull();
      const originalContent = "SSR seed content";
      rendered.textContent = originalContent;

      await component.connectedCallback();

      // textContent must not have been cleared by the isOverride branch
      expect(rendered.textContent).toBe(originalContent);
    });

    it("does NOT clear SSR content when sc-prerender-override class is absent even if host has data-prerender-no-seed='true'", async () => {
      document.documentElement.classList.remove("sc-prerender-override");

      const host = document.createElement("shadow-claw");
      host.setAttribute("data-prerender-no-seed", "true");
      document.body.appendChild(host);

      const component = new ShadowClawPages();
      host.appendChild(component);

      jest
        .spyOn(component, "renderSelectedPage")
        .mockImplementation(async () => {});

      const root = component.shadowRoot;
      if (!root) {
        host.remove();
        return;
      }

      const rendered = root.querySelector(
        "[data-pages-rendered]",
      ) as HTMLElement;
      expect(rendered).not.toBeNull();
      const originalContent = "SSR seed content";
      rendered.textContent = originalContent;
      rendered.hidden = false;

      await component.connectedCallback();

      expect(rendered.textContent).toBe(originalContent);
      expect(rendered.hidden).toBe(false);

      host.remove();
    });

    it("disables Remove All button when pages list is empty and enables it when pages exist", async () => {
      const component = new ShadowClawPages();
      await component.connectedCallback();
      const root = component.shadowRoot;
      if (!root) return;

      const clearBtn = root.querySelector(
        ".pages__remove-all-btn",
      ) as HTMLElement;
      expect(clearBtn).not.toBeNull();

      component.renderPageList([], []);
      expect(clearBtn.hasAttribute("disabled")).toBe(true);

      component.renderPageList(
        [{ groupId: "group-1", path: "docs/first.md" }],
        [],
      );
      expect(clearBtn.hasAttribute("disabled")).toBe(false);
    });

    it("clicking Remove All prompts for confirmation and calls removeAllPages when confirmed", async () => {
      const component = new ShadowClawPages();
      await component.connectedCallback();
      component.db = {} as any;
      const root = component.shadowRoot;
      if (!root) return;

      (requestConfirmation as jest.MockedFunction<typeof requestConfirmation>)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      component.renderPageList(
        [{ groupId: "group-1", path: "docs/first.md" }],
        [],
      );

      const clearBtn = root.querySelector(
        ".pages__remove-all-btn",
      ) as HTMLElement;

      // 1. Canceled
      clearBtn.click();
      await Promise.resolve();
      expect(requestConfirmation).toHaveBeenNthCalledWith(1, {
        title: "Remove All Pages",
        message: expect.stringContaining("Remove ALL saved pages"),
        confirmLabel: "Remove All",
        cancelLabel: "Cancel",
      });
      expect(orchestratorStore.removeAllPages).not.toHaveBeenCalled();

      // 2. Confirmed
      clearBtn.click();
      await Promise.resolve();
      await Promise.resolve();
      expect(orchestratorStore.removeAllPages).toHaveBeenCalledWith(
        component.db,
      );
    });
  });

  describe("pages prev/next navigation buttons", () => {
    it("disables both buttons when zero pages exist", async () => {
      const component = new ShadowClawPages();
      await component.connectedCallback();
      const root = component.shadowRoot;
      if (!root) return;

      const prevBtn = root.querySelector(
        "[data-pages-prev]",
      ) as HTMLButtonElement;
      const nextBtn = root.querySelector(
        "[data-pages-next]",
      ) as HTMLButtonElement;

      (orchestratorStore as any).pages = [];
      component.renderPageList([], []);
      await Promise.resolve(); // Wait for effect

      expect(prevBtn.disabled).toBe(true);
      expect(nextBtn.disabled).toBe(true);
    });

    it("disables prev button on first page and next button on last page", async () => {
      const component = new ShadowClawPages();
      await component.connectedCallback();
      const root = component.shadowRoot;
      if (!root) return;

      const pages = [
        { groupId: "group-1", path: "docs/first.md" },
        { groupId: "group-1", path: "docs/second.md" },
      ];
      (orchestratorStore as any).pages = pages;

      const prevBtn = root.querySelector(
        "[data-pages-prev]",
      ) as HTMLButtonElement;
      const nextBtn = root.querySelector(
        "[data-pages-next]",
      ) as HTMLButtonElement;

      component.selectedPage = pages[0];
      component.renderPageList(pages, []);
      await Promise.resolve(); // wait for effects

      expect(prevBtn.disabled).toBe(true);
      expect(nextBtn.disabled).toBe(false);

      component.selectedPage = pages[1];
      component.renderPageList(pages, []);
      await Promise.resolve();

      expect(prevBtn.disabled).toBe(false);
      expect(nextBtn.disabled).toBe(true);
    });

    it("navigates to correct adjacent page when clicked and dispatches navigation event", async () => {
      const component = new ShadowClawPages();
      await component.connectedCallback();
      const root = component.shadowRoot;
      if (!root) return;

      const pages = [
        { groupId: "group-1", path: "docs/first.md" },
        { groupId: "group-1", path: "docs/second.md" },
        { groupId: "group-1", path: "docs/third.md" },
      ];
      (orchestratorStore as any).pages = pages;
      component.selectedPage = pages[1]; // middle page
      component.renderPageList(pages, []);
      await Promise.resolve();

      const prevBtn = root.querySelector(
        "[data-pages-prev]",
      ) as HTMLButtonElement;
      const nextBtn = root.querySelector(
        "[data-pages-next]",
      ) as HTMLButtonElement;

      const navigateListener = jest.fn();
      document.addEventListener("shadow-claw-navigate", navigateListener);

      // Click next
      nextBtn.click();
      expect(component.selectedPage).toEqual(pages[2]);
      expect(navigateListener).toHaveBeenCalledTimes(1);

      const nextEvent = navigateListener.mock.calls[0][0] as CustomEvent;
      expect(nextEvent.detail).toEqual({
        page: "pages",
        groupId: "group-1",
        path: "docs/third.md",
      });

      // Click prev
      navigateListener.mockClear();
      prevBtn.click();
      expect(component.selectedPage).toEqual(pages[1]);
      expect(navigateListener).toHaveBeenCalledTimes(1);

      const prevEvent = navigateListener.mock.calls[0][0] as CustomEvent;
      expect(prevEvent.detail).toEqual({
        page: "pages",
        groupId: "group-1",
        path: "docs/second.md",
      });

      document.removeEventListener("shadow-claw-navigate", navigateListener);
    });
  });

  describe("pages auto refresh and dynamic content reload", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("starts auto refresh timer when pages_auto_refresh_interval setting is > 0", async () => {
      (
        getConfig as jest.MockedFunction<typeof getConfig>
      ).mockResolvedValueOnce("5");

      const component = new ShadowClawPages();
      Object.defineProperty(component, "isConnected", {
        get: () => true,
        configurable: true,
      });
      component.db = {} as any;
      component.selectedPage = { groupId: "group-1", path: "docs/page.md" };

      const renderSpy = jest
        .spyOn(component, "renderSelectedPage")
        .mockResolvedValue();

      await component.setupAutoRefreshTimer();
      expect(component.autoRefreshIntervalSec).toBe(5);
      expect(component.autoRefreshTimer).not.toBeNull();

      jest.advanceTimersByTime(5000);
      expect(renderSpy).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(5000);
      expect(renderSpy).toHaveBeenCalledTimes(2);

      component.disconnectedCallback();
      expect(component.autoRefreshTimer).toBeNull();
    });

    it("defaults to interval 0 (disabled) when interval setting is 0 or unset", async () => {
      (
        getConfig as jest.MockedFunction<typeof getConfig>
      ).mockResolvedValueOnce("0");

      const component = new ShadowClawPages();
      Object.defineProperty(component, "isConnected", {
        get: () => true,
        configurable: true,
      });
      component.db = {} as any;

      await component.setupAutoRefreshTimer();
      expect(component.autoRefreshIntervalSec).toBe(0);
      expect(component.autoRefreshTimer).toBeNull();
    });

    it("pauses timer when document is hidden and resumes when visible", async () => {
      const component = new ShadowClawPages();
      Object.defineProperty(component, "isConnected", {
        get: () => true,
        configurable: true,
      });
      component.db = {} as any;
      component.autoRefreshIntervalSec = 2;

      const renderSpy = jest
        .spyOn(component, "renderSelectedPage")
        .mockResolvedValue();
      const setupSpy = jest
        .spyOn(component, "setupAutoRefreshTimer")
        .mockImplementation(async () => {});

      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => true,
      });

      component.handleVisibilityChange();
      expect(component.autoRefreshTimer).toBeNull();

      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => false,
      });

      component.handleVisibilityChange();
      expect(renderSpy).toHaveBeenCalled();
      expect(setupSpy).toHaveBeenCalled();

      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => false,
      });
    });

    it("updates interval dynamically when shadow-claw-pages-auto-refresh-change event is dispatched", async () => {
      const component = new ShadowClawPages();
      Object.defineProperty(component, "isConnected", {
        get: () => true,
        configurable: true,
      });
      component.db = {} as any;

      const setupSpy = jest
        .spyOn(component, "setupAutoRefreshTimer")
        .mockImplementation(async () => {});

      const customEvent = new CustomEvent(
        "shadow-claw-pages-auto-refresh-change",
        {
          detail: { interval: 10 },
        },
      );

      component.handleAutoRefreshConfigChange(customEvent);
      expect(component.autoRefreshIntervalSec).toBe(10);
      expect(setupSpy).toHaveBeenCalled();
    });

    it("re-renders selected page when window receives focus event", async () => {
      const component = new ShadowClawPages();
      Object.defineProperty(component, "isConnected", {
        get: () => true,
        configurable: true,
      });
      component.db = {} as any;

      const renderSpy = jest
        .spyOn(component, "renderSelectedPage")
        .mockResolvedValue();

      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => false,
      });

      component.handleWindowFocus();
      expect(renderSpy).toHaveBeenCalled();
    });

    it("re-renders selected page when shadow-claw-file-saved event matches the currently selected page", async () => {
      const component = new ShadowClawPages();
      component.db = {} as any;

      const renderSpy = jest
        .spyOn(component, "renderSelectedPage")
        .mockImplementation(async () => {});

      component.selectedPage = { groupId: "group-1", path: "docs/page.md" };
      renderSpy.mockClear();

      await component.connectedCallback();
      renderSpy.mockClear();

      document.dispatchEvent(
        new CustomEvent("shadow-claw-file-saved", {
          detail: { groupId: "group-1", path: "docs/page.md" },
        }),
      );

      expect(renderSpy).toHaveBeenCalled();
      renderSpy.mockRestore();
    });

    it("ignores shadow-claw-file-saved event for a page other than the currently selected one", async () => {
      const component = new ShadowClawPages();
      component.db = {} as any;

      const renderSpy = jest
        .spyOn(component, "renderSelectedPage")
        .mockImplementation(async () => {});

      component.selectedPage = { groupId: "group-1", path: "docs/page.md" };
      renderSpy.mockClear();

      await component.connectedCallback();
      renderSpy.mockClear();

      document.dispatchEvent(
        new CustomEvent("shadow-claw-file-saved", {
          detail: { groupId: "group-1", path: "docs/other.md" },
        }),
      );

      expect(renderSpy).not.toHaveBeenCalled();
      renderSpy.mockRestore();
    });

    it("re-renders content when navigating between nested posts", async () => {
      const component = new ShadowClawPages();
      const root = component.shadowRoot;
      expect(root).not.toBeNull();
      if (!root) return;

      component.db = {} as any;

      const post1 = {
        groupId: "br:main",
        path: "posts/2026/07/01/2026-07-01_03-37-38.md",
      };
      const post2 = {
        groupId: "br:main",
        path: "posts/2025/12/31/2025-12-31_00-08-00.md",
      };

      (
        readGroupFile as jest.MockedFunction<typeof readGroupFile>
      ).mockImplementation(async (_db: any, _groupId: string, path: string) => {
        if (path === post1.path) return "# Post 1 Content";
        throw new Error("Not in DB");
      });

      (
        getStaticPageContent as jest.MockedFunction<typeof getStaticPageContent>
      ).mockImplementation(async (path: string) => {
        if (path === post2.path) return "# Post 2 Static Content";
        return null;
      });

      // Navigate to Post 1
      component.selectedPage = post1;
      await component.renderSelectedPage();

      const rendered = root.querySelector(
        "[data-pages-rendered]",
      ) as HTMLElement;
      expect(rendered.hidden).toBe(false);
      expect(renderMarkdown).toHaveBeenCalledWith("# Post 1 Content", {
        renderFrontmatter: true,
      });

      // Navigate to Post 2 (triggers fallback to getStaticPageContent and writes to DB)
      component.selectedPage = post2;
      await component.renderSelectedPage();

      expect(getStaticPageContent).toHaveBeenCalledWith(post2.path);
      expect(writeGroupFile).toHaveBeenCalledWith(
        component.db,
        "br:main",
        post2.path,
        "# Post 2 Static Content",
      );
      expect(renderMarkdown).toHaveBeenCalledWith("# Post 2 Static Content", {
        renderFrontmatter: true,
      });
      expect(rendered.hidden).toBe(false);
    });

    it("updates iframe height when receiving shadow-claw-iframe-resize message", () => {
      const component = new ShadowClawPages();
      component.db = {} as any;

      const iframe = document.createElement("iframe");
      iframe.setAttribute("data-pages-iframe", "");
      const fakeWindow = { postMessage: jest.fn() } as unknown as Window;
      component.previewFrameWindow = fakeWindow;

      const root =
        component.shadowRoot || component.attachShadow({ mode: "open" });
      root.appendChild(iframe);

      component.handleIframeMessage({
        data: { type: "shadow-claw-iframe-resize", height: 850 },
        source: fakeWindow,
      } as MessageEvent);

      expect(iframe.style.height).toBe("850px");
      component.previewFrameWindow = null;
    });
  });

  describe("pages keyboard and swipe navigation", () => {
    it("navigates with ArrowLeft and ArrowRight keys", async () => {
      const component = new ShadowClawPages();
      document.body.appendChild(component);
      await component.connectedCallback();
      const root = component.shadowRoot;
      if (!root) return;

      const pages = [
        { groupId: "group-1", path: "docs/first.md" },
        { groupId: "group-1", path: "docs/second.md" },
        { groupId: "group-1", path: "docs/third.md" },
      ];
      (orchestratorStore as any).pages = pages;
      component.selectedPage = pages[1]; // middle page
      component.renderPageList(pages, []);
      await Promise.resolve();

      const navigateListener = jest.fn();
      document.addEventListener("shadow-claw-navigate", navigateListener);

      // Press ArrowRight -> goToNextPage (docs/third.md)
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      );
      expect(component.selectedPage).toEqual(pages[2]);
      expect(navigateListener).toHaveBeenCalledTimes(1);

      // Press ArrowLeft -> goToPreviousPage (docs/second.md)
      navigateListener.mockClear();
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
      );
      expect(component.selectedPage).toEqual(pages[1]);
      expect(navigateListener).toHaveBeenCalledTimes(1);

      document.removeEventListener("shadow-claw-navigate", navigateListener);
      if (component.parentNode) {
        component.parentNode.removeChild(component);
      }
    });

    it("throttles keyboard navigation when holding down arrow keys", async () => {
      const component = new ShadowClawPages();
      document.body.appendChild(component);
      await component.connectedCallback();
      const root = component.shadowRoot;
      if (!root) return;

      const pages = [
        { groupId: "group-1", path: "docs/first.md" },
        { groupId: "group-1", path: "docs/second.md" },
        { groupId: "group-1", path: "docs/third.md" },
        { groupId: "group-1", path: "docs/fourth.md" },
      ];
      (orchestratorStore as any).pages = pages;
      component.selectedPage = pages[0]; // first page
      component.renderPageList(pages, []);
      await Promise.resolve();

      const navigateListener = jest.fn();
      document.addEventListener("shadow-claw-navigate", navigateListener);

      // Initial press: navigates to second page
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      );
      expect(component.selectedPage).toEqual(pages[1]);
      expect(navigateListener).toHaveBeenCalledTimes(1);

      // Immediate repeated press (simulating holding down key): throttled!
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowRight",
          bubbles: true,
          repeat: true,
        }),
      );
      expect(component.selectedPage).toEqual(pages[1]);
      expect(navigateListener).toHaveBeenCalledTimes(1);

      // Advance navigation timestamp past throttle interval
      component.keyNavState.lastNavigationTime -= 350;

      // Repeat after throttle interval: navigates to third page
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowRight",
          bubbles: true,
          repeat: true,
        }),
      );
      expect(component.selectedPage).toEqual(pages[2]);
      expect(navigateListener).toHaveBeenCalledTimes(2);

      document.removeEventListener("shadow-claw-navigate", navigateListener);
      if (component.parentNode) {
        component.parentNode.removeChild(component);
      }
    });

    it("suppresses keyboard navigation when focus is inside editable elements or sidebar list", async () => {
      const component = new ShadowClawPages();
      await component.connectedCallback();
      const root = component.shadowRoot;
      if (!root) return;

      const pages = [
        { groupId: "group-1", path: "docs/first.md" },
        { groupId: "group-1", path: "docs/second.md" },
      ];
      (orchestratorStore as any).pages = pages;
      component.selectedPage = pages[1];
      component.renderPageList(pages, []);

      // Inside input
      const input = document.createElement("input");
      document.body.appendChild(input);
      input.focus();

      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      );
      expect(component.selectedPage).toEqual(pages[1]);

      document.body.removeChild(input);

      // With modifier key (Ctrl)
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowRight",
          ctrlKey: true,
          bubbles: true,
        }),
      );
      expect(component.selectedPage).toEqual(pages[1]);
    });

    it("triggers navigation on horizontal swipe touch gestures", async () => {
      const component = new ShadowClawPages();
      await component.connectedCallback();
      const root = component.shadowRoot;
      if (!root) return;

      const pages = [
        { groupId: "group-1", path: "docs/first.md" },
        { groupId: "group-1", path: "docs/second.md" },
        { groupId: "group-1", path: "docs/third.md" },
      ];
      (orchestratorStore as any).pages = pages;
      component.selectedPage = pages[1];

      // Swipe Left (deltaX = -100) -> goToNextPage (docs/third.md)
      component.handleTouchStart({
        touches: [{ clientX: 200, clientY: 100 }],
      } as any);
      component.handleTouchEnd({
        changedTouches: [{ clientX: 100, clientY: 105 }],
      } as any);

      expect(component.selectedPage).toEqual(pages[2]);

      // Swipe Right (deltaX = 100) -> goToPreviousPage (docs/second.md)
      component.handleTouchStart({
        touches: [{ clientX: 100, clientY: 100 }],
      } as any);
      component.handleTouchEnd({
        changedTouches: [{ clientX: 200, clientY: 105 }],
      } as any);

      expect(component.selectedPage).toEqual(pages[1]);
    });

    it("ignores swipes below threshold or predominantly vertical swipes", async () => {
      const component = new ShadowClawPages();
      await component.connectedCallback();
      const root = component.shadowRoot;
      if (!root) return;

      const pages = [
        { groupId: "group-1", path: "docs/first.md" },
        { groupId: "group-1", path: "docs/second.md" },
      ];
      (orchestratorStore as any).pages = pages;
      component.selectedPage = pages[1];

      // Small distance (deltaX = -20)
      component.handleTouchStart({
        touches: [{ clientX: 100, clientY: 100 }],
      } as any);
      component.handleTouchEnd({
        changedTouches: [{ clientX: 80, clientY: 100 }],
      } as any);

      expect(component.selectedPage).toEqual(pages[1]);

      // Vertical swipe (deltaX = -60, deltaY = 120)
      component.handleTouchStart({
        touches: [{ clientX: 100, clientY: 100 }],
      } as any);
      component.handleTouchEnd({
        changedTouches: [{ clientX: 40, clientY: 220 }],
      } as any);

      expect(component.selectedPage).toEqual(pages[1]);
    });

    it("triggers navigation on horizontal mouse gestures", async () => {
      const component = new ShadowClawPages();
      await component.connectedCallback();
      const root = component.shadowRoot;
      if (!root) return;

      const pages = [
        { groupId: "group-1", path: "docs/first.md" },
        { groupId: "group-1", path: "docs/second.md" },
        { groupId: "group-1", path: "docs/third.md" },
      ];
      (orchestratorStore as any).pages = pages;
      component.selectedPage = pages[1];

      // Gesture Left (deltaX = -100) -> goToNextPage (docs/third.md)
      component.handleMouseDown({
        button: 0,
        clientX: 200,
        clientY: 100,
      } as any);
      component.handleMouseUp({
        clientX: 100,
        clientY: 105,
      } as any);

      expect(component.selectedPage).toEqual(pages[2]);

      // Gesture Right (deltaX = 100) -> goToPreviousPage (docs/second.md)
      component.handleMouseDown({
        button: 0,
        clientX: 100,
        clientY: 100,
      } as any);
      component.handleMouseUp({
        clientX: 200,
        clientY: 105,
      } as any);

      expect(component.selectedPage).toEqual(pages[1]);
    });

    it("handles shadow-claw-swipe message from iframe preview", async () => {
      const component = new ShadowClawPages();
      await component.connectedCallback();

      const pages = [
        { groupId: "group-1", path: "docs/first.md" },
        { groupId: "group-1", path: "docs/second.md" },
        { groupId: "group-1", path: "docs/third.md" },
      ];
      (orchestratorStore as any).pages = pages;
      component.selectedPage = pages[1];

      const fakeWindow = { postMessage: jest.fn() } as unknown as Window;
      component.previewFrameWindow = fakeWindow;

      // Swipe left message -> goToNextPage
      component.handleIframeMessage({
        data: { type: "shadow-claw-swipe", direction: "left" },
        source: fakeWindow,
      } as MessageEvent);

      expect(component.selectedPage).toEqual(pages[2]);
      component.previewFrameWindow = null;
    });

    it("suppresses keyboard and gesture navigation when focus or target has data-no-nav attribute", async () => {
      const component = new ShadowClawPages();
      await component.connectedCallback();
      const root = component.shadowRoot;
      if (!root) return;

      const pages = [
        { groupId: "group-1", path: "docs/first.md" },
        { groupId: "group-1", path: "docs/second.md" },
      ];
      (orchestratorStore as any).pages = pages;
      component.selectedPage = pages[1];
      component.renderPageList(pages, []);

      // Create a game container with data-no-nav
      const gameContainer = document.createElement("div");
      gameContainer.setAttribute("data-no-nav", "");
      const gameElement = document.createElement("block-garden");
      gameContainer.appendChild(gameElement);
      document.body.appendChild(gameContainer);

      // Keydown inside game container should be ignored
      gameElement.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      );
      expect(component.selectedPage).toEqual(pages[1]);

      // Touch inside game container should be ignored
      component.handleTouchStart({
        touches: [{ clientX: 300, clientY: 100 }],
        composedPath: () => [gameElement, gameContainer, document.body],
        target: gameElement,
      } as any);
      component.handleTouchEnd({
        changedTouches: [{ clientX: 50, clientY: 100 }],
        composedPath: () => [gameElement, gameContainer, document.body],
        target: gameElement,
      } as any);
      expect(component.selectedPage).toEqual(pages[1]);

      // Mouse drag inside game container should be ignored
      component.handleMouseDown({
        button: 0,
        clientX: 300,
        clientY: 100,
        composedPath: () => [gameElement, gameContainer, document.body],
        target: gameElement,
      } as any);
      component.handleMouseUp({
        clientX: 50,
        clientY: 100,
        composedPath: () => [gameElement, gameContainer, document.body],
        target: gameElement,
      } as any);
      expect(component.selectedPage).toEqual(pages[1]);

      document.body.removeChild(gameContainer);
    });

    it("announces page changes to screen readers via live region", async () => {
      const component = new ShadowClawPages();
      await component.connectedCallback();
      const root = component.shadowRoot;
      if (!root) return;

      const announcer = root.querySelector("[data-pages-announcer]");
      expect(announcer).not.toBeNull();

      const pages = [
        { groupId: "group-1", path: "docs/first.md" },
        { groupId: "group-1", path: "docs/second.md" },
      ];
      (orchestratorStore as any).pages = pages;
      component.selectedPage = pages[0];

      expect(announcer?.textContent).toContain("docs/first.md");
    });

    it("does not render or navigate to denied pages", async () => {
      const component = new ShadowClawPages();
      await component.connectedCallback();
      const root = component.shadowRoot;
      if (!root) return;

      const rendered = root.querySelector("[data-pages-rendered]");
      const empty = root.querySelector("[data-pages-empty]");

      (orchestratorStore.isPageAllowed as jest.Mock).mockReturnValue(false);

      // Attempt navigation to denied page
      component.selectedPage = { groupId: "group-1", path: "docs/first.md" };
      component.navigateToPage({ groupId: "group-1", path: "sidebar.html" });
      expect(component.selectedPage?.path).toBe("docs/first.md");

      // Attempt rendering denied page
      component.selectedPage = { groupId: "group-1", path: "sidebar.html" };
      await component.renderSelectedPage();

      expect(rendered?.hasAttribute("hidden")).toBe(true);
      expect(empty?.hasAttribute("hidden")).toBe(false);

      (orchestratorStore.isPageAllowed as jest.Mock).mockReturnValue(true);
    });

    it("updates header when frontmatter title is present in renderPageList", async () => {
      const component = new ShadowClawPages();
      await component.connectedCallback();
      const root = component.shadowRoot;
      if (!root) return;

      component.selectedPage = { groupId: "group-1", path: "docs/page.md" };
      component.pageFrontmatter.set({ title: "Amazing Guide" } as any);
      component.renderPageList(
        [{ groupId: "group-1", path: "docs/page.md" }],
        [],
      );

      const header = root.querySelector("shadow-claw-page-header");
      expect(header?.getAttribute("title")).toBe("Amazing Guide");
      expect(document.title).toBe("Amazing Guide - ShadowClaw");
    });

    it("handles drag and drop events on page rows", async () => {
      const component = new ShadowClawPages();
      await component.connectedCallback();
      component.db = {} as any;
      const root = component.shadowRoot;
      if (!root) return;

      const pages = [
        { groupId: "group-1", path: "docs/1.md" },
        { groupId: "group-1", path: "docs/2.md" },
      ];
      component.renderPageList(pages, []);

      const rows = root.querySelectorAll(".pages__list-item");
      expect(rows.length).toBeGreaterThanOrEqual(2);

      const dragHandle0 = rows[0].querySelector(".pages__drag-handle");
      const dragEvent = new Event("dragstart", { bubbles: true }) as any;
      dragEvent.dataTransfer = { effectAllowed: "" };
      dragHandle0?.dispatchEvent(dragEvent);
      expect((component as any).draggedPageIndex).toBe(0);

      const dragOverEvent = new Event("dragover", { bubbles: true }) as any;
      dragOverEvent.preventDefault = jest.fn();
      rows[1].dispatchEvent(dragOverEvent);
      expect(rows[1].classList.contains("drag-over")).toBe(true);

      const dragLeaveEvent = new Event("dragleave", { bubbles: true });
      rows[1].dispatchEvent(dragLeaveEvent);
      expect(rows[1].classList.contains("drag-over")).toBe(false);

      const dropEvent = new Event("drop", { bubbles: true }) as any;
      dropEvent.preventDefault = jest.fn();
      rows[1].dispatchEvent(dropEvent);

      const dragEndEvent = new Event("dragend", { bubbles: true });
      rows[0].dispatchEvent(dragEndEvent);
      expect((component as any).draggedPageIndex).toBeNull();
    });

    it("handles setupAutoRefreshTimer lifecycle", async () => {
      const component = new ShadowClawPages();
      (component as any).autoRefreshTimer = setInterval(() => {}, 10000);
      component.db = null as any;

      await component.setupAutoRefreshTimer();
      expect((component as any).autoRefreshTimer).toBeNull();
    });

    it("handles resolveRelativeImagesInHtml with empty and present html", async () => {
      const component = new ShadowClawPages();
      component.db = {} as any;

      const emptyRes = await component.resolveRelativeImagesInHtml(
        "",
        "doc.html",
        "group-1",
      );
      expect(emptyRes).toBe("");

      const htmlRes = await component.resolveRelativeImagesInHtml(
        "<p>Hello</p>",
        "doc.html",
        "group-1",
      );
      expect(htmlRes).toContain("<p>Hello</p>");
    });
    it("handles handleIframeMessage edge cases: null message, broadcast-result, and storage-proxy", async () => {
      const component = new ShadowClawPages();
      component.db = {} as any;
      const fakeWin = { postMessage: jest.fn() } as unknown as Window;
      component.previewFrameWindow = fakeWin;

      // 1. null / invalid message data
      expect(() => {
        component.handleIframeMessage({
          data: null,
          source: fakeWin,
        } as MessageEvent);
      }).not.toThrow();

      // 2. broadcast-result with broadcastProxy
      const mockBroadcast = {
        handleResultFromIframe: jest.fn(),
      };
      component.broadcastProxy = mockBroadcast as any;
      component.handleIframeMessage({
        data: {
          type: "shadow-claw-broadcast-result",
          channel: "my-chan",
          payload: { foo: "bar" },
        },
        source: fakeWin,
      } as MessageEvent);
      expect(mockBroadcast.handleResultFromIframe).toHaveBeenCalledWith(
        fakeWin,
        "my-chan",
        { foo: "bar" },
      );

      // 2b. broadcast-result without broadcastProxy
      component.broadcastProxy = null;
      expect(() => {
        component.handleIframeMessage({
          data: {
            type: "shadow-claw-broadcast-result",
            channel: "my-chan",
            payload: { foo: "bar" },
          },
          source: fakeWin,
        } as MessageEvent);
      }).not.toThrow();

      // 3. storage-proxy from mismatched window -> ignored
      const otherWin = { postMessage: jest.fn() } as unknown as Window;
      component.handleIframeMessage({
        data: {
          type: "shadow-claw-storage-proxy",
          requestId: "req-1",
          method: "getItem",
          args: ["key"],
        },
        source: otherWin,
      } as MessageEvent);

      // 4. storage-proxy with matching source and default pageKey
      component.selectedPage = null;
      component.handleIframeMessage({
        data: {
          type: "shadow-claw-storage-proxy",
          requestId: "req-2",
          method: "getItem",
          args: ["key"],
        },
        source: fakeWin,
      } as MessageEvent);

      component.previewFrameWindow = null;
    });

    it("handles handleIframeMessage swipe and iframe-resize edge cases", async () => {
      const component = new ShadowClawPages();
      const root = component.shadowRoot;
      if (!root) return;

      const fakeWin = { postMessage: jest.fn() } as unknown as Window;
      component.previewFrameWindow = fakeWin;

      const pages = [
        { groupId: "group-1", path: "docs/1.md" },
        { groupId: "group-1", path: "docs/2.md" },
      ];
      (orchestratorStore as any).pages = pages;
      component.selectedPage = pages[0];

      // Swipe from mismatched source -> ignored
      const otherWin = { postMessage: jest.fn() } as unknown as Window;
      component.handleIframeMessage({
        data: { type: "shadow-claw-swipe", direction: "left" },
        source: otherWin,
      } as MessageEvent);
      expect(component.selectedPage).toBe(pages[0]);

      // Swipe left -> goToNextPage
      component.handleIframeMessage({
        data: { type: "shadow-claw-swipe", direction: "left" },
        source: fakeWin,
      } as MessageEvent);
      expect(component.selectedPage).toBe(pages[1]);

      // Swipe right -> goToPreviousPage
      component.handleIframeMessage({
        data: { type: "shadow-claw-swipe", direction: "right" },
        source: fakeWin,
      } as MessageEvent);
      expect(component.selectedPage).toBe(pages[0]);

      // Swipe with unknown direction -> ignored
      component.handleIframeMessage({
        data: { type: "shadow-claw-swipe", direction: "up" },
        source: fakeWin,
      } as MessageEvent);
      expect(component.selectedPage).toBe(pages[0]);

      // iframe-resize without iframe in DOM
      component.handleIframeMessage({
        data: { type: "shadow-claw-iframe-resize", height: 500 },
        source: fakeWin,
      } as MessageEvent);

      // iframe-resize with iframe in DOM
      const iframe = document.createElement("iframe");
      iframe.setAttribute("data-pages-iframe", "");
      root.appendChild(iframe);
      const iframeWin = { postMessage: jest.fn() } as unknown as Window;
      Object.defineProperty(iframe, "contentWindow", {
        value: iframeWin,
        configurable: true,
      });

      component.previewFrameWindow = null;
      component.handleIframeMessage({
        data: { type: "shadow-claw-iframe-resize", height: 600 },
        source: iframeWin,
      } as MessageEvent);
      expect(iframe.style.height).toBe("600px");
      expect(component.previewFrameWindow).toBe(iframeWin);

      // iframe-resize with matching previewFrameWindow
      component.handleIframeMessage({
        data: { type: "shadow-claw-iframe-resize", height: 750 },
        source: iframeWin,
      } as MessageEvent);
      expect(iframe.style.height).toBe("750px");

      // iframe-resize with mismatched source when previewFrameWindow is set
      component.handleIframeMessage({
        data: { type: "shadow-claw-iframe-resize", height: 900 },
        source: otherWin,
      } as MessageEvent);
      expect(iframe.style.height).toBe("750px");

      iframe.remove();
      component.previewFrameWindow = null;
    });

    it("handles handleIframeMessage file-viewer-link navigation and gameSave", async () => {
      const component = new ShadowClawPages();
      const fakeWin = { postMessage: jest.fn() } as unknown as Window;
      component.previewFrameWindow = fakeWin;

      // 1. !this.db -> ignored
      component.db = null;
      component.handleIframeMessage({
        data: { type: "shadow-claw-file-viewer-link", href: "/files/doc.html" },
        source: fakeWin,
      } as MessageEvent);

      component.db = {} as any;
      component.selectedPage = { groupId: "group-1", path: "index.html" };

      // 2. Mismatched window source -> ignored
      const otherWin = { postMessage: jest.fn() } as unknown as Window;
      component.handleIframeMessage({
        data: { type: "shadow-claw-file-viewer-link", href: "/files/doc.html" },
        source: otherWin,
      } as MessageEvent);

      // 3. Link with gameSave parameter -> calls reloadPreviewWithSearchParams
      const reloadSpy = jest
        .spyOn(component as any, "reloadPreviewWithSearchParams")
        .mockImplementation(async () => {});
      component.handleIframeMessage({
        data: {
          type: "shadow-claw-file-viewer-link",
          href: "http://localhost/files/group-1/game.html?gameSave=abc",
        },
        source: fakeWin,
      } as MessageEvent);
      expect(reloadSpy).toHaveBeenCalledWith("?gameSave=abc");

      // 4. External link -> window.open
      const openSpy = jest.spyOn(window, "open").mockImplementation(() => null);
      component.handleIframeMessage({
        data: {
          type: "shadow-claw-file-viewer-link",
          href: "https://example.com/external-page",
        },
        source: fakeWin,
      } as MessageEvent);
      expect(openSpy).toHaveBeenCalledWith(
        "https://example.com/external-page",
        "_blank",
        "noopener,noreferrer",
      );

      // 5. Internal link with window.navigation
      const mockNavigate = jest.fn();
      (window as any).navigation = { navigate: mockNavigate };
      component.handleIframeMessage({
        data: {
          type: "shadow-claw-file-viewer-link",
          href: "http://localhost/files/group-1/other.html",
        },
        source: fakeWin,
      } as MessageEvent);
      expect(mockNavigate).toHaveBeenCalled();

      // 6. Internal link without window.navigation -> history.pushState + popstate
      delete (window as any).navigation;
      const pushStateSpy = jest
        .spyOn(window.history, "pushState")
        .mockImplementation(() => {});
      const popStateListener = jest.fn();
      window.addEventListener("popstate", popStateListener);

      component.handleIframeMessage({
        data: {
          type: "shadow-claw-file-viewer-link",
          href: "http://localhost/files/group-1/other.html",
        },
        source: fakeWin,
      } as MessageEvent);
      expect(pushStateSpy).toHaveBeenCalled();
      expect(popStateListener).toHaveBeenCalled();

      window.removeEventListener("popstate", popStateListener);
      openSpy.mockRestore();
      pushStateSpy.mockRestore();
    });

    it("handles reloadPreviewWithSearchParams guards and execution", async () => {
      const component = new ShadowClawPages();
      component.db = {} as any;
      (
        readGroupFile as jest.MockedFunction<typeof readGroupFile>
      ).mockResolvedValue("<h1>Title</h1>");

      // Guard 1: !this.selectedPage
      orchestratorStore._activePinnedPage.set(null);
      (component as any).renderedContent = "<p>content</p>";
      await (component as any).reloadPreviewWithSearchParams("?foo=bar");

      // Guard 2: !this.renderedContent
      orchestratorStore._activePinnedPage.set({
        groupId: "group-1",
        path: "page.html",
      });
      (component as any).renderedContent = null;
      await (component as any).reloadPreviewWithSearchParams("?foo=bar");

      // Execution with renderedContent and root
      (component as any).renderedContent = "<h1>Title</h1>";
      await (component as any).reloadPreviewWithSearchParams("?foo=bar");
      const iframe = component.shadowRoot?.querySelector("[data-pages-iframe]");
      expect(iframe).toBeInstanceOf(HTMLIFrameElement);
      component.previewFrameWindow = null;
    });

    it("handles boundary conditions for goToNextPage and goToPreviousPage", async () => {
      const component = new ShadowClawPages();
      const pages = [
        { groupId: "group-1", path: "1.md" },
        { groupId: "group-1", path: "2.md" },
      ];
      (orchestratorStore as any).pages = pages;

      // When selectedPage is not in list (index = -1)
      component.selectedPage = { groupId: "group-1", path: "unknown.md" };
      component.goToNextPage();
      expect(component.selectedPage.path).toBe("unknown.md");
      component.goToPreviousPage();
      expect(component.selectedPage.path).toBe("unknown.md");

      // At end of list (index = 1) -> goToNextPage is no-op
      component.selectedPage = pages[1];
      component.goToNextPage();
      expect(component.selectedPage).toBe(pages[1]);

      // At start of list (index = 0) -> goToPreviousPage is no-op
      component.selectedPage = pages[0];
      component.goToPreviousPage();
      expect(component.selectedPage).toBe(pages[0]);
    });

    it("handles showNavButtonsTemporarily timeout lifecycle and replacement", () => {
      jest.useFakeTimers();
      const component = new ShadowClawPages();
      const root = component.shadowRoot;
      if (!root) return;

      const viewer = root.querySelector(".pages__viewer");

      // First trigger
      component.showNavButtonsTemporarily(1000);
      expect(viewer?.classList.contains("pages__viewer--nav-visible")).toBe(
        true,
      );
      expect((component as any).navFadeTimer).not.toBeNull();

      // Second trigger before timeout replaces timer
      component.showNavButtonsTemporarily(2000);
      expect(viewer?.classList.contains("pages__viewer--nav-visible")).toBe(
        true,
      );

      // Advance timers
      jest.advanceTimersByTime(2000);
      expect(viewer?.classList.contains("pages__viewer--nav-visible")).toBe(
        false,
      );
      expect((component as any).navFadeTimer).toBeNull();

      // Without shadowRoot
      const detached = new ShadowClawPages();
      Object.defineProperty(detached, "shadowRoot", { value: null });
      expect(() => detached.showNavButtonsTemporarily()).not.toThrow();

      jest.useRealTimers();
    });

    it("handles handleRemoveAll success, error object, and non-error throws", async () => {
      const component = new ShadowClawPages();
      component.db = {} as any;
      const root = component.shadowRoot;
      if (!root) return;

      const btn = root.querySelector(
        ".pages__remove-all-btn",
      ) as HTMLButtonElement;

      // 1. Success case
      (requestConfirmation as jest.Mock).mockResolvedValueOnce(true);
      (orchestratorStore.removeAllPages as jest.Mock).mockResolvedValueOnce(
        undefined,
      );
      await component.handleRemoveAll();
      expect(showSuccess).toHaveBeenCalledWith(
        "Removed all pages from Pages",
        2400,
      );
      expect(btn.textContent).toBe("🗑️ Remove All");
      expect(btn.hasAttribute("disabled")).toBe(false);

      // 2. Error object throw
      (requestConfirmation as jest.Mock).mockResolvedValueOnce(true);
      (orchestratorStore.removeAllPages as jest.Mock).mockRejectedValueOnce(
        new Error("DB locked"),
      );
      await component.handleRemoveAll();
      expect(showError).toHaveBeenCalledWith(
        "Failed to remove all pages: DB locked",
        4500,
      );

      // 3. String error throw
      (requestConfirmation as jest.Mock).mockResolvedValueOnce(true);
      (orchestratorStore.removeAllPages as jest.Mock).mockRejectedValueOnce(
        "Disk error",
      );
      await component.handleRemoveAll();
      expect(showError).toHaveBeenCalledWith(
        "Failed to remove all pages: Disk error",
        4500,
      );
    });

    it("handles handleReorder when moving to first vs intermediate position", async () => {
      const component = new ShadowClawPages();
      component.db = {} as any;
      const pages = [
        { groupId: "group-1", path: "1.md" },
        { groupId: "group-1", path: "2.md" },
        { groupId: "group-1", path: "3.md" },
      ];
      (orchestratorStore as any).pages = pages;

      const navigateListener = jest.fn();
      document.addEventListener("shadow-claw-navigate", navigateListener);

      // Move index 2 to 0 -> movedToFirst is page 3
      await component.handleReorder(2, 0);
      expect(orchestratorStore.reorderPages).toHaveBeenCalled();
      expect(component.selectedPage?.path).toBe("3.md");
      expect(navigateListener).toHaveBeenCalled();

      // Move index 0 to 1 -> not moved to first, no new navigation
      navigateListener.mockClear();
      await component.handleReorder(0, 1);
      expect(navigateListener).not.toHaveBeenCalled();

      document.removeEventListener("shadow-claw-navigate", navigateListener);
    });

    it("handles renderPageList actions: details toggle, edit, and remove button flows", async () => {
      const component = new ShadowClawPages();
      component.db = {} as any;
      const root = component.shadowRoot;
      if (!root) return;

      const pages = [{ groupId: "group-1", path: "docs/1.md" }];
      const groups = [{ groupId: "group-1", name: "Docs Group" }];
      (orchestratorStore as any).pages = pages;
      (orchestratorStore as any).groups = groups;
      component.selectedPage = pages[0];

      component.renderPageList(pages, groups as any);

      // Status text for 1 page
      const status = root.querySelector("[data-pages-status]");
      expect(status?.textContent).toBe("1 saved page");

      // Details toggle listener
      const details = root.querySelector(
        "details.pages__group-details",
      ) as HTMLDetailsElement;
      expect(details).not.toBeNull();
      details.open = false;
      details.dispatchEvent(new Event("toggle"));
      details.open = true;
      details.dispatchEvent(new Event("toggle"));

      // Edit button click - db present
      const editBtn = root.querySelector(".pages__edit") as HTMLButtonElement;
      editBtn.click();
      expect(fileViewerStore.openFile).toHaveBeenCalledWith(
        component.db,
        "docs/1.md",
        "group-1",
      );

      // Edit button error cases
      (fileViewerStore.openFile as jest.Mock).mockRejectedValueOnce(
        new Error("Editor failed"),
      );
      editBtn.click();
      await new Promise((r) => setTimeout(r, 10));
      expect(showError).toHaveBeenCalledWith(
        "Failed to edit file: Editor failed",
        4500,
      );

      (fileViewerStore.openFile as jest.Mock).mockRejectedValueOnce(
        "Raw string error",
      );
      editBtn.click();
      await new Promise((r) => setTimeout(r, 10));
      expect(showError).toHaveBeenCalledWith(
        "Failed to edit file: Raw string error",
        4500,
      );

      // Edit button without db
      component.db = null;
      editBtn.click();

      // Remove button without db
      const removeBtn = root.querySelector(
        ".pages__remove",
      ) as HTMLButtonElement;
      removeBtn.click();

      // Remove button with db - cancelled
      component.db = {} as any;
      (requestConfirmation as jest.Mock).mockResolvedValueOnce(false);
      removeBtn.click();
      await new Promise((r) => setTimeout(r, 10));
      expect(orchestratorStore.removePage).not.toHaveBeenCalled();

      // Remove button with db - confirmed
      (requestConfirmation as jest.Mock).mockResolvedValueOnce(true);
      (orchestratorStore.removePage as jest.Mock).mockResolvedValueOnce(
        undefined,
      );
      removeBtn.click();
      await new Promise((r) => setTimeout(r, 10));
      expect(showSuccess).toHaveBeenCalledWith(
        "Removed docs/1.md from Pages",
        2400,
      );

      // Remove button error object
      (requestConfirmation as jest.Mock).mockResolvedValueOnce(true);
      (orchestratorStore.removePage as jest.Mock).mockRejectedValueOnce(
        new Error("Lock conflict"),
      );
      removeBtn.click();
      await new Promise((r) => setTimeout(r, 10));
      expect(showError).toHaveBeenCalledWith(
        "Failed to remove page: Lock conflict",
        4500,
      );

      // Remove button string error
      (requestConfirmation as jest.Mock).mockResolvedValueOnce(true);
      (orchestratorStore.removePage as jest.Mock).mockRejectedValueOnce(
        "General error",
      );
      removeBtn.click();
      await new Promise((r) => setTimeout(r, 10));
      expect(showError).toHaveBeenCalledWith(
        "Failed to remove page: General error",
        4500,
      );

      // Empty pages list
      component.renderPageList([], []);
      expect(status?.textContent).toBe("0 saved pages");
    });

    it("handles renderSelectedPage token cancellation and plain text rendering", async () => {
      const component = new ShadowClawPages();
      component.db = {} as any;
      const root = component.shadowRoot;
      if (!root) return;

      const rendered = root.querySelector(
        "[data-pages-rendered]",
      ) as HTMLElement;

      // Plain text file (neither html nor markdown)
      (
        readGroupFile as jest.MockedFunction<typeof readGroupFile>
      ).mockResolvedValue("Plain text content");
      component.selectedPage = { groupId: "group-1", path: "notes.txt" };
      await component.renderSelectedPage();
      expect(rendered.textContent).toBe("Plain text content");

      // Idempotent plain text re-render
      await component.renderSelectedPage();
      expect(rendered.textContent).toBe("Plain text content");

      // Token race cancellation check
      component.selectedPage = { groupId: "group-1", path: "doc2.txt" };
      (
        readGroupFile as jest.MockedFunction<typeof readGroupFile>
      ).mockImplementationOnce(async () => {
        // Increment renderToken behind the scenes before resolving
        (component as any).renderToken++;
        return "Stale content";
      });
      await component.renderSelectedPage();
      // Should have bailed out and not set rendered.textContent to "Stale content"
      expect(rendered.textContent).not.toBe("Stale content");

      // Render error: Error object vs string error
      component.selectedPage = { groupId: "group-1", path: "err.md" };
      (
        readGroupFile as jest.MockedFunction<typeof readGroupFile>
      ).mockRejectedValueOnce(new Error("Corrupt DB"));
      (
        getStaticPageContent as jest.MockedFunction<typeof getStaticPageContent>
      ).mockRejectedValueOnce(new Error("No static"));
      await component.renderSelectedPage();
      expect(showError).toHaveBeenCalledWith(
        "Failed to load page err.md: Corrupt DB",
        5000,
      );

      (
        readGroupFile as jest.MockedFunction<typeof readGroupFile>
      ).mockRejectedValueOnce("String failure");
      (
        getStaticPageContent as jest.MockedFunction<typeof getStaticPageContent>
      ).mockRejectedValueOnce("No static");
      await component.renderSelectedPage();
      expect(showError).toHaveBeenCalledWith(
        "Failed to load page err.md: String failure",
        5000,
      );
    });

    it("handles visibility, focus, auto-refresh config, and file saved events", async () => {
      const component = new ShadowClawPages();
      component.db = {} as any;
      component.selectedPage = { groupId: "group-1", path: "doc.md" };
      (
        readGroupFile as jest.MockedFunction<typeof readGroupFile>
      ).mockResolvedValue("# Doc");

      // handleVisibilityChange: render-and-timer
      Object.defineProperty(document, "hidden", {
        value: false,
        configurable: true,
      });
      Object.defineProperty(component, "isConnected", {
        value: true,
        configurable: true,
      });
      component.handleVisibilityChange();

      // handleVisibilityChange: clear-timer
      (component as any).autoRefreshTimer = setInterval(() => {}, 10000);
      Object.defineProperty(document, "hidden", {
        value: true,
        configurable: true,
      });
      component.handleVisibilityChange();
      expect((component as any).autoRefreshTimer).toBeNull();

      // handleWindowFocus
      Object.defineProperty(document, "hidden", {
        value: false,
        configurable: true,
      });
      component.handleWindowFocus();

      // handleAnchorNavigation
      const anchorNavResult = component.handleAnchorNavigation("section-1");
      expect(typeof anchorNavResult).toBe("boolean");

      const detached = new ShadowClawPages();
      Object.defineProperty(detached, "shadowRoot", { value: null });
      expect(detached.handleAnchorNavigation("sec")).toBe(false);

      // handleAutoRefreshConfigChange with valid and null detail
      const configEventNum = new CustomEvent(
        "shadow-claw-pages-auto-refresh-change",
        {
          detail: { interval: 15 },
        },
      );
      component.handleAutoRefreshConfigChange(configEventNum);
      expect(component.autoRefreshIntervalSec).toBe(15);

      const configEventNull = new CustomEvent(
        "shadow-claw-pages-auto-refresh-change",
        {
          detail: null,
        },
      );
      component.handleAutoRefreshConfigChange(configEventNull);

      // handleFileSaved matching vs non-matching
      const savedMatching = new CustomEvent("shadow-claw-file-saved", {
        detail: { path: "doc.md", groupId: "group-1" },
      });
      component.handleFileSaved(savedMatching);

      const savedOther = new CustomEvent("shadow-claw-file-saved", {
        detail: { path: "other.md", groupId: "group-2" },
      });
      component.handleFileSaved(savedOther);
    });

    it("handles connectedCallback click outside dropdown and prerender overrides", async () => {
      // 1. sc-prerender-override class
      document.documentElement.classList.add("sc-prerender-override");
      const compOverride = new ShadowClawPages();
      await compOverride.connectedCallback();
      const rendered = compOverride.shadowRoot?.querySelector(
        "[data-pages-rendered]",
      ) as HTMLElement;
      expect(rendered.hidden).toBe(true);
      compOverride.disconnectedCallback();
      document.documentElement.classList.remove("sc-prerender-override");

      // 2. Click outside dropdown
      const component = new ShadowClawPages();
      await component.connectedCallback();
      const root = component.shadowRoot;
      if (!root) return;

      const dropdown = root.querySelector(
        "[data-pages-dropdown]",
      ) as HTMLDetailsElement;
      if (dropdown) {
        dropdown.open = true;

        // Click outside dropdown
        const outsideTarget = document.createElement("div");
        root.appendChild(outsideTarget);
        root.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        expect(dropdown.open).toBe(false);
      }

      component.disconnectedCallback();
    });

    it("handles setupEffects callbacks directly", async () => {
      const component = new ShadowClawPages();
      component.db = {} as any;
      const root = component.shadowRoot;
      if (!root) return;

      const registeredCallbacks: Array<() => void> = [];
      (effect as jest.Mock).mockImplementation((cb: () => void) => {
        registeredCallbacks.push(cb);
        return () => undefined;
      });

      component.setupEffects();
      expect(registeredCallbacks.length).toBeGreaterThanOrEqual(3);

      // Effect 1: declarative tools registration
      const mockBroadcast = { registerChannelsFromTools: jest.fn() };
      component.broadcastProxy = mockBroadcast as any;
      (toolsStore as any)._declarativeTools = {
        get: () => [{ name: "tool-1" }],
      };
      registeredCallbacks[0]();

      // Effect 2: renderPageList
      (orchestratorStore as any).pages = [{ groupId: "group-1", path: "1.md" }];
      registeredCallbacks[1]();

      // Effect 3: page selection validation
      (orchestratorStore as any).pages = [];
      (orchestratorStore as any)._activePinnedPage.set({
        groupId: "group-1",
        path: "1.md",
      });
      registeredCallbacks[2]();
      expect(component.selectedPage).toBeNull();

      // Effect 3 with pages when activePinnedPage is not found
      const page1 = { groupId: "group-1", path: "1.md" };
      (orchestratorStore as any).pages = [page1];
      (orchestratorStore as any)._activePinnedPage.set(null);
      (component as any).routingReady = false;
      registeredCallbacks[2]();
      expect(component.selectedPage).toEqual(page1);

      // Effect 3 with routingReady = true triggers renderSelectedPage
      (component as any).routingReady = true;
      const renderSpy = jest
        .spyOn(component, "renderSelectedPage")
        .mockImplementation(async () => {});
      registeredCallbacks[2]();
      expect(renderSpy).toHaveBeenCalled();
    });

    it("defines configurable custom property hooks for .pages__viewer layout in stylesheet", () => {
      const styles = ShadowClawPages.styles as any;
      const cssText = styles?.cssText || "";
      expect(cssText).toContain("--shadow-claw-pages-viewer-max-width");
      expect(cssText).toContain("--shadow-claw-pages-viewer-margin");
      expect(cssText).toContain("--shadow-claw-pages-viewer-width");
    });
  });
});
