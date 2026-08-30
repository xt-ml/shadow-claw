import { jest } from "@jest/globals";
import { downloadModelToCache } from "./downloadModelToCache.js";

// jsdom does not implement Blob fully, so we mock it for the tests
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
  };
}

describe("downloadModelToCache", () => {
  let mockFetch: jest.Mock<any>;
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
        if (this.body instanceof (global as any).Blob) {
          return this.body.text();
        }
        if (this.body instanceof Uint8Array) {
          return decodeBytes(this.body);
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

  it("downloads model, writes chunks + meta to CacheStorage, and returns stream", async () => {
    const modelData = new Uint8Array([10, 20, 30]);
    mockFetch.mockResolvedValueOnce(makeFetchResponse(200, modelData) as any);

    const onProgress = jest.fn<any>();
    const stream = await downloadModelToCache("http://model", onProgress);

    expect(mockFetch).toHaveBeenCalledTimes(1);

    const reader = stream.getReader();
    const collected: number[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      collected.push(...value);
    }
    expect(collected).toEqual([10, 20, 30]);

    expect(cacheStore.get("http://model?__sc_chunk=0")).toBeDefined();

    const metaRaw = cacheStore.get("http://model?__sc_meta=1");
    expect(metaRaw).toBeDefined();
    const meta = JSON.parse(decodeBytes(metaRaw!.body!));
    expect(meta.complete).toBe(true);
    expect(meta.received).toBe(3);

    expect(onProgress).toHaveBeenCalled();
  });

  it("resumes download from partial meta using HTTP Range header", async () => {
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
    const stream = await downloadModelToCache("http://model", onProgress);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, fetchInit] = mockFetch.mock.calls[0] as any[];
    expect(fetchInit.headers["Range"]).toBe("bytes=4-");

    const reader = stream.getReader();
    const collected: number[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      collected.push(...value);
    }
    expect(collected).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

    const metaRaw = cacheStore.get("http://model?__sc_meta=1");
    const meta = JSON.parse(decodeBytes(metaRaw!.body!));
    expect(meta.complete).toBe(true);
    expect(meta.received).toBe(8);
  });

  it("restarts download from scratch if server returns 200 to Range request", async () => {
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

    const fullData = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]);
    mockFetch.mockResolvedValueOnce(makeFetchResponse(200, fullData) as any);

    const onProgress = jest.fn<any>();
    const stream = await downloadModelToCache("http://model", onProgress);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const reader = stream.getReader();
    const collected: number[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      collected.push(...value);
    }
    expect(collected).toEqual([10, 20, 30, 40, 50, 60, 70, 80]);

    const meta = JSON.parse(
      decodeBytes(cacheStore.get("http://model?__sc_meta=1")!.body!),
    );
    expect(meta.complete).toBe(true);
    expect(meta.received).toBe(8);
  });

  it("retries on 500 status and succeeds on subsequent attempt", async () => {
    const modelData = new Uint8Array([1, 2, 3]);
    mockFetch
      .mockResolvedValueOnce(makeFetchResponse(500) as any)
      .mockResolvedValueOnce(makeFetchResponse(200, modelData) as any);

    const onProgress = jest.fn<any>();
    const stream = await downloadModelToCache("http://model", onProgress);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    const reader = stream.getReader();
    const collected: number[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      collected.push(...value);
    }
    expect(collected).toEqual([1, 2, 3]);

    const meta = JSON.parse(
      decodeBytes(cacheStore.get("http://model?__sc_meta=1")!.body!),
    );
    expect(meta.complete).toBe(true);
  });

  it("throws AbortError when abortSignal is triggered", async () => {
    mockFetch.mockRejectedValue(
      new DOMException("Aborted", "AbortError") as any,
    );
    const abortController = new AbortController();
    abortController.abort();

    await expect(
      downloadModelToCache(
        "http://model",
        jest.fn<any>(),
        abortController.signal,
      ),
    ).rejects.toThrow("Aborted");
  });

  it("gracefully degrades when CacheStorage is unavailable", async () => {
    delete (globalThis as any).caches;
    const modelData = new Uint8Array([1, 2, 3, 4]);
    mockFetch.mockResolvedValueOnce(makeFetchResponse(200, modelData) as any);

    const onProgress = jest.fn<any>();
    const stream = await downloadModelToCache("http://model", onProgress);

    expect(mockFetch).toHaveBeenCalledTimes(1);

    const reader = stream.getReader();
    const collected: number[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      collected.push(...value);
    }
    expect(collected).toEqual([1, 2, 3, 4]);
    expect(onProgress).toHaveBeenCalledWith(4, 4);
  });

  it("uses the injected nativeFetch instead of globalThis.fetch so downloads bypass the Service Worker", async () => {
    // This test captures the Firefox bug: if downloadModelToCache calls
    // globalThis.fetch, requests go through the Service Worker (Workbox
    // NetworkOnly), which wraps the response body and causes
    // "Error in input stream" when the binary stream is read by the consumer.
    const globalFetchSpy = jest.fn<any>();
    global.fetch = globalFetchSpy as any;

    const modelData = new Uint8Array([7, 8, 9]);
    const injectedFetch = jest
      .fn<any>()
      .mockResolvedValueOnce(makeFetchResponse(200, modelData) as any);

    const stream = await downloadModelToCache(
      "http://model",
      undefined,
      undefined,
      undefined,
      injectedFetch as any,
    );

    // The injected fetch must have been called, not the global one.
    expect(injectedFetch).toHaveBeenCalledTimes(1);
    expect(globalFetchSpy).not.toHaveBeenCalled();

    const reader = stream.getReader();
    const collected: number[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      collected.push(...value);
    }
    expect(collected).toEqual([7, 8, 9]);
  });

  it("resumes download directly from resolvedUrl when redirect endpoint is saved", async () => {
    cacheStore.set("https://huggingface.co/model.bin?__sc_meta=1", {
      body: encodeText(
        JSON.stringify({
          chunks: 1,
          received: 4,
          total: 8,
          acceptsRanges: true,
          complete: false,
          resolvedUrl: "https://cdn-lfs.huggingface.co/repos/model.bin",
        }),
      ),
      headers: new Headers({ "content-type": "application/json" }),
    });
    cacheStore.set("https://huggingface.co/model.bin?__sc_chunk=0", {
      body: new Uint8Array([1, 2, 3, 4]),
      headers: new Headers({ "content-length": "4" }),
    });

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
      url: "https://cdn-lfs.huggingface.co/repos/model.bin",
    } as any);

    const onProgress = jest.fn<any>();
    const stream = await downloadModelToCache(
      "https://huggingface.co/model.bin",
      onProgress,
    );

    // Verify request was sent directly to CDN URL with Range header
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://cdn-lfs.huggingface.co/repos/model.bin",
      expect.objectContaining({
        headers: expect.objectContaining({
          Range: "bytes=4-",
        }),
      }),
    );

    const reader = stream.getReader();
    const collected: number[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      collected.push(...value);
    }
    expect(collected).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

    const meta = JSON.parse(
      decodeBytes(
        cacheStore.get("https://huggingface.co/model.bin?__sc_meta=1")!.body!,
      ),
    );
    expect(meta.complete).toBe(true);
    expect(meta.received).toBe(8);
    expect(meta.resolvedUrl).toBe(
      "https://cdn-lfs.huggingface.co/repos/model.bin",
    );
  });
});
