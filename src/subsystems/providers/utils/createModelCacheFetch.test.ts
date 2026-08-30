import { jest } from "@jest/globals";
import { createModelCacheFetch } from "./createModelCacheFetch.js";

// Mock Blob and Response for Jest/jsdom
if (typeof globalThis !== "undefined") {
  (globalThis as any).Blob = class MockBlob {
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
  };
}

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
    text: async () => (data ? decodeBytes(data) : ""),
  };
}

describe("createModelCacheFetch", () => {
  let mockNativeFetch: jest.Mock<any>;
  const cacheStore = new Map<
    string,
    { body: Uint8Array | null; headers: Headers }
  >();
  let originalResponse: any;

  function resetCache() {
    cacheStore.clear();
  }

  function makeCacheApi() {
    const cacheObject = {
      put: jest.fn<any>(async (key: string, response: any) => {
        const headers = response.init
          ? new Headers(response.init.headers ?? {})
          : new Headers(response.headers ?? {});
        let body: Uint8Array | null = null;
        if (typeof response.body === "string") {
          body = encodeText(response.body);
        } else if (response.body instanceof Uint8Array) {
          body = response.body;
        } else if (response.body instanceof (global as any).Blob) {
          body = new Uint8Array(await response.body.arrayBuffer());
        }
        cacheStore.set(String(key), { body, headers });
      }),
      match: jest.fn<any>(async (key: string) => {
        const entry = cacheStore.get(String(key));
        if (!entry) return undefined;
        const bytes = entry.body;
        return {
          headers: entry.headers,
          body: bytes
            ? makeBodyStream(bytes)
            : new ReadableStream({ start: (c) => c.close() }),
          text: async () => (bytes ? decodeBytes(bytes) : ""),
        };
      }),
      delete: jest.fn<any>(async (key: string) => {
        cacheStore.delete(String(key));
      }),
    };
    return {
      open: jest.fn<any>().mockResolvedValue(cacheObject),
    };
  }

  beforeEach(() => {
    resetCache();
    mockNativeFetch = jest.fn<any>();
    global.fetch = mockNativeFetch as any;

    originalResponse = global.Response;
    (global as any).Response = class ResponseMock {
      body: any;
      init: any;
      headers: Headers;
      status: number;
      ok: boolean;
      constructor(body: any, init: any) {
        this.body = body;
        this.init = init;
        this.status = init?.status ?? 200;
        this.ok = this.status >= 200 && this.status < 300;
        this.headers = new Headers(init?.headers ?? {});
      }
      async text(): Promise<string> {
        if (typeof this.body === "string") return this.body;
        if (this.body instanceof (global as any).Blob) return this.body.text();
        if (this.body instanceof Uint8Array) return decodeBytes(this.body);
        if (this.body && typeof this.body.getReader === "function") {
          const reader = this.body.getReader();
          const chunks: Uint8Array[] = [];
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
          }
          const totalLen = chunks.reduce((acc, c) => acc + c.byteLength, 0);
          const merged = new Uint8Array(totalLen);
          let off = 0;
          for (const c of chunks) {
            merged.set(c, off);
            off += c.byteLength;
          }
          return decodeBytes(merged);
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

  it("passes Range requests directly to native fetch with cache: no-store", async () => {
    const cachedFetch = createModelCacheFetch(mockNativeFetch);
    mockNativeFetch.mockResolvedValueOnce({ ok: true, status: 206 });

    const resp = await cachedFetch("https://huggingface.co/model/config.json", {
      headers: { Range: "bytes=0-0" },
    });

    expect(mockNativeFetch).toHaveBeenCalledWith(
      "https://huggingface.co/model/config.json",
      expect.objectContaining({
        headers: { Range: "bytes=0-0" },
        cache: "no-store",
      }),
    );
    expect(resp.status).toBe(206);
  });

  it("serves cached model files from CacheStorage without calling native fetch", async () => {
    const content = '{"model_type": "gemma"}';
    cacheStore.set("https://huggingface.co/model/config.json?__sc_meta=1", {
      body: encodeText(
        JSON.stringify({
          chunks: 1,
          received: content.length,
          total: content.length,
          acceptsRanges: true,
          complete: true,
        }),
      ),
      headers: new Headers({ "content-type": "application/json" }),
    });
    cacheStore.set("https://huggingface.co/model/config.json?__sc_chunk=0", {
      body: encodeText(content),
      headers: new Headers({ "content-length": String(content.length) }),
    });

    const cachedFetch = createModelCacheFetch(mockNativeFetch);
    const resp = await cachedFetch("https://huggingface.co/model/config.json");

    expect(mockNativeFetch).not.toHaveBeenCalled();
    const text = await resp.text();
    expect(text).toBe(content);
  });

  it("downloads and caches file if not present in cache", async () => {
    const content = '{"model_type": "gemma"}';
    mockNativeFetch.mockResolvedValueOnce(
      makeFetchResponse(200, encodeText(content), {
        "content-type": "application/json",
      }) as any,
    );

    const cachedFetch = createModelCacheFetch(mockNativeFetch);
    const resp = await cachedFetch("https://huggingface.co/model/config.json");

    expect(mockNativeFetch).toHaveBeenCalledTimes(1);
    expect(resp.headers.get("content-length")).toBe(String(content.length));
    const text = await resp.text();
    expect(text).toBe(content);

    // Verify cache has been populated
    expect(
      cacheStore.get("https://huggingface.co/model/config.json?__sc_chunk=0"),
    ).toBeDefined();
  });

  it("passes non-GET requests directly to native fetch", async () => {
    const cachedFetch = createModelCacheFetch(mockNativeFetch);
    mockNativeFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    await cachedFetch("https://huggingface.co/model/api", { method: "POST" });
    expect(mockNativeFetch).toHaveBeenCalledWith(
      "https://huggingface.co/model/api",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("invokes progressCallback and setModelCacheProgressHook during streaming downloads and cache hits", async () => {
    const { setModelCacheProgressHook, clearModelCacheProgressHook } =
      await import("./createModelCacheFetch.js");

    const instanceProgress = jest.fn();
    const globalProgress = jest.fn();
    setModelCacheProgressHook(globalProgress);

    try {
      const content = "model-chunk-data-12345";
      mockNativeFetch.mockResolvedValueOnce(
        makeFetchResponse(200, encodeText(content), {
          "content-type": "application/octet-stream",
        }) as any,
      );

      const cachedFetch = createModelCacheFetch(
        mockNativeFetch,
        undefined,
        instanceProgress,
      );
      const resp = await cachedFetch(
        "https://huggingface.co/model/weights.bin",
      );
      await resp.text();

      expect(instanceProgress).toHaveBeenCalledWith(
        "https://huggingface.co/model/weights.bin",
        content.length,
        content.length,
        true,
      );
      expect(globalProgress).toHaveBeenCalledWith(
        "https://huggingface.co/model/weights.bin",
        content.length,
        content.length,
        true,
      );
    } finally {
      clearModelCacheProgressHook();
    }
  });
});
