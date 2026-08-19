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

jest.unstable_mockModule("../../storage/readGroupFile.js", () => ({
  readGroupFile: jest.fn(),
}));

jest.unstable_mockModule("../../storage/writeGroupFile.js", () => ({
  writeGroupFile: jest.fn(),
}));

jest.unstable_mockModule("../../storage/staticMainSite.js", () => ({
  getStaticMainManifest: jest.fn(async () => ({ pages: [] })),
  getStaticPageContent: jest.fn(async () => null),
  seedStaticMainSite: jest.fn(),
}));

jest.unstable_mockModule("../../storage/readGroupFileBytes.js", () => ({
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

jest.unstable_mockModule("../../db/getConfig.js", () => ({
  getConfig: jest.fn(async () => "0"),
}));

const { ShadowClawPages } = await import("./shadow-claw-pages.js");
const { orchestratorStore } = await import("../../stores/orchestrator.js");
const { readGroupFile } = await import("../../storage/readGroupFile.js");
const { writeGroupFile } = await import("../../storage/writeGroupFile.js");
const { getStaticPageContent } =
  await import("../../storage/staticMainSite.js");
const { readGroupFileBytes } =
  await import("../../storage/readGroupFileBytes.js");
const { renderMarkdown } = await import("../../content/markdown.js");
const { getConfig } = await import("../../db/getConfig.js");
const { setSanitizedHtml, setTrustedSrcdoc } =
  await import("../../security/trusted-types.js");

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

    component._dsdInitialPath = "docs/page.md";
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
      const spy = jest
        .spyOn(component, "requestConfirmation")
        .mockResolvedValue(false);

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

      expect(spy).toHaveBeenCalledWith({
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
      jest.spyOn(component, "requestConfirmation").mockResolvedValue(true);

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

      const spy = jest
        .spyOn(component, "requestConfirmation")
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
      expect(spy).toHaveBeenNthCalledWith(1, {
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

      expect(prevBtn.disabled).toBe(false);
      expect(nextBtn.disabled).toBe(true);

      component.selectedPage = pages[1];
      component.renderPageList(pages, []);
      await Promise.resolve();

      expect(prevBtn.disabled).toBe(true);
      expect(nextBtn.disabled).toBe(false);
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
      expect(component.selectedPage).toEqual(pages[0]);
      expect(navigateListener).toHaveBeenCalledTimes(1);

      const nextEvent = navigateListener.mock.calls[0][0] as CustomEvent;
      expect(nextEvent.detail).toEqual({
        page: "pages",
        groupId: "group-1",
        path: "docs/first.md",
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
      const fakeWindow = {} as Window;
      component.previewFrameWindow = fakeWindow;

      const root =
        component.shadowRoot || component.attachShadow({ mode: "open" });
      root.appendChild(iframe);

      component.handleIframeMessage({
        data: { type: "shadow-claw-iframe-resize", height: 850 },
        source: fakeWindow,
      } as MessageEvent);

      expect(iframe.style.height).toBe("850px");
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

      // Press ArrowRight -> goToNextPage (docs/first.md)
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      );
      expect(component.selectedPage).toEqual(pages[0]);
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

      // Swipe Left (deltaX = -100) -> goToNextPage (docs/first.md)
      component.handleTouchStart({
        touches: [{ clientX: 200, clientY: 100 }],
      } as any);
      component.handleTouchEnd({
        changedTouches: [{ clientX: 100, clientY: 105 }],
      } as any);

      expect(component.selectedPage).toEqual(pages[0]);

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

      // Gesture Left (deltaX = -100) -> goToNextPage (docs/first.md)
      component.handleMouseDown({
        button: 0,
        clientX: 200,
        clientY: 100,
      } as any);
      component.handleMouseUp({
        clientX: 100,
        clientY: 105,
      } as any);

      expect(component.selectedPage).toEqual(pages[0]);

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
      ];
      (orchestratorStore as any).pages = pages;
      component.selectedPage = pages[1];

      const fakeWindow = {} as Window;
      component.previewFrameWindow = fakeWindow;

      // Swipe left message -> goToNextPage
      component.handleIframeMessage({
        data: { type: "shadow-claw-swipe", direction: "left" },
        source: fakeWindow,
      } as MessageEvent);

      expect(component.selectedPage).toEqual(pages[0]);
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
  });
});
