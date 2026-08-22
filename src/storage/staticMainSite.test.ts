import { jest } from "@jest/globals";

const mockGroupFileExists = jest.fn() as any;
const mockReadGroupFile = jest.fn() as any;
const mockWriteGroupFile = jest.fn() as any;
const mockGetConfig = jest.fn() as any;
const mockSetConfig = jest.fn() as any;
const mockEnsureMainGroupIndex = jest.fn() as any;
const mockDeleteAllGroupFiles = jest.fn() as any;

jest.unstable_mockModule("./groupFileExists.js", () => ({
  groupFileExists: mockGroupFileExists,
}));

jest.unstable_mockModule("./readGroupFile.js", () => ({
  readGroupFile: mockReadGroupFile,
}));

jest.unstable_mockModule("./writeGroupFile.js", () => ({
  writeGroupFile: mockWriteGroupFile,
}));

jest.unstable_mockModule("./ensureMainGroupIndex.js", () => ({
  ensureMainGroupIndex: mockEnsureMainGroupIndex,
}));

jest.unstable_mockModule("../db/getConfig.js", () => ({
  getConfig: mockGetConfig,
}));

jest.unstable_mockModule("../db/setConfig.js", () => ({
  setConfig: mockSetConfig,
}));

jest.unstable_mockModule("./deleteAllGroupFiles.js", () => ({
  deleteAllGroupFiles: mockDeleteAllGroupFiles,
}));

const {
  getStaticMainManifest,
  getStaticPageContent,
  fetchStaticMainFile,
  fetchStaticMainManifest,
  resolveStaticMainFileUrl,
  seedStaticMainSite,
  isStaticMainSiteSeeded,
  setStaticMainSiteSeeded,
  staticMainSiteSeededKey,
  STATIC_MAIN_MANIFEST_PATH,
  STATIC_MAIN_DIR,
  resolveStaticMainManifestUrl,
  PURGE_STORAGE_KEY,
} = await import("./staticMainSite.js");
const { CONFIG_KEYS, DEFAULT_GROUP_ID } = await import("../config/config.js");

