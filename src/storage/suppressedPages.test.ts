import { jest } from "@jest/globals";

const mockGetConfig = jest.fn() as any;
const mockSetConfig = jest.fn() as any;

jest.unstable_mockModule("../db/getConfig.js", () => ({
  getConfig: mockGetConfig,
}));

jest.unstable_mockModule("../db/setConfig.js", () => ({
  setConfig: mockSetConfig,
}));

const { getSuppressedPages, isPageSuppressed, suppressPage, unsuppressPage } =
  await import("./suppressedPages.js");

describe("suppressedPages", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetConfig.mockReset();
    mockSetConfig.mockReset();
  });

  it("returns empty array if suppressed pages config is missing", async () => {
    mockGetConfig.mockResolvedValue(undefined);
    const pages = await getSuppressedPages({} as any);
    expect(pages).toEqual([]);
  });

  it("checks if a page is suppressed", async () => {
    mockGetConfig.mockResolvedValue(
      JSON.stringify([{ groupId: "br:main", path: "deleted.md" }]),
    );

    expect(await isPageSuppressed({} as any, "br:main", "deleted.md")).toBe(
      true,
    );
    expect(await isPageSuppressed({} as any, "br:main", "other.md")).toBe(
      false,
    );
  });

  it("suppresses a page without duplicating", async () => {
    mockGetConfig.mockResolvedValue(
      JSON.stringify([{ groupId: "br:main", path: "deleted.md" }]),
    );
    mockSetConfig.mockResolvedValue(undefined);

    await suppressPage({} as any, "br:main", "deleted.md");
    expect(mockSetConfig).not.toHaveBeenCalled();

    await suppressPage({} as any, "br:main", "newly-removed.md");
    expect(mockSetConfig).toHaveBeenCalledWith(
      {} as any,
      "suppressed_pages_list",
      JSON.stringify([
        { groupId: "br:main", path: "deleted.md" },
        { groupId: "br:main", path: "newly-removed.md" },
      ]),
    );
  });

  it("unsuppresses a page", async () => {
    mockGetConfig.mockResolvedValue(
      JSON.stringify([
        { groupId: "br:main", path: "deleted.md" },
        { groupId: "br:main", path: "kept.md" },
      ]),
    );
    mockSetConfig.mockResolvedValue(undefined);

    await unsuppressPage({} as any, "br:main", "deleted.md");
    expect(mockSetConfig).toHaveBeenCalledWith(
      {} as any,
      "suppressed_pages_list",
      JSON.stringify([{ groupId: "br:main", path: "kept.md" }]),
    );
  });
});
