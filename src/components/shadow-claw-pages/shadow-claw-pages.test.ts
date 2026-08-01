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

const { ShadowClawPages } = await import("./shadow-claw-pages.js");
const { orchestratorStore } = await import("../../stores/orchestrator.js");
const { readGroupFile } = await import("../../storage/readGroupFile.js");
const { readGroupFileBytes } =
  await import("../../storage/readGroupFileBytes.js");
const { renderMarkdown } = await import("../../content/markdown.js");
const { setSanitizedHtml, setTrustedSrcdoc } =
  await import("../../security/trusted-types.js");

describe("shadow-claw-pages", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      '<main><img src="/files/br-main/pic.jpg" /><img src="./files/br-main/pic.jpg" /><img src="files/br-main/pic.jpg" /></main>',
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
      '<img src="/files/br-main/pic.jpg" /><img src="./files/br-main/pic.jpg" /><img src="files/br-main/pic.jpg" />';

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
    container.innerHTML = `<img src="${origin}/files/br%3A01KT4NGEM3T94M0FGHJYVNGS7M/files/br-main/pic.jpg" />`;

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

    it("clears static pre-rendered DSD content on connectedCallback when override setting is enabled in localStorage", async () => {
      localStorage.setItem("shadow-claw-override-prerender-skeleton", "true");

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

      localStorage.removeItem("shadow-claw-override-prerender-skeleton");
    });

    xit("disables Remove All button when pages list is empty and enables it when pages exist", async () => {
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

    xit("clicking Remove All prompts for confirmation and calls removeAllPages when confirmed", async () => {
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
});
