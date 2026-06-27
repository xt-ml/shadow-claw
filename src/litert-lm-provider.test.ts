import { jest } from "@jest/globals";

import {
  isLiteRtLmSupported,
  loadLiteRtModelStream,
} from "./litert-lm-provider.js";

// jsdom does not implement Blob fully, so we mock it for the tests
if (typeof global !== "undefined") {
  (global as any).Blob = class MockBlob {
    private parts: any[];
    public size: number;
    constructor(parts: any[]) {
      this.parts = parts || [];
      this.size = this.parts.reduce(
        (acc, p) => acc + (p.byteLength || p.length || 0),
        0,
      );
    }

    async arrayBuffer() {
      const combined = new Uint8Array(this.size);
      let offset = 0;
      for (const p of this.parts) {
        if (p instanceof Uint8Array) {
          combined.set(p, offset);
          offset += p.byteLength;
        }
      }

      return combined.buffer;
    }

    async text() {
      const ab = await this.arrayBuffer();

      return decodeBytes(new Uint8Array(ab));
    }

    stream() {
      let resolved = false;
      let bytes: Uint8Array | null = null;
      const blobPromise = this.arrayBuffer().then((ab) => {
        bytes = new Uint8Array(ab);
        resolved = true;
      });

      return new ReadableStream<Uint8Array>({
        async start(controller) {
          if (!resolved) {
            await blobPromise;
          }

          if (bytes && bytes.byteLength > 0) {
            controller.enqueue(bytes!);
          }

          controller.close();
        },
      });
    }
  };
}

// TextEncoder / TextDecoder are not available in every Jest environment;
// fall back to Node's Buffer.
function encodeText(s: string): Uint8Array {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(s);
  }

  return new Uint8Array(Buffer.from(s, "utf8"));
}

function decodeBytes(b: Uint8Array): string {
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder().decode(b);
  }

  return Buffer.from(b).toString("utf8");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBodyStream(data: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
}

function makeFetchResponse(
  status: number,
  data?: Uint8Array,
  extraHeaders: Record<string, string> = {},
) {
  const headers: Record<string, string> = {
    ...(data ? { "content-length": String(data.byteLength) } : {}),
    ...extraHeaders,
  };

  return {
    status,
    statusText:
      status === 200 ? "OK" : status === 206 ? "Partial Content" : "Error",
    headers: new Headers(headers),
    body: data ? makeBodyStream(data) : null,
  };
}

// ---------------------------------------------------------------------------
// isLiteRtLmSupported
// ---------------------------------------------------------------------------

