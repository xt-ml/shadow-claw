import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockLoadApprovedCustomElementScript = jest.fn(async () =>
  document.createElement("script"),
);
const mockGetApprovedCustomElementScriptDescriptors = jest.fn(() => [
  {
    id: "feed-scroller",
    src: "/pages/main/assets/feed-scroller.js",
    global: true,
    hasInit: true,
  },
  {
    id: "x-hook-component",
    src: "/pages/main/assets/x-hook-component.js",
    hasInit: true,
  },
  {
    name: "x-postpress-code",
    src: "/pages/main/assets/x-postpress-code.js",
    hasInit: true,
  },
]);

jest.unstable_mockModule("../../security/custom-element-security.js", () => ({
  getApprovedCustomElementScriptDescriptors:
    mockGetApprovedCustomElementScriptDescriptors,
  loadApprovedCustomElementScript: mockLoadApprovedCustomElementScript,
  isApprovedScript: jest.fn((_src: string) => true),
  isAllowedCustomElement: jest.fn(() => true),
  getIframeCsp: jest.fn(() => ""),
  getIframeSandboxPolicy: jest.fn(() => "allow-scripts"),
  hasApprovedCustomElement: jest.fn(() => false),
}));

jest.unstable_mockModule("../../core/effect.js", () => ({
  effect: jest.fn(() => () => undefined),
}));

jest.unstable_mockModule("../../content/markdown.js", () => ({
  renderMarkdown: jest.fn(
    async (value: string) =>
      `<article>${value.replace(/<script[\s\S]*?<\/script>/gi, "")}</article>`,
  ),
}));

