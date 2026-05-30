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
  ensureMainGroupMemory,
  DEFAULT_MAIN_GROUP_MEMORY_PATH,
  DEFAULT_MAIN_GROUP_MEMORY_CONTENT,
  STATIC_MAIN_GROUP_MEMORY_PATH,
  resolveStaticMainGroupMemoryUrl,
  isMainGroupMemorySuppressed,
  setMainGroupMemorySuppressed,
} = await import("./ensureMainGroupMemory.js");
const { DEFAULT_GROUP_ID } = await import("../config.js");

describe("ensureMainGroupMemory", () => {
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
    (mockGroupFileExists as any).mockResolvedValue(false);
    (mockWriteGroupFile as any).mockResolvedValue(undefined);

    await expect(ensureMainGroupMemory({} as any)).resolves.toBe(true);

    expect(mockWriteGroupFile).toHaveBeenCalledWith(
      {} as any,
      DEFAULT_GROUP_ID,
      DEFAULT_MAIN_GROUP_MEMORY_PATH,
      DEFAULT_MAIN_GROUP_MEMORY_CONTENT,
    );

    // Fallback content must match what static build renders from main/MEMORY.md
    expect(DEFAULT_MAIN_GROUP_MEMORY_CONTENT).toContain(
      "# Welcome to ShadowClaw Pages",
    );
    expect(DEFAULT_MAIN_GROUP_MEMORY_CONTENT).toContain("## Getting Started");
    expect(DEFAULT_MAIN_GROUP_MEMORY_CONTENT).toContain(
      "## What is MEMORY.md?",
    );
    expect(DEFAULT_MAIN_GROUP_MEMORY_CONTENT).not.toContain(
      "## Why This File Exists",
    );
  });

  it("does not overwrite MEMORY.md when it already exists", async () => {
    (mockGroupFileExists as any).mockResolvedValue(true);

    await expect(ensureMainGroupMemory({} as any)).resolves.toBe(true);

    expect(mockWriteGroupFile).not.toHaveBeenCalled();
  });

  it("uses static main/MEMORY.md template when available", async () => {
    (mockGroupFileExists as any).mockResolvedValue(false);
    (globalThis as any).fetch = (jest.fn() as any).mockResolvedValue({
      ok: true,
      text: async () => "# Static Template\n",
    });

    await expect(ensureMainGroupMemory({} as any)).resolves.toBe(true);

    expect(mockWriteGroupFile).toHaveBeenCalledWith(
      {} as any,
      DEFAULT_GROUP_ID,
      DEFAULT_MAIN_GROUP_MEMORY_PATH,
      "# Static Template\n",
    );
  });

  it("resolves the static MEMORY.md URL correctly", () => {
    const expected =
      typeof document !== "undefined" && document.baseURI
        ? new URL(STATIC_MAIN_GROUP_MEMORY_PATH, document.baseURI).toString()
        : `/${STATIC_MAIN_GROUP_MEMORY_PATH}`;
    expect(resolveStaticMainGroupMemoryUrl()).toBe(expected);
  });

  it("returns false if creation fails", async () => {
    (mockGroupFileExists as any).mockResolvedValue(false);
    (mockWriteGroupFile as any).mockRejectedValue(new Error("Disk full"));

    await expect(ensureMainGroupMemory({} as any)).resolves.toBe(false);
  });

  it("checks and sets suppression status", async () => {
    (mockGetConfig as any).mockResolvedValue(true);
    await expect(isMainGroupMemorySuppressed({} as any)).resolves.toBe(true);

    await setMainGroupMemorySuppressed({} as any, true);
    expect(mockSetConfig).toHaveBeenCalledWith(
      {} as any,
      "main_group_readme_suppressed",
      true,
    );
  });
});
