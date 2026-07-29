import { jest } from "@jest/globals";

const mockGroupFileExists = jest.fn() as any;
const mockReadGroupFile = jest.fn() as any;
const mockWriteGroupFile = jest.fn() as any;
const mockGetConfig = jest.fn() as any;
const mockSetConfig = jest.fn() as any;
const mockEnsureMainGroupIndex = jest.fn() as any;

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

const {
  getStaticMainManifest,
  seedStaticMainSite,
  STATIC_MAIN_MANIFEST_PATH,
  resolveStaticMainManifestUrl,
} = await import("./staticMainSite.js");
const { DEFAULT_GROUP_ID } = await import("../config/config.js");

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
      typeof document !== "undefined" && document.baseURI
        ? new URL(STATIC_MAIN_MANIFEST_PATH, document.baseURI).toString()
        : `/${STATIC_MAIN_MANIFEST_PATH}`;
    expect(resolveStaticMainManifestUrl()).toBe(expected);
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
      { groupId: DEFAULT_GROUP_ID, path: "MEMORY.md" },
      { groupId: DEFAULT_GROUP_ID, path: "guide.md" },
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
      { groupId: DEFAULT_GROUP_ID, path: "MEMORY.md" },
      { groupId: DEFAULT_GROUP_ID, path: "guide.md" },
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
      { groupId: DEFAULT_GROUP_ID, path: "MEMORY.md" },
      { groupId: DEFAULT_GROUP_ID, path: "getting-started.md" },
      { groupId: DEFAULT_GROUP_ID, path: "2026-06-28-a-new-day.md" },
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
});
