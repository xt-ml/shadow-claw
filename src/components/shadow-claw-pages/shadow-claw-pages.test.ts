import { jest } from "@jest/globals";

jest.unstable_mockModule("../../effect.js", () => ({
  effect: jest.fn(() => () => undefined),
}));

jest.unstable_mockModule("../../markdown.js", () => ({
  renderMarkdown: jest.fn(async (value: string) => `<p>${value}</p>`),
}));

jest.unstable_mockModule("../../security/trusted-types.js", () => ({
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
});