describe("staticMainSite", () => {
  let mockFetch: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGroupFileExists.mockReset();
    mockReadGroupFile.mockReset();
    mockWriteGroupFile.mockReset();
    mockGetConfig.mockReset();
    mockSetConfig.mockReset();
    mockEnsureMainGroupIndex.mockReset();
    mockGetConfig.mockResolvedValue(undefined);
    mockSetConfig.mockResolvedValue(undefined);
    mockEnsureMainGroupIndex.mockResolvedValue(true);

    mockFetch = jest.fn();
    (mockFetch as any).mockRejectedValue(new Error("no static manifest"));
    (globalThis as any).fetch = mockFetch;

    // Remove mock script element if any
    const existing = document.getElementById("shadow-claw-static-manifest");
    if (existing) {
      existing.remove();
    }
  });

  it("resolves the static manifest URL correctly", () => {
    const expected =
      typeof window !== "undefined" && window.location?.origin
        ? new URL(
            `/${STATIC_MAIN_MANIFEST_PATH}`,
            window.location.origin,
          ).toString()
        : `/${STATIC_MAIN_MANIFEST_PATH}`;
    expect(resolveStaticMainManifestUrl()).toBe(expected);
  });

  it("resolves static main file URL correctly", () => {
    const expected =
      typeof window !== "undefined" && window.location?.origin
        ? new URL(
            `/${STATIC_MAIN_DIR}/posts/test.md`,
            window.location.origin,
          ).toString()
        : `/${STATIC_MAIN_DIR}/posts/test.md`;
    expect(resolveStaticMainFileUrl("posts/test.md")).toBe(expected);
  });

  it("resolves static URLs correctly when window location is deep path", () => {
    const origHref = window.location.href;
    try {
      window.history.pushState(
        {},
        "",
        "/pages/main/posts/2025/12/31/2025-12-31_00-08-00.md",
      );
      expect(resolveStaticMainManifestUrl()).toBe(
        `${window.location.origin}/static-main-manifest.json`,
      );
      expect(resolveStaticMainFileUrl("posts/2025/12/31/test.md")).toBe(
        `${window.location.origin}/static-main/posts/2025/12/31/test.md`,
      );
    } finally {
      window.history.pushState({}, "", origHref);
    }
  });

  it("fetches static main file directly via fetchStaticMainFile", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => "# Post Content",
    });

    const content = await fetchStaticMainFile("posts/test.md");
    expect(content).toBe("# Post Content");
  });

  it("fetches static main manifest via fetchStaticMainManifest", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        pages: [{ displayPath: "posts/remote.md", content: "# Remote" }],
      }),
    });

    const manifest = await fetchStaticMainManifest();
    expect(manifest?.pages).toHaveLength(1);
    expect(manifest?.pages[0].displayPath).toBe("posts/remote.md");
  });

  it("getStaticPageContent checks embedded script first, then static-main file, then remote manifest", async () => {
    // 1. Embedded script present
    const script = document.createElement("script");
    script.id = "shadow-claw-static-manifest";
    script.type = "application/json";
    script.textContent = JSON.stringify({
      pages: [{ displayPath: "page1.md", content: "# Embedded Page 1" }],
    });
    document.head.appendChild(script);

    const fromEmbedded = await getStaticPageContent("page1.md");
    expect(fromEmbedded).toBe("# Embedded Page 1");

    // 2. Not in embedded script -> fetches static-main/file
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => "# Direct File Content",
    });

    const fromDirectFetch = await getStaticPageContent("page2.md");
    expect(fromDirectFetch).toBe("# Direct File Content");

    // 3. Direct fetch 404s -> fetches static-main-manifest.json
    mockFetch.mockResolvedValueOnce({ ok: false }); // direct file 404
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        pages: [{ displayPath: "page3.md", content: "# From Full Manifest" }],
      }),
    });

    const fromFullManifest = await getStaticPageContent("page3.md");
    expect(fromFullManifest).toBe("# From Full Manifest");
  });

  it("reads static manifest from embedded DOM script tag if present", async () => {
    const script = document.createElement("script");
    script.id = "shadow-claw-static-manifest";
    script.type = "application/json";
    script.textContent = JSON.stringify({
      pages: [
        { displayPath: "MEMORY.md", content: "# Main Memory" },
        { displayPath: "guide.md", content: "# Guide" },
      ],
    });
    document.head.appendChild(script);

    const manifest = await getStaticMainManifest();
    expect(manifest.pages).toHaveLength(2);
    expect(manifest.pages[0].displayPath).toBe("MEMORY.md");
    expect(manifest.pages[1].displayPath).toBe("guide.md");
  });

  it("parses embedded static manifest containing HTML script tags and code blocks safely", async () => {
    const script = document.createElement("script");
    script.id = "shadow-claw-static-manifest";
    script.type = "application/json";
    const rawContent = JSON.stringify({
      pages: [
        {
          displayPath: "posts/script-post.md",
          content:
            "Here is code:\n<script type=\"module\">import 'https://unpkg.com/x-postpress-code@1.0/dist/x-postpress-code.js';</script>\n",
        },
      ],
    });
    script.textContent = rawContent
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e")
      .replace(/\//g, "\\u002f");
    document.head.appendChild(script);

    const manifest = await getStaticMainManifest();
    expect(manifest.pages).toHaveLength(1);
    expect(manifest.pages[0].displayPath).toBe("posts/script-post.md");
    expect(manifest.pages[0].content).toContain(
      "<script type=\"module\">import 'https://unpkg.com/x-postpress-code@1.0/dist/x-postpress-code.js';",
    );
  });

  it("fetches static manifest from URL if DOM script tag is missing", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        pages: [{ displayPath: "MEMORY.md", content: "# Fetched Memory" }],
      }),
    });

    const manifest = await getStaticMainManifest();
    expect(manifest.pages).toHaveLength(1);
    expect(manifest.pages[0].content).toBe("# Fetched Memory");
  });

  it("seeds static main site files into workspace storage", async () => {
    const script = document.createElement("script");
    script.id = "shadow-claw-static-manifest";
    script.type = "application/json";
    script.textContent = JSON.stringify({
      pages: [
        { displayPath: "MEMORY.md", content: "# Main Memory" },
        { displayPath: "guide.md", content: "# Guide" },
      ],
    });
    document.head.appendChild(script);

    mockGroupFileExists.mockResolvedValue(false);
    mockWriteGroupFile.mockResolvedValue(undefined);

    const seeded = await seedStaticMainSite({} as any);

    expect(seeded).toEqual([
      { groupId: DEFAULT_GROUP_ID, path: "guide.md" },
      { groupId: DEFAULT_GROUP_ID, path: "MEMORY.md" },
    ]);
    expect(mockWriteGroupFile).toHaveBeenCalledTimes(2);
    expect(mockWriteGroupFile).toHaveBeenCalledWith(
      {} as any,
      DEFAULT_GROUP_ID,
      "MEMORY.md",
      expect.any(String),
    );
    expect(mockWriteGroupFile).toHaveBeenCalledWith(
      {} as any,
      DEFAULT_GROUP_ID,
      "guide.md",
      "# Guide",
    );
  });

  it("does not overwrite MEMORY.md if main group memory is suppressed", async () => {
    const script = document.createElement("script");
    script.id = "shadow-claw-static-manifest";
    script.type = "application/json";
    script.textContent = JSON.stringify({
      pages: [
        { displayPath: "MEMORY.md", content: "# Main Memory" },
        { displayPath: "guide.md", content: "# Guide" },
      ],
    });
    document.head.appendChild(script);

    mockGetConfig.mockImplementation((_db: any, key: string) => {
      if (key === "main_group_readme_suppressed") {
        return Promise.resolve(true);
      }
      return Promise.resolve(undefined);
    });

    mockGroupFileExists.mockResolvedValue(false);
    mockWriteGroupFile.mockResolvedValue(undefined);

    const seeded = await seedStaticMainSite({} as any);

    expect(seeded).toEqual([{ groupId: DEFAULT_GROUP_ID, path: "guide.md" }]);
    expect(mockWriteGroupFile).toHaveBeenCalledTimes(1);
    expect(mockWriteGroupFile).toHaveBeenCalledWith(
      {} as any,
      DEFAULT_GROUP_ID,
      "guide.md",
      "# Guide",
    );
  });

  it("does not write files that already exist in workspace", async () => {
    const script = document.createElement("script");
    script.id = "shadow-claw-static-manifest";
    script.type = "application/json";
    script.textContent = JSON.stringify({
      pages: [
        { displayPath: "MEMORY.md", content: "# Main Memory" },
        { displayPath: "guide.md", content: "# Guide" },
      ],
    });
    document.head.appendChild(script);

    mockGroupFileExists.mockImplementation(
      (_db: any, _groupId: string, path: string) => {
        return Promise.resolve(path === "MEMORY.md");
      },
    );

    const seeded = await seedStaticMainSite({} as any);

    expect(seeded).toEqual([
      { groupId: DEFAULT_GROUP_ID, path: "guide.md" },
      { groupId: DEFAULT_GROUP_ID, path: "MEMORY.md" },
    ]);
    expect(mockWriteGroupFile).toHaveBeenCalledTimes(1);
    expect(mockWriteGroupFile).toHaveBeenCalledWith(
      {} as any,
      DEFAULT_GROUP_ID,
      "guide.md",
      "# Guide",
    );
  });

  it("merges newly deployed static manifest pages into existing pages list", async () => {
    const script = document.createElement("script");
    script.id = "shadow-claw-static-manifest";
    script.type = "application/json";
    script.textContent = JSON.stringify({
      pages: [
        { displayPath: "MEMORY.md", content: "# Memory" },
        { displayPath: "getting-started.md", content: "# Getting Started" },
        { displayPath: "2026-06-28-a-new-day.md", content: "# New Day" },
      ],
    });
    document.head.appendChild(script);

    mockGroupFileExists.mockResolvedValue(false);
    mockWriteGroupFile.mockResolvedValue(undefined);

    const existingPages = [{ groupId: DEFAULT_GROUP_ID, path: "MEMORY.md" }];
    const seeded = await seedStaticMainSite(
      {} as any,
      DEFAULT_GROUP_ID,
      existingPages,
    );

    expect(seeded).toEqual([
      { groupId: DEFAULT_GROUP_ID, path: "getting-started.md" },
      { groupId: DEFAULT_GROUP_ID, path: "2026-06-28-a-new-day.md" },
      { groupId: DEFAULT_GROUP_ID, path: "MEMORY.md" },
    ]);
  });

  it("skips seeding pages that are in suppressed_pages_list", async () => {
    const script = document.createElement("script");
    script.id = "shadow-claw-static-manifest";
    script.type = "application/json";
    script.textContent = JSON.stringify({
      pages: [
        { displayPath: "removed.md", content: "# Removed" },
        { displayPath: "2026-06-28-a-new-day.md", content: "# New Day" },
      ],
    });
    document.head.appendChild(script);

    mockGetConfig.mockImplementation((_db: any, key: string) => {
      if (key === "suppressed_pages_list") {
        return Promise.resolve(
          JSON.stringify([{ groupId: DEFAULT_GROUP_ID, path: "removed.md" }]),
        );
      }
      return Promise.resolve(undefined);
    });

    mockGroupFileExists.mockResolvedValue(false);
    mockWriteGroupFile.mockResolvedValue(undefined);

    const seeded = await seedStaticMainSite({} as any);

    expect(seeded).toEqual([
      { groupId: DEFAULT_GROUP_ID, path: "2026-06-28-a-new-day.md" },
    ]);
    expect(mockWriteGroupFile).toHaveBeenCalledTimes(1);
    expect(mockWriteGroupFile).toHaveBeenCalledWith(
      {} as any,
      DEFAULT_GROUP_ID,
      "2026-06-28-a-new-day.md",
      "# New Day",
    );
  });

  it("ensures main group index.html is created during static main site seeding", async () => {
    const script = document.createElement("script");
    script.id = "shadow-claw-static-manifest";
    script.type = "application/json";
    script.textContent = JSON.stringify({
      pages: [{ displayPath: "MEMORY.md", content: "# Memory" }],
    });
    document.head.appendChild(script);

    mockGroupFileExists.mockImplementation(
      (_db: any, _groupId: string, path: string) => {
        return Promise.resolve(path === "MEMORY.md");
      },
    );

    await seedStaticMainSite({} as any);

    expect(mockEnsureMainGroupIndex).toHaveBeenCalledWith(
      {} as any,
      DEFAULT_GROUP_ID,
    );
  });

  it("checks and sets static main site seeded status in database config", async () => {
    mockGetConfig.mockResolvedValueOnce(undefined);
    const initialStatus = await isStaticMainSiteSeeded(
      {} as any,
      DEFAULT_GROUP_ID,
    );
    expect(initialStatus).toBe(false);
    expect(mockGetConfig).toHaveBeenCalledWith(
      {} as any,
      CONFIG_KEYS.STATIC_MAIN_SITE_SEEDED,
    );

    await setStaticMainSiteSeeded({} as any, DEFAULT_GROUP_ID, true);
    expect(mockSetConfig).toHaveBeenCalledWith(
      {} as any,
      CONFIG_KEYS.STATIC_MAIN_SITE_SEEDED,
      true,
    );

    expect(staticMainSiteSeededKey("custom-group")).toBe(
      `${CONFIG_KEYS.STATIC_MAIN_SITE_SEEDED}:custom-group`,
    );
  });

  it("uses embedded script synchronously and does not fetch full manifest by default", async () => {
    const script = document.createElement("script");
    script.id = "shadow-claw-static-manifest";
    script.type = "application/json";
    script.textContent = JSON.stringify({
      pages: [
        { displayPath: "posts/current-post.md", content: "# Current Post" },
      ],
    });
    document.head.appendChild(script);

    mockGroupFileExists.mockResolvedValue(false);
    mockWriteGroupFile.mockResolvedValue(undefined);

    const seeded = await seedStaticMainSite({} as any);

    expect(seeded).toEqual([
      { groupId: DEFAULT_GROUP_ID, path: "posts/current-post.md" },
    ]);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockWriteGroupFile).toHaveBeenCalledWith(
      {} as any,
      DEFAULT_GROUP_ID,
      "posts/current-post.md",
      "# Current Post",
    );
  });

  it("fetches full static-main-manifest.json during seedStaticMainSite when preferEmbedded is false", async () => {
    // 1. Partial embedded script with only 1 page
    const script = document.createElement("script");
    script.id = "shadow-claw-static-manifest";
    script.type = "application/json";
    script.textContent = JSON.stringify({
      pages: [
        { displayPath: "posts/single-page.md", content: "# Single Page" },
      ],
    });
    document.head.appendChild(script);

    // 2. Full remote manifest with all pages
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        pages: [
          { displayPath: "MEMORY.md", content: "# Main Memory" },
          { displayPath: "posts/page-1.md", content: "# Page 1" },
          { displayPath: "posts/page-2.md", content: "# Page 2" },
        ],
      }),
    });

    mockGroupFileExists.mockResolvedValue(false);
    mockWriteGroupFile.mockResolvedValue(undefined);

    const seeded = await seedStaticMainSite({} as any, DEFAULT_GROUP_ID, [], {
      preferEmbedded: false,
    });

    expect(seeded).toEqual([
      { groupId: DEFAULT_GROUP_ID, path: "posts/page-2.md" },
      { groupId: DEFAULT_GROUP_ID, path: "posts/page-1.md" },
      { groupId: DEFAULT_GROUP_ID, path: "MEMORY.md" },
    ]);
    expect(mockWriteGroupFile).toHaveBeenCalledWith(
      {} as any,
      DEFAULT_GROUP_ID,
      "posts/page-1.md",
      "# Page 1",
    );
    expect(mockWriteGroupFile).toHaveBeenCalledWith(
      {} as any,
      DEFAULT_GROUP_ID,
      "posts/page-2.md",
      "# Page 2",
    );
    expect(mockSetConfig).toHaveBeenCalledWith(
      {} as any,
      CONFIG_KEYS.STATIC_MAIN_SITE_SEEDED,
      true,
    );
  });

  it("fetches individual file content via fetchStaticMainFile during seeding if content is missing in manifest", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        pages: [
          { displayPath: "posts/remote-file.md" }, // no content property
        ],
      }),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => "# Fetched Content",
    });

    mockGroupFileExists.mockResolvedValue(false);
    mockWriteGroupFile.mockResolvedValue(undefined);

    const seeded = await seedStaticMainSite({} as any);

    expect(seeded).toEqual([
      { groupId: DEFAULT_GROUP_ID, path: "posts/remote-file.md" },
    ]);
    expect(mockWriteGroupFile).toHaveBeenCalledWith(
      {} as any,
      DEFAULT_GROUP_ID,
      "posts/remote-file.md",
      "# Fetched Content",
    );
  });
});

