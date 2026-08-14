import { jest } from "@jest/globals";
import { readPartialMeta } from "./readPartialMeta.js";
import { DEFAULT_MODEL_CACHE_NAME, ModelPartialMeta } from "./types.js";

describe("readPartialMeta", () => {
  let originalCaches: any;
  let mockMatch: jest.Mock<any>;
  let mockOpen: jest.Mock<any>;

  beforeEach(() => {
    originalCaches = (globalThis as any).caches;
    mockMatch = jest.fn<any>();
    mockOpen = jest.fn<any>().mockResolvedValue({
      match: mockMatch,
    });
    (globalThis as any).caches = {
      open: mockOpen,
    };
  });

  afterEach(() => {
    if (originalCaches !== undefined) {
      (globalThis as any).caches = originalCaches;
    } else {
      delete (globalThis as any).caches;
    }
  });

  it("returns null if cache storage is not available", async () => {
    delete (globalThis as any).caches;
    const result = await readPartialMeta("https://example.com/model.bin");
    expect(result).toBeNull();
  });

  it("returns null if cache entry is not found", async () => {
    mockMatch.mockResolvedValue(undefined);
    const result = await readPartialMeta("https://example.com/model.bin");
    expect(result).toBeNull();
    expect(mockOpen).toHaveBeenCalledWith(DEFAULT_MODEL_CACHE_NAME);
    expect(mockMatch).toHaveBeenCalledWith(
      "https://example.com/model.bin?__sc_meta=1",
    );
  });

  it("returns null if cache entry has no body", async () => {
    mockMatch.mockResolvedValue({ body: null, text: async () => "" });
    const result = await readPartialMeta("https://example.com/model.bin");
    expect(result).toBeNull();
  });

  it("returns parsed ModelPartialMeta when entry is valid", async () => {
    const meta: ModelPartialMeta = {
      chunks: 2,
      received: 32 * 1024 * 1024,
      total: 64 * 1024 * 1024,
      acceptsRanges: true,
      complete: false,
    };
    mockMatch.mockResolvedValue({
      body: {},
      text: async () => JSON.stringify(meta),
    });

    const result = await readPartialMeta(
      "https://example.com/model.bin",
      "custom-cache",
    );
    expect(mockOpen).toHaveBeenCalledWith("custom-cache");
    expect(result).toEqual(meta);
  });

  it("handles json parse error gracefully (returns null)", async () => {
    mockMatch.mockResolvedValue({
      body: {},
      text: async () => "{ invalid json",
    });
    const result = await readPartialMeta("https://example.com/model.bin");
    expect(result).toBeNull();
  });

  it("handles cache error gracefully (returns null)", async () => {
    mockOpen.mockRejectedValue(new Error("Disk error"));
    const result = await readPartialMeta("https://example.com/model.bin");
    expect(result).toBeNull();
  });
});
