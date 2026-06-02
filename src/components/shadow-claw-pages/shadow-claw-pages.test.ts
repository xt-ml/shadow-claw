import { jest } from "@jest/globals";

jest.unstable_mockModule("../../effect.js", () => ({
  effect: jest.fn(() => () => undefined),
}));

jest.unstable_mockModule("../../markdown.js", () => ({
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

jest.unstable_mockModule("../../toast.js", () => ({
  showError: jest.fn(),
  showSuccess: jest.fn(),
}));

jest.unstable_mockModule("../../db/db.js", () => ({
  getDb: jest.fn(async () => ({})),
}));

const { ShadowClawPages } = await import("./shadow-claw-pages.js");
const { readGroupFile } = await import("../../storage/readGroupFile.js");
const { renderMarkdown } = await import("../../markdown.js");
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

  describe("rendered link click handling", () => {
    it("intercepts and navigates simple relative links in pinned pages", async () => {
      const component = new ShadowClawPages();
      component.db = {} as any;
      // Simulate MEMORY.md pinned at root
      component.selectedPage = { groupId: "group-1", path: "MEMORY.md" };

      const openWorkspaceLinkSpy = jest
        .spyOn(component, "openWorkspaceLink")
        .mockResolvedValue(undefined);

      const link = document.createElement("a");
      link.setAttribute("href", "foo/test.md");

      const event = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        button: 0,
      });
      Object.defineProperty(event, "target", {
        configurable: true,
        value: link,
      });

      await component.handleRenderedLinkClick(event);

      expect(event.defaultPrevented).toBe(true);
      expect(openWorkspaceLinkSpy).toHaveBeenCalledWith("foo/test.md");

      openWorkspaceLinkSpy.mockRestore();
    });

    it("intercepts relative links when page is in a subdirectory", async () => {
      const component = new ShadowClawPages();
      component.db = {} as any;
      // Simulate docs/index.md pinned
      component.selectedPage = { groupId: "group-1", path: "docs/index.md" };

      const openWorkspaceLinkSpy = jest
        .spyOn(component, "openWorkspaceLink")
        .mockResolvedValue(undefined);

      const link = document.createElement("a");
      link.setAttribute("href", "guide.md");

      const event = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        button: 0,
      });
      Object.defineProperty(event, "target", {
        configurable: true,
        value: link,
      });

      await component.handleRenderedLinkClick(event);

      expect(event.defaultPrevented).toBe(true);
      expect(openWorkspaceLinkSpy).toHaveBeenCalledWith("docs/guide.md");

      openWorkspaceLinkSpy.mockRestore();
    });

    it("does not intercept external links in pinned pages", async () => {
      const component = new ShadowClawPages();
      component.db = {} as any;
      component.selectedPage = { groupId: "group-1", path: "MEMORY.md" };

      const openWorkspaceLinkSpy = jest
        .spyOn(component, "openWorkspaceLink")
        .mockResolvedValue(undefined);

      const link = document.createElement("a");
      link.setAttribute("href", "https://example.com/page");

      const event = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        button: 0,
      });
      Object.defineProperty(event, "target", {
        configurable: true,
        value: link,
      });

      await component.handleRenderedLinkClick(event);

      expect(openWorkspaceLinkSpy).not.toHaveBeenCalled();

      openWorkspaceLinkSpy.mockRestore();
    });
  });
});
