import { jest } from "@jest/globals";
import { DEFAULT_MAIN_GROUP_INDEX_CONTENT } from "./defaultIndexContent.mjs";

const mockGroupFileExists = jest.fn() as any;
const mockWriteGroupFile = jest.fn() as any;
const mockGetConfig = jest.fn() as any;
const mockSetConfig = jest.fn() as any;

jest.unstable_mockModule("./groupFileExists.js", () => ({
  groupFileExists: mockGroupFileExists,
}));

jest.unstable_mockModule("./writeGroupFile.js", () => ({
  writeGroupFile: mockWriteGroupFile,
}));

jest.unstable_mockModule("../db/getConfig.js", () => ({
  getConfig: mockGetConfig,
}));

jest.unstable_mockModule("../db/setConfig.js", () => ({
  setConfig: mockSetConfig,
}));

const {
  ensureMainGroupIndex,
  STATIC_MAIN_GROUP_INDEX_PATH,
  resolveStaticMainGroupIndexUrl,
  isMainGroupIndexSuppressed,
  setMainGroupIndexSuppressed,
} = await import("./ensureMainGroupIndex.js");

const { DEFAULT_GROUP_ID } = await import("../config/config.js");

describe("ensureMainGroupIndex", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockGroupFileExists as any).mockReset();
    (mockWriteGroupFile as any).mockReset();
    (mockGetConfig as any).mockReset();
    (mockSetConfig as any).mockReset();
    (mockGetConfig as any).mockResolvedValue(undefined);
    (mockSetConfig as any).mockResolvedValue(undefined);
    (globalThis as any).fetch = (jest.fn() as any).mockRejectedValue(
      new Error("no static template"),
    );
  });

  it("returns true immediately if index.html already exists", async () => {
    mockGroupFileExists.mockResolvedValue(true);

    const res = await ensureMainGroupIndex({} as any, "group-1");
    expect(res).toBe(true);
    expect(mockWriteGroupFile).not.toHaveBeenCalled();
  });

  it("returns false if index.html is suppressed for DEFAULT_GROUP_ID", async () => {
    mockGroupFileExists.mockResolvedValue(false);
    mockGetConfig.mockResolvedValue(true);

    const res = await ensureMainGroupIndex({} as any, DEFAULT_GROUP_ID);
    expect(res).toBe(false);
    expect(mockWriteGroupFile).not.toHaveBeenCalled();
  });

  it("creates index.html with custom content if supplied", async () => {
    mockGroupFileExists.mockResolvedValue(false);
    mockWriteGroupFile.mockResolvedValue(undefined);

    const res = await ensureMainGroupIndex(
      {} as any,
      "custom-group",
      "<h1>Custom Title</h1>",
    );
    expect(res).toBe(true);
    expect(mockWriteGroupFile).toHaveBeenCalledWith(
      {},
      "custom-group",
      "index.html",
      "<h1>Custom Title</h1>",
    );
  });

  it("fetches static template if available", async () => {
    mockGroupFileExists.mockResolvedValue(false);
    (globalThis as any).fetch = (jest.fn() as any).mockResolvedValue({
      ok: true,
      text: async () => "<html>Static Template</html>",
    });

    const res = await ensureMainGroupIndex({} as any, DEFAULT_GROUP_ID);
    expect(res).toBe(true);
    expect(mockWriteGroupFile).toHaveBeenCalledWith(
      {},
      DEFAULT_GROUP_ID,
      "index.html",
      "<html>Static Template</html>",
    );
  });

  it("falls back to DEFAULT_MAIN_GROUP_INDEX_CONTENT when fetch fails", async () => {
    mockGroupFileExists.mockResolvedValue(false);
    mockWriteGroupFile.mockResolvedValue(undefined);

    const res = await ensureMainGroupIndex({} as any, DEFAULT_GROUP_ID);
    expect(res).toBe(true);
    expect(mockWriteGroupFile).toHaveBeenCalledWith(
      {},
      DEFAULT_GROUP_ID,
      "index.html",
      DEFAULT_MAIN_GROUP_INDEX_CONTENT,
    );
  });

  it("returns false if writeGroupFile throws an error", async () => {
    mockGroupFileExists.mockResolvedValue(false);
    mockWriteGroupFile.mockRejectedValue(new Error("Storage write failure"));

    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const res = await ensureMainGroupIndex({} as any, DEFAULT_GROUP_ID);
    expect(res).toBe(false);
    warnSpy.mockRestore();
  });

  it("tests isMainGroupIndexSuppressed and setMainGroupIndexSuppressed", async () => {
    mockGetConfig.mockResolvedValueOnce("true").mockResolvedValueOnce(false);

    expect(await isMainGroupIndexSuppressed({} as any)).toBe(true);
    expect(await isMainGroupIndexSuppressed({} as any)).toBe(false);

    await setMainGroupIndexSuppressed({} as any, true);
    expect(mockSetConfig).toHaveBeenCalledWith(
      {},
      "main_group_index_suppressed",
      true,
    );
  });

  it("resolves static main group index url with and without window.location.origin", () => {
    const url = resolveStaticMainGroupIndexUrl();
    expect(url).toContain(STATIC_MAIN_GROUP_INDEX_PATH);

    const originalLocation = window.location;
    try {
      delete (window as any).location;
      expect(resolveStaticMainGroupIndexUrl()).toContain(
        STATIC_MAIN_GROUP_INDEX_PATH,
      );
    } finally {
      (window as any).location = originalLocation;
    }
  });
});
