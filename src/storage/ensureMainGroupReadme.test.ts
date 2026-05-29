import { jest } from "@jest/globals";

const mockGroupFileExists = jest.fn() as any;
const mockReadGroupFile = jest.fn() as any;
const mockWriteGroupFile = jest.fn() as any;
const mockGetConfig = jest.fn() as any;
const mockSetConfig = jest.fn() as any;

jest.unstable_mockModule("./groupFileExists.js", () => ({
  groupFileExists: mockGroupFileExists,
}));

jest.unstable_mockModule("./readGroupFile.js", () => ({
  readGroupFile: mockReadGroupFile,
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
  ensureMainGroupReadme,
  DEFAULT_MAIN_GROUP_README_PATH,
  DEFAULT_MAIN_GROUP_README_CONTENT,
  LEGACY_MAIN_GROUP_README_PATH_ROOT,
  STATIC_MAIN_GROUP_README_PATH,
  resolveStaticMainGroupReadmeUrl,
  isMainGroupReadmeSuppressed,
  setMainGroupReadmeSuppressed,
} = await import("./ensureMainGroupReadme.js");
const { DEFAULT_GROUP_ID } = await import("../config.js");

describe("ensureMainGroupReadme", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockGroupFileExists as any).mockReset();
    (mockReadGroupFile as any).mockReset();
    (mockWriteGroupFile as any).mockReset();
    (mockGetConfig as any).mockReset();
    (mockSetConfig as any).mockReset();
    (mockGetConfig as any).mockResolvedValue(undefined);
    (mockSetConfig as any).mockResolvedValue(undefined);
    (globalThis as any).fetch = (jest.fn() as any).mockRejectedValue(
      new Error("no static template"),
    );
  });

  it("creates MEMORY.md when missing, using content that matches main/MEMORY.md", async () => {
    (mockGroupFileExists as any)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false);
    (mockWriteGroupFile as any).mockResolvedValue(undefined);

    await expect(ensureMainGroupReadme({} as any)).resolves.toBe(true);

    expect(mockWriteGroupFile).toHaveBeenCalledWith(
      {} as any,
      DEFAULT_GROUP_ID,
      DEFAULT_MAIN_GROUP_README_PATH,
      DEFAULT_MAIN_GROUP_README_CONTENT,
    );

    // Fallback content must match what static build renders from main/MEMORY.md
    expect(DEFAULT_MAIN_GROUP_README_CONTENT).toContain(
      "# Welcome to ShadowClaw Pages",
    );
    expect(DEFAULT_MAIN_GROUP_README_CONTENT).toContain("## Getting Started");
    expect(DEFAULT_MAIN_GROUP_README_CONTENT).toContain(
      "## What is MEMORY.md?",
    );
    expect(DEFAULT_MAIN_GROUP_README_CONTENT).not.toContain(
      "## Why This File Exists",
    );
  });

  it("does not overwrite MEMORY.md when it already exists", async () => {
    (mockGroupFileExists as any).mockResolvedValue(true);

    await expect(ensureMainGroupReadme({} as any)).resolves.toBe(true);

    expect(mockWriteGroupFile).not.toHaveBeenCalled();
  });

  it("migrates legacy root README.md content into MEMORY.md", async () => {
    (mockGroupFileExists as any)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    (mockReadGroupFile as any).mockResolvedValue("# Legacy README\n");

    await expect(ensureMainGroupReadme({} as any)).resolves.toBe(true);

    expect(mockReadGroupFile).toHaveBeenCalledWith(
      {} as any,
      DEFAULT_GROUP_ID,
      LEGACY_MAIN_GROUP_README_PATH_ROOT,
    );
    expect(mockWriteGroupFile).toHaveBeenCalledWith(
      {} as any,
      DEFAULT_GROUP_ID,
      DEFAULT_MAIN_GROUP_README_PATH,
      "# Legacy README\n",
    );
  });

  it("uses static main/MEMORY.md template when available", async () => {
    (mockGroupFileExists as any)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false);
    (globalThis as any).fetch = (jest.fn() as any).mockResolvedValue({
      ok: true,
      text: async () => "# Static Template\n",
    });

    await expect(ensureMainGroupReadme({} as any)).resolves.toBe(true);

    const expectedUrl = resolveStaticMainGroupReadmeUrl();
    expect((globalThis as any).fetch).toHaveBeenCalledWith(expectedUrl);
    expect(mockWriteGroupFile).toHaveBeenCalledWith(
      {} as any,
      DEFAULT_GROUP_ID,
      DEFAULT_MAIN_GROUP_README_PATH,
      "# Static Template\n",
    );
  });

  it("resolves static README path against document base URI", () => {
    const base = document.baseURI;
    const expected = new URL(STATIC_MAIN_GROUP_README_PATH, base).toString();

    expect(resolveStaticMainGroupReadmeUrl()).toBe(expected);
  });

  it("skips creating MEMORY.md when suppression is enabled", async () => {
    (mockGroupFileExists as any).mockResolvedValue(false);
    (mockGetConfig as any).mockResolvedValue(true);

    await expect(ensureMainGroupReadme({} as any)).resolves.toBe(false);

    expect(mockWriteGroupFile).not.toHaveBeenCalled();
  });

  it("reads and writes suppression flag through config storage", async () => {
    (mockGetConfig as any).mockResolvedValue("true");

    await expect(isMainGroupReadmeSuppressed({} as any)).resolves.toBe(true);

    await setMainGroupReadmeSuppressed({} as any, true);
    expect(mockSetConfig).toHaveBeenCalledWith(
      {} as any,
      "main_group_readme_suppressed",
      true,
    );
  });
});
