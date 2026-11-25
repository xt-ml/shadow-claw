import { jest } from "@jest/globals";
import { loadModelStream } from "./load-model-stream.js";

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

  it("reads from granted shared dirHandle without network calls and falls back from failing mirror", async () => {
    const sharedBytes = new Uint8Array([42, 43, 44]);
    const dirHandle = {
      queryPermission: async () => "granted",
      getDirectoryHandle: async () => dirHandle,
      getFileHandle: async () => ({
        getFile: async () => ({
          size: sharedBytes.byteLength,
          arrayBuffer: async () => sharedBytes.buffer,
        }),
      }),
    } as any;

    const onProgress = jest.fn<any>();
    const stream = await loadModelStream(
      "https://huggingface.co/org/repo/resolve/main/file.onnx",
      onProgress,
      undefined,
      {
        sharedConfig: {
          scope: "origin",
          mirrorEnabled: false,
          mirrorUrl: "",
          dirHandle,
        },
      },
    );
    expect(mockFetch).not.toHaveBeenCalled();
    expect(onProgress).toHaveBeenCalledWith(3, 3, true);
    const reader = stream.getReader();
    const out: number[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      out.push(...value);
    }
    expect(out).toEqual([42, 43, 44]);

    mockFetch.mockImplementation(async (target: string) => {
      if (target.startsWith("http://localhost:8888")) {
        return makeFetchResponse(404);
      }
      return makeFetchResponse(200, new Uint8Array([55, 66]));
    });
    const fallbackStream = await loadModelStream(
      "https://huggingface.co/org/repo/resolve/main/other.onnx",
      undefined,
      undefined,
      {
        maxAttempts: 1,
        sharedConfig: {
          scope: "origin",
          mirrorEnabled: true,
          mirrorUrl: "http://localhost:8888/model-cache/hf",
          dirHandle: null,
        },
      },
    );
    const r2 = fallbackStream.getReader();
    const out2: number[] = [];
    while (true) {
      const { done, value } = await r2.read();
      if (done) break;
      out2.push(...value);
    }
    expect(out2).toEqual([55, 66]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("falls back to alternate scope cache and legacy transformers-cache without network calls, and backfills shared dir", async () => {
    const modelUrl =
      "https://huggingface.co/onnx-community/demo/resolve/main/weights.onnx";
    const depBytes = new Uint8Array([7, 8, 9]);
    const legacyBytes = new Uint8Array([1, 3, 5, 7]);
    const writtenFiles = new Map<string, Uint8Array>();

    const makeMockDir = (prefix = ""): any => ({
      kind: "directory",
      name: prefix || "root",
      queryPermission: async () => "granted",
      getDirectoryHandle: async (name: string, opts?: { create?: boolean }) => {
        const key = prefix ? `${prefix}/${name}` : name;
        if (!opts?.create && !writtenFiles.has(key)) {
          // Check if any written file starts with key + "/"
          const hasChild = Array.from(writtenFiles.keys()).some((k) =>
            k.startsWith(`${key}/`),
          );
          if (!hasChild) throw new DOMException("Not found", "NotFoundError");
        }
        return makeMockDir(key);
      },
      getFileHandle: async (name: string, opts?: { create?: boolean }) => {
        const key = prefix ? `${prefix}/${name}` : name;
        if (!opts?.create && !writtenFiles.has(key)) {
          throw new DOMException("Not found", "NotFoundError");
        }
        return {
          getFile: async () => {
            const bytes = writtenFiles.get(key) || new Uint8Array(0);
            return {
              size: bytes.byteLength,
              arrayBuffer: async () => bytes.buffer,
            };
          },
          createWritable: async () => {
            const chunks: Uint8Array[] = [];
            return {
              write: async (chunk: Uint8Array) =>
                chunks.push(new Uint8Array(chunk)),
              close: async () => {
                const len = chunks.reduce((s, c) => s + c.byteLength, 0);
                const merged = new Uint8Array(len);
                let off = 0;
                for (const c of chunks) {
                  merged.set(c, off);
                  off += c.byteLength;
                }
                writtenFiles.set(key, merged);
              },
            };
          },
        };
      },
    });

    (globalThis as any).__SHADOWCLAW_DEPLOY_ID__ = "app-one";

    const buckets = new Map<
      string,
      Map<string, { body: Uint8Array; headers: Headers }>
    >([
      [
        "shadow-claw-browser-models-app-one",
        new Map([
          [
            `${modelUrl}?__sc_meta=1`,
            {
              body: encodeText(
                JSON.stringify({
                  chunks: 1,
                  received: depBytes.byteLength,
                  total: depBytes.byteLength,
                  acceptsRanges: true,
                  complete: true,
                }),
              ),
              headers: new Headers({ "content-type": "application/json" }),
            },
          ],
          [
            `${modelUrl}?__sc_chunk=0`,
            {
              body: depBytes,
              headers: new Headers({
                "content-length": String(depBytes.byteLength),
              }),
            },
          ],
        ]),
      ],
      [
        "transformers-cache",
        new Map([
          [
            "https://huggingface.co/onnx-community/legacy/resolve/main/config.json",
            {
              body: legacyBytes,
              headers: new Headers({
                "content-length": String(legacyBytes.byteLength),
              }),
            },
          ],
        ]),
      ],
    ]);

    global.caches = {
      open: jest.fn<any>(async (name: string) => {
        if (!buckets.has(name)) buckets.set(name, new Map());
        const map = buckets.get(name)!;
        return {
          match: jest.fn<any>(async (key: string) => {
            const entry = map.get(String(key));
            if (!entry) return undefined;
            return {
              headers: entry.headers,
              body: makeBodyStream(entry.body),
              text: async () => decodeBytes(entry.body),
            };
          }),
        };
      }),
    } as any;

    try {
      const dirHandle = makeMockDir();
      const s1 = await loadModelStream(modelUrl, undefined, undefined, {
        sharedConfig: {
          scope: "origin",
          mirrorEnabled: false,
          mirrorUrl: "",
          dirHandle,
        },
      });
      expect(mockFetch).not.toHaveBeenCalled();

      const r1 = s1.getReader();
      const out1: number[] = [];
      while (true) {
        const { done, value } = await r1.read();
        if (done) break;
        out1.push(...value);
      }
      expect(out1).toEqual([7, 8, 9]);

      // Allow background backfill microtask/stream write to finish
      await new Promise((r) => setTimeout(r, 30));
      expect(
        writtenFiles.get("hf/onnx-community/demo/resolve/main/weights.onnx"),
      ).toEqual(depBytes);

      const s2 = await loadModelStream(
        "https://huggingface.co/onnx-community/legacy/resolve/main/config.json",
        undefined,
        undefined,
        {
          sharedConfig: {
            scope: "origin",
            mirrorEnabled: false,
            mirrorUrl: "",
            dirHandle: null,
          },
        },
      );
      expect(mockFetch).not.toHaveBeenCalled();
      const r2 = s2.getReader();
      const out2: number[] = [];
      while (true) {
        const { done, value } = await r2.read();
        if (done) break;
        out2.push(...value);
      }
      expect(out2).toEqual([1, 3, 5, 7]);
    } finally {
      delete (globalThis as any).__SHADOWCLAW_DEPLOY_ID__;
    }
  });
});
