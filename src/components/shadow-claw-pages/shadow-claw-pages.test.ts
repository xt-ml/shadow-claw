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
    const template = await ShadowClawPages.getTemplateSource();

    expect(template).not.toContain("data-pages-iframe");
  });

  it("creates iframe only when rendering an HTML page", async () => {
    const component = new ShadowClawPages();
    await component.onTemplateReady;

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
    await component.onTemplateReady;

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
    await component.onTemplateReady;

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
    await component.onTemplateReady;

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
    await component.onTemplateReady;

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
    expect(renderMarkdown).toHaveBeenCalledWith("# Title");
    expect(setSanitizedHtml).toHaveBeenCalledTimes(1);
  });

  it("inlines relative markdown images as data URLs", async () => {
    const component = new ShadowClawPages();
    await component.onTemplateReady;

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
    await component.onTemplateReady;

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
    await component.onTemplateReady;

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
    await component.onTemplateReady;

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
});