jest.unstable_mockModule("../../security/trusted-types.js", () => ({
  sanitizeToTrustedHtml: jest.fn((html: string) => html),
  sanitizeSrcdocHtml: jest.fn((html: string) => html),
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

let mockActivePinnedPage: any = null;
jest.unstable_mockModule("../../stores/orchestrator.js", () => ({
  orchestratorStore: {
    whenInitialized: Promise.resolve(),
    whenReady: Promise.resolve(),
    pages: [],
    groups: [],
    activeGroupId: "group-1",
    isPageAllowed: jest.fn(() => true),
    get activePinnedPage() {
      return mockActivePinnedPage;
    },
    setActivePinnedPage: jest.fn(async (_db: any, val: any) => {
      mockActivePinnedPage = val;
    }),
    _activePinnedPage: {
      set: jest.fn((val: any) => {
        mockActivePinnedPage = val;
      }),
    },
  },
}));

jest.unstable_mockModule("../../storage/read-group-file.js", () => ({
  readGroupFile: jest.fn(),
}));

jest.unstable_mockModule("../../storage/static-main-site.js", () => ({
  getStaticMainManifest: jest.fn(async () => ({ pages: [] })),
  getStaticPageContent: jest.fn(async () => null),
  seedStaticMainSite: jest.fn(),
  getSiteConfigSeoSettings: jest.fn(() => ({ siteTitle: "ShadowClaw" })),
}));

jest.unstable_mockModule("../../db/db.js", () => ({
  getDb: jest.fn(async () => ({})),
}));

jest.unstable_mockModule("../../db/get-config.js", () => ({
  getConfig: jest.fn(async () => "0"),
}));

const { ShadowClawPages } = await import("./shadow-claw-pages.js");
const { readGroupFile } = await import("../../storage/read-group-file.js");
const { setSanitizedHtml } = await import("../../security/trusted-types.js");

describe("ShadowClawPages - Script Dependencies Loading", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads global scripts and frontmatter-declared script dependencies", async () => {
    const component = new ShadowClawPages();
    component.db = {} as any;
    component.selectedPage = { groupId: "group-1", path: "posts/dynamic.md" };

    const postContent = [
      "---",
      'title: "The Web Is Dynamic"',
      "dependencies:",
      '  - "x-hook-component"',
      "---",
      "# The Web Is Dynamic",
      "<x-hook-component></x-hook-component>",
    ].join("\n");

    (
      readGroupFile as jest.MockedFunction<typeof readGroupFile>
    ).mockResolvedValueOnce(postContent);

    await component.renderSelectedPage();

    expect(mockLoadApprovedCustomElementScript).toHaveBeenCalledWith(
      "/pages/main/assets/feed-scroller.js",
    );
    expect(mockLoadApprovedCustomElementScript).toHaveBeenCalledWith(
      "/pages/main/assets/x-hook-component.js",
    );
    expect(mockLoadApprovedCustomElementScript).not.toHaveBeenCalledWith(
      "/pages/main/assets/x-postpress-code.js",
    );
    expect(setSanitizedHtml).toHaveBeenCalledTimes(1);
  });

  it("fails gracefully when an unresolvable dependency is in frontmatter without breaking rendering", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const component = new ShadowClawPages();
    component.db = {} as any;
    component.selectedPage = { groupId: "group-1", path: "posts/unknown.md" };

    const postContent = [
      "---",
      'title: "Unknown Script Page"',
      "dependencies:",
      '  - "unknown-script-id"',
      "---",
      "# Unknown Script Page",
      "<p>Some content</p>",
    ].join("\n");

    (
      readGroupFile as jest.MockedFunction<typeof readGroupFile>
    ).mockResolvedValueOnce(postContent);

    await component.renderSelectedPage();

    // Global script should still load
    expect(mockLoadApprovedCustomElementScript).toHaveBeenCalledWith(
      "/pages/main/assets/feed-scroller.js",
    );
    // Page rendering should still succeed
    expect(setSanitizedHtml).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });

  it("fails gracefully when loadApprovedCustomElementScript throws without breaking rendering", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockLoadApprovedCustomElementScript.mockRejectedValueOnce(
      new Error("Network connection failed"),
    );

    const component = new ShadowClawPages();
    component.db = {} as any;
    component.selectedPage = { groupId: "group-1", path: "posts/faulty.md" };

    const postContent = [
      "---",
      'title: "Faulty Script Page"',
      "dependencies:",
      '  - "x-hook-component"',
      "---",
      "# Faulty Script Page",
    ].join("\n");

    (
      readGroupFile as jest.MockedFunction<typeof readGroupFile>
    ).mockResolvedValueOnce(postContent);

    // Should not throw
    await expect(component.renderSelectedPage()).resolves.toBeUndefined();
    expect(setSanitizedHtml).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });

  it("extracts and loads inline script tags from raw markdown content before DOMPurify strips them", async () => {
    const component = new ShadowClawPages();
    component.db = {} as any;
    component.selectedPage = { groupId: "group-1", path: "posts/inline.md" };

    const postContent = [
      "---",
      'title: "Inline Script Page"',
      "---",
      "# Inline Script Page",
      '<script type="module" src="/pages/main/assets/x-postpress-code.js"></script>',
    ].join("\n");

    (
      readGroupFile as jest.MockedFunction<typeof readGroupFile>
    ).mockResolvedValueOnce(postContent);

    await component.renderSelectedPage();

    expect(mockLoadApprovedCustomElementScript).toHaveBeenCalledWith(
      "/pages/main/assets/x-postpress-code.js",
    );
    expect(setSanitizedHtml).toHaveBeenCalledTimes(1);
  });

  it("resolves and loads scripts by filename stem when existing config does not specify an id", async () => {
    mockGetApprovedCustomElementScriptDescriptors.mockReturnValueOnce([
      { src: "/pages/main/assets/feed-scroller.js", global: true },
      { src: "/pages/main/assets/x-hook-component.js" },
    ] as any);

    const component = new ShadowClawPages();
    component.db = {} as any;
    component.selectedPage = { groupId: "group-1", path: "posts/legacy.md" };

    const postContent = [
      "---",
      'title: "Legacy Post"',
      "dependencies:",
      '  - "x-hook-component"',
      "---",
      "# Legacy Post",
    ].join("\n");

    (
      readGroupFile as jest.MockedFunction<typeof readGroupFile>
    ).mockResolvedValueOnce(postContent);

    await component.renderSelectedPage();

    expect(mockLoadApprovedCustomElementScript).toHaveBeenCalledWith(
      "/pages/main/assets/feed-scroller.js",
    );
    expect(mockLoadApprovedCustomElementScript).toHaveBeenCalledWith(
      "/pages/main/assets/x-hook-component.js",
    );
    expect(setSanitizedHtml).toHaveBeenCalledTimes(1);
  });
});
