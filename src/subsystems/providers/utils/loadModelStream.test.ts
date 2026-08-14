import { jest } from "@jest/globals";
import { loadModelStream } from "./loadModelStream.js";

// Mock Blob and Response for Jest/jsdom
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

describe("loadModelStream", () => {
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
        if (typeof this.body === "string") return this.body;
        if (this.body instanceof (global as any).Blob) return this.body.text();
        if (this.body instanceof Uint8Array) return decodeBytes(this.body);
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

  it("returns stream from cached chunks when meta is complete without making network calls", async () => {
    const chunk0 = new Uint8Array([1, 2, 3, 4]);
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
    const stream = await loadModelStream("http://model", onProgress);

    expect(mockFetch).not.toHaveBeenCalled();
    expect(onProgress).toHaveBeenCalledWith(4, 4, true);

    const reader = stream.getReader();
    const collected: number[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      collected.push(...value);
    }
    expect(collected).toEqual([1, 2, 3, 4]);
  });

  it("downloads model when not cached", async () => {
    const modelData = new Uint8Array([10, 20, 30]);
    mockFetch.mockResolvedValueOnce(makeFetchResponse(200, modelData) as any);

    const onProgress = jest.fn<any>();
    const stream = await loadModelStream("http://model", onProgress);

    expect(mockFetch).toHaveBeenCalledTimes(1);

    const reader = stream.getReader();
    const collected: number[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      collected.push(...value);
    }
    expect(collected).toEqual([10, 20, 30]);
    expect(onProgress).toHaveBeenCalled();
  });
});