describe("LiteRT-LM Provider", () => {
  describe("isLiteRtLmSupported", () => {
    let originalNavigator: any;

    let originalWebAssembly: any;

    beforeEach(() => {
      originalNavigator = global.navigator;
      originalWebAssembly = global.WebAssembly;
    });

    afterEach(() => {
      if (originalNavigator !== undefined) {
        Object.defineProperty(global, "navigator", {
          value: originalNavigator,
          configurable: true,
          writable: true,
        });
      } else {
        delete (global as any).navigator;
      }

      if (originalWebAssembly !== undefined) {
        Object.defineProperty(global, "WebAssembly", {
          value: originalWebAssembly,
          configurable: true,
          writable: true,
        });
      } else {
        delete (global as any).WebAssembly;
      }
    });

    it("returns true if navigator.gpu and WebAssembly.Suspending exist", () => {
      Object.defineProperty(global, "navigator", {
        value: { gpu: {} },
        configurable: true,
        writable: true,
      });
      Object.defineProperty(global, "WebAssembly", {
        value: { Suspending: class {} },
        configurable: true,
        writable: true,
      });
      expect(isLiteRtLmSupported()).toBe(true);
    });

    it("returns false if navigator.gpu does not exist", () => {
      Object.defineProperty(global, "navigator", {
        value: {},
        configurable: true,
        writable: true,
      });
      Object.defineProperty(global, "WebAssembly", {
        value: { Suspending: class {} },
        configurable: true,
        writable: true,
      });
      expect(isLiteRtLmSupported()).toBe(false);
    });

    it("returns false if WebAssembly.Suspending does not exist", () => {
      Object.defineProperty(global, "navigator", {
        value: { gpu: {} },
        configurable: true,
        writable: true,
      });
      Object.defineProperty(global, "WebAssembly", {
        value: {},
        configurable: true,
        writable: true,
      });
      expect(isLiteRtLmSupported()).toBe(false);
    });

    it("returns false if navigator is undefined", () => {
      delete (global as any).navigator;
      Object.defineProperty(global, "WebAssembly", {
        value: { Suspending: class {} },
        configurable: true,
        writable: true,
      });
      expect(isLiteRtLmSupported()).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // loadLiteRtModelStream — full integration of cache + network
  // ---------------------------------------------------------------------------

  describe("loadLiteRtModelStream", () => {
    let mockFetch: jest.Mock<any>;
    // cache storage: key -> { body: Uint8Array | null, headers: Headers }
    const cacheStore = new Map<
      string,
      { body: Uint8Array | null; headers: Headers }
    >();
    let originalResponse: any;

    function resetCache() {
      cacheStore.clear();
    }

    function makeCacheApi() {
      // A single cache object backed by `cacheStore`; shared across all
      // `caches.open()` calls so that writes from one call site are visible
      // to reads from another.
      const cacheObject = {
        put: jest.fn<any>(async (key: string, response: any) => {
          const headers = response.init
            ? new Headers(response.init.headers ?? {})
            : new Headers();
          let body: Uint8Array | null = null;
          if (typeof response.body === "string") {
            body = encodeText(response.body);
          } else if (response.body instanceof Uint8Array) {
            body = response.body;
          } else if (response.body instanceof Blob) {
            body = new Uint8Array(await response.body.arrayBuffer());
          }

          cacheStore.set(String(key), { body, headers });
        }),
        match: jest.fn<any>(async (key: string) => {
          const entry = cacheStore.get(String(key));
          if (!entry) {
            return undefined;
          }

          const bytes = entry.body;
          const stream = bytes
            ? makeBodyStream(bytes)
            : new ReadableStream({ start: (c) => c.close() });

          return {
            headers: entry.headers,
            body: stream,
            text: async () => (bytes ? decodeBytes(bytes) : ""),
          };
        }),
        delete: jest.fn<any>(async (key: string) => {
          cacheStore.delete(String(key));
        }),
      };
      const cacheOpen = jest.fn<any>().mockResolvedValue(cacheObject);

      return { open: cacheOpen };
    }

    beforeEach(() => {
      resetCache();
      mockFetch = jest.fn<any>();
      global.fetch = mockFetch as any;

      originalResponse = global.Response;
      (global as any).Response = class ResponseMock {
        body: any;
        init: any;
        constructor(body: any, init: any) {
          this.body = body;
          this.init = init;
        }

        async text(): Promise<string> {
          if (typeof this.body === "string") {
            return this.body;
          }

          if (this.body instanceof Blob) {
            return this.body.text();
          }

          if (this.body instanceof Uint8Array) {
            return new TextDecoder().decode(this.body);
          }

          return String(this.body ?? "");
        }
      };

      global.caches = makeCacheApi() as any;
    });

    afterEach(() => {
      jest.restoreAllMocks();
      if (originalResponse !== undefined) {
        global.Response = originalResponse;
      } else {
        delete (global as any).Response;
      }
    });

    // -- Complete meta hit (after a previous successful download) ---------------

    it("returns stream from cached chunks when meta is complete (no network)", async () => {
      const chunk0 = new Uint8Array([1, 2, 3, 4]);
      // Populate the cache as if a previous download completed
      cacheStore.set("http://model?__sc_meta=1", {
        body: encodeText(
          JSON.stringify({
            chunks: 1,
            received: 4,
            total: 4,
            acceptsRanges: true,
            complete: true,
          }),
        ),
        headers: new Headers({ "content-type": "application/json" }),
      });
      cacheStore.set("http://model?__sc_chunk=0", {
        body: chunk0,
        headers: new Headers({ "content-length": "4" }),
      });

      const onProgress = jest.fn<any>();
      const stream = await loadLiteRtModelStream("http://model", onProgress);

      // Should read from cache — no network calls
      expect(mockFetch).not.toHaveBeenCalled();
      expect(onProgress).toHaveBeenCalledWith(4, 4, true);

      // Stream should yield the cached bytes
      const reader = stream.getReader();
      const collected: number[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        collected.push(...value);
      }

      expect(collected).toEqual([1, 2, 3, 4]);
    });

    // -- Fresh download (no meta) -----------------------------------------------

    it("downloads model and writes chunks + meta to CacheStorage", async () => {
      // 3 bytes fits in a single chunk (way below 16MB flush threshold)
      const modelData = new Uint8Array([10, 20, 30]);
      mockFetch.mockResolvedValueOnce(makeFetchResponse(200, modelData) as any);

      const onProgress = jest.fn<any>();
      await loadLiteRtModelStream("http://model", onProgress);

      expect(mockFetch).toHaveBeenCalledTimes(1);

      // At least one chunk entry should have been written
      const chunkEntry = cacheStore.get("http://model?__sc_chunk=0");
      expect(chunkEntry).toBeDefined();

      // Meta should exist and be marked complete
      const metaRaw = cacheStore.get("http://model?__sc_meta=1");
      expect(metaRaw).toBeDefined();
      const meta = JSON.parse(decodeBytes(metaRaw!.body!));
      expect(meta.complete).toBe(true);
      expect(meta.received).toBe(3);

      // Progress callback should have fired
      expect(onProgress).toHaveBeenCalled();
    });

    // -- Resume after crash -----------------------------------------------------

    it("resumes download from partial meta offset after crash", async () => {
      // Partial state: 4 bytes already cached in chunk 0, 4 more bytes remain
      const partialBytes = new Uint8Array([1, 2, 3, 4]);
      cacheStore.set("http://model?__sc_meta=1", {
        body: encodeText(
          JSON.stringify({
            chunks: 1,
            received: 4,
            total: 8,
            acceptsRanges: true,
            complete: false,
          }),
        ),
        headers: new Headers({ "content-type": "application/json" }),
      });
      cacheStore.set("http://model?__sc_chunk=0", {
        body: partialBytes,
        headers: new Headers({ "content-length": "4" }),
      });

      // Server returns the remaining 4 bytes via 206
      const remaining = new Uint8Array([5, 6, 7, 8]);
      mockFetch.mockResolvedValueOnce({
        status: 206,
        statusText: "Partial Content",
        headers: new Headers({
          "content-range": "bytes 4-7/8",
          "content-length": "4",
          "accept-ranges": "bytes",
        }),
        body: makeBodyStream(remaining),
      } as any);

      const onProgress = jest.fn<any>();
      await loadLiteRtModelStream("http://model", onProgress);

      // Must have issued a Range request
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [, fetchInit] = mockFetch.mock.calls[0] as any[];
      expect(fetchInit.headers["Range"]).toBe("bytes=4-");

      // Meta should now be complete
      const metaRaw = cacheStore.get("http://model?__sc_meta=1");
      const meta = JSON.parse(decodeBytes(metaRaw!.body!));
      expect(meta.complete).toBe(true);
      expect(meta.received).toBe(8);
    });

    // -- Resume when server ignores Range (returns 200) -------------------------

    it("restarts from scratch when server ignores Range request (200 instead of 206)", async () => {
      // Partial state exists in cache
      cacheStore.set("http://model?__sc_meta=1", {
        body: encodeText(
          JSON.stringify({
            chunks: 1,
            received: 4,
            total: 8,
            acceptsRanges: true,
            complete: false,
          }),
        ),
        headers: new Headers({ "content-type": "application/json" }),
      });
      cacheStore.set("http://model?__sc_chunk=0", {
        body: new Uint8Array([1, 2, 3, 4]),
        headers: new Headers({ "content-length": "4" }),
      });

      // Server returns 200 (ignores Range) with full data
      const fullData = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]);
      mockFetch.mockResolvedValueOnce(makeFetchResponse(200, fullData) as any);

      const onProgress = jest.fn<any>();
      await loadLiteRtModelStream("http://model", onProgress);

      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Final meta should reflect the full 8 bytes, not 4+4
      const metaRaw = cacheStore.get("http://model?__sc_meta=1");
      const meta = JSON.parse(decodeBytes(metaRaw!.body!));
      expect(meta.complete).toBe(true);
      expect(meta.received).toBe(8);
    });

    // -- Retry on 500 -----------------------------------------------------------

    it("retries on 500 error", async () => {
      const modelData = new Uint8Array([1, 2, 3]);
      mockFetch
        .mockResolvedValueOnce(makeFetchResponse(500) as any)
        .mockResolvedValueOnce(makeFetchResponse(200, modelData) as any);

      const onProgress = jest.fn<any>();
      await loadLiteRtModelStream("http://model", onProgress);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const meta = JSON.parse(
        decodeBytes(cacheStore.get("http://model?__sc_meta=1")!.body!),
      );
      expect(meta.complete).toBe(true);
    });

    // -- Abort ------------------------------------------------------------------

    it("aborts download if signal is aborted", async () => {
      mockFetch.mockRejectedValue(
        new DOMException("Aborted", "AbortError") as any,
      );

      const abortController = new AbortController();
      abortController.abort();

      await expect(
        loadLiteRtModelStream(
          "http://model",
          jest.fn<any>(),
          abortController.signal,
        ),
      ).rejects.toThrow("Aborted");
    });
  });
});