// ── localStorage-gated purge ───────────────────────────────────────────────

// mockDeleteAllGroupFiles and PURGE_STORAGE_KEY are hoisted at the top of the
// file so they are available to both describe blocks.

const PURGE_SLUG_CONTENT =
  '---\ntitle: "MEMORY"\nslug: "shadow-claw--purge-pages"\npurge-id: "build-001"\n---\n';

function injectManifestScript(manifest: object) {
  const existing = document.getElementById("shadow-claw-static-manifest");
  if (existing) existing.remove();
  const script = document.createElement("script");
  script.id = "shadow-claw-static-manifest";
  script.type = "application/json";
  script.textContent = JSON.stringify(manifest);
  document.head.appendChild(script);
}

describe("seedStaticMainSite – localStorage-gated purge", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGroupFileExists.mockResolvedValue(false);
    mockWriteGroupFile.mockResolvedValue(undefined);
    mockGetConfig.mockResolvedValue(undefined);
    mockSetConfig.mockResolvedValue(undefined);
    mockEnsureMainGroupIndex.mockResolvedValue(true);
    mockDeleteAllGroupFiles.mockResolvedValue(undefined);
    localStorage.clear();
  });

  it("purges on first boot when purgeId is present and localStorage is empty", async () => {
    injectManifestScript({
      pages: [{ displayPath: "MEMORY.md", content: PURGE_SLUG_CONTENT }],
      purgeId: "build-001",
    });

    await seedStaticMainSite({} as any);

    expect(mockDeleteAllGroupFiles).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(PURGE_STORAGE_KEY)).toBe("build-001");
  });

  it("skips purge on subsequent boots when localStorage matches purgeId", async () => {
    localStorage.setItem(PURGE_STORAGE_KEY, "build-001");

    injectManifestScript({
      pages: [{ displayPath: "MEMORY.md", content: PURGE_SLUG_CONTENT }],
      purgeId: "build-001",
    });

    await seedStaticMainSite({} as any);

    expect(mockDeleteAllGroupFiles).not.toHaveBeenCalled();
  });

  it("re-purges when purgeId changes between deployments", async () => {
    localStorage.setItem(PURGE_STORAGE_KEY, "build-001");

    const newContent = PURGE_SLUG_CONTENT.replace("build-001", "build-002");
    injectManifestScript({
      pages: [{ displayPath: "MEMORY.md", content: newContent }],
      purgeId: "build-002",
    });

    await seedStaticMainSite({} as any);

    expect(mockDeleteAllGroupFiles).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(PURGE_STORAGE_KEY)).toBe("build-002");
  });

  it("purges only once when purgeId is absent from manifest", async () => {
    injectManifestScript({
      pages: [
        {
          displayPath: "MEMORY.md",
          content: '---\nslug: "shadow-claw--purge-pages"\n---\n',
        },
      ],
      // no purgeId field
    });

    await seedStaticMainSite({} as any);
    expect(mockDeleteAllGroupFiles).toHaveBeenCalledTimes(1);

    // Second call – the ID-less reset marker has already been consumed.
    const existing = document.getElementById("shadow-claw-static-manifest");
    if (existing) existing.remove();
    injectManifestScript({
      pages: [
        {
          displayPath: "MEMORY.md",
          content: '---\nslug: "shadow-claw--purge-pages"\n---\n',
        },
      ],
    });

    await seedStaticMainSite({} as any);
    expect(mockDeleteAllGroupFiles).toHaveBeenCalledTimes(1);
  });
});
