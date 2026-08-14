import { jest } from "@jest/globals";
import { flushChunkToCache } from "./flushChunkToCache.js";
import { DEFAULT_MODEL_CACHE_NAME } from "./types.js";

// Mock Blob and Response for Jest/jsdom if needed
if (typeof (globalThis as any).Blob === "undefined") {
  (globalThis as any).Blob = class MockBlob {
    parts: any[];
    size: number;
    constructor(parts: any[]) {
      this.parts = parts || [];
      this.size = this.parts.reduce(
        (acc, p) => acc + (p.byteLength || p.length || 0),
        0,
      );
    }
  };
}

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
  };
}

describe("flushChunkToCache", () => {
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
    const bytes = new Uint8Array([1, 2, 3]);
    await expect(
      flushChunkToCache("https://example.com/model.bin", 0, bytes),
    ).resolves.toBeUndefined();
  });

  it("writes chunk to CacheStorage with correct chunk key and headers", async () => {
    const bytes = new Uint8Array([10, 20, 30, 40]);
    await flushChunkToCache(
      "https://example.com/model.bin",
      3,
      bytes,
      "custom-cache",
    );

    expect(mockOpen).toHaveBeenCalledWith("custom-cache");
    expect(mockPut).toHaveBeenCalledTimes(1);
    const [key, response] = mockPut.mock.calls[0] as [string, Response];
    expect(key).toBe("https://example.com/model.bin?__sc_chunk=3");
    expect(response.headers.get("Content-Type")).toBe(
      "application/octet-stream",
    );
    expect(response.headers.get("Content-Length")).toBe("4");
  });

  it("uses default cache name when not specified", async () => {
    const bytes = new Uint8Array([1, 2]);
    await flushChunkToCache("https://example.com/model.bin", 0, bytes);
    expect(mockOpen).toHaveBeenCalledWith(DEFAULT_MODEL_CACHE_NAME);
  });

  it("catches and logs errors gracefully when cache.put fails (graceful degradation)", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockPut.mockRejectedValue(new Error("Disk write error"));

    const bytes = new Uint8Array([1, 2, 3]);
    await expect(
      flushChunkToCache("https://example.com/model.bin", 0, bytes),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
