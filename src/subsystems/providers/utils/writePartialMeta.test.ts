import { jest } from "@jest/globals";
import { writePartialMeta } from "./writePartialMeta.js";
import { DEFAULT_MODEL_CACHE_NAME, ModelPartialMeta } from "./types.js";

// Mock Response for Jest/jsdom environment if needed
if (typeof (globalThis as any).Response === "undefined") {
  (globalThis as any).Response = class MockResponse {
    body: any;
    init: any;
    headers: Headers;
    constructor(body: any, init?: any) {
      this.body = body;
      this.init = init;
      this.headers = new Headers(init?.headers ?? {});
    }
    async text() {
      return typeof this.body === "string"
        ? this.body
        : String(this.body ?? "");
    }
  };
}

describe("writePartialMeta", () => {
  let originalCaches: any;
  let mockPut: jest.Mock<any>;
  let mockOpen: jest.Mock<any>;

  beforeEach(() => {
    originalCaches = (globalThis as any).caches;
    mockPut = jest.fn<any>().mockResolvedValue(undefined);
    mockOpen = jest.fn<any>().mockResolvedValue({
      put: mockPut,
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

  it("does nothing if cache storage is not available", async () => {
    delete (globalThis as any).caches;
    const meta: ModelPartialMeta = {
      chunks: 1,
      received: 100,
      total: 100,
      acceptsRanges: true,
      complete: true,
    };
    await expect(
      writePartialMeta("https://example.com/model.bin", meta),
    ).resolves.toBeUndefined();
  });

  it("writes JSON Response to CacheStorage with correct cache key and content type", async () => {
    const meta: ModelPartialMeta = {
      chunks: 2,
      received: 200,
      total: 500,
      acceptsRanges: true,
      complete: false,
    };
    await writePartialMeta(
      "https://example.com/model.bin",
      meta,
      "custom-cache",
    );

    expect(mockOpen).toHaveBeenCalledWith("custom-cache");
    expect(mockPut).toHaveBeenCalledTimes(1);
    const [key, response] = mockPut.mock.calls[0] as [string, Response];
    expect(key).toBe("https://example.com/model.bin?__sc_meta=1");
    expect(response.headers.get("Content-Type")).toBe("application/json");

    const text = await response.text();
    expect(JSON.parse(text)).toEqual(meta);
  });

  it("uses default cache name when not specified", async () => {
    const meta: ModelPartialMeta = {
      chunks: 1,
      received: 100,
      total: 100,
      acceptsRanges: false,
      complete: true,
    };
    await writePartialMeta("https://example.com/model.bin", meta);
    expect(mockOpen).toHaveBeenCalledWith(DEFAULT_MODEL_CACHE_NAME);
  });

  it("catches and logs errors gracefully when cache.put fails", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockPut.mockRejectedValue(new Error("Storage quota exceeded"));

    const meta: ModelPartialMeta = {
      chunks: 1,
      received: 100,
      total: 100,
      acceptsRanges: true,
      complete: true,
    };

    await expect(
      writePartialMeta("https://example.com/model.bin", meta),
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
