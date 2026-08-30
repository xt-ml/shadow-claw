import { jest } from "@jest/globals";

const mockCreateConversation = jest.fn<any>().mockResolvedValue({
  sendMessage: jest.fn<any>().mockResolvedValue(undefined),
  sendMessageStreaming: jest.fn<any>().mockImplementation(async function* () {
    yield {
      content: [
        {
          text: JSON.stringify({
            type: "response",
            response: "Hello from LiteRT!",
          }),
        },
      ],
    };
  }),
});

jest.unstable_mockModule("@litert-lm/core", () => ({
  Engine: {
    create: jest.fn<any>().mockResolvedValue({
      createConversation: mockCreateConversation,
      delete: jest.fn<any>().mockResolvedValue(undefined),
    }),
  },
}));

const {
  isLiteRtLmSupported,
  loadLiteRtModelStream,
  parseModelSpecificToolCall,
  parseLiteRtStructured,
  invokeWithLiteRtLm,
} = await import("./litert-lm-provider.js");

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

  describe("loadLiteRtModelStream", () => {
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

    it("returns stream from cached chunks when meta is complete (no network)", async () => {
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
      const stream = await loadLiteRtModelStream("http://model", onProgress);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(onProgress).toHaveBeenCalledWith(4, 4, true);

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

    it("downloads model and writes chunks + meta to CacheStorage", async () => {
      const modelData = new Uint8Array([10, 20, 30]);
      mockFetch.mockResolvedValueOnce(makeFetchResponse(200, modelData) as any);

      const onProgress = jest.fn<any>();
      const stream = await loadLiteRtModelStream("http://model", onProgress);

      expect(mockFetch).toHaveBeenCalledTimes(1);

      const reader = stream.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      const chunkEntry = cacheStore.get("http://model?__sc_chunk=0");
      expect(chunkEntry).toBeDefined();

      const metaRaw = cacheStore.get("http://model?__sc_meta=1");
      expect(metaRaw).toBeDefined();
      const meta = JSON.parse(decodeBytes(metaRaw!.body!));
      expect(meta.complete).toBe(true);
      expect(meta.received).toBe(3);

      expect(onProgress).toHaveBeenCalled();
    });

    it("resumes download from partial meta offset after crash", async () => {
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
      const stream = await loadLiteRtModelStream("http://model", onProgress);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [, fetchInit] = mockFetch.mock.calls[0] as any[];
      expect(fetchInit.headers["Range"]).toBe("bytes=4-");

      const reader = stream.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      const metaRaw = cacheStore.get("http://model?__sc_meta=1");
      const meta = JSON.parse(decodeBytes(metaRaw!.body!));
      expect(meta.complete).toBe(true);
      expect(meta.received).toBe(8);
    });

    it("restarts from scratch when server ignores Range request (200 instead of 206)", async () => {
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
      const stream = await loadLiteRtModelStream("http://model", onProgress);

      expect(mockFetch).toHaveBeenCalledTimes(1);

      const reader = stream.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      const metaRaw = cacheStore.get("http://model?__sc_meta=1");
      const meta = JSON.parse(decodeBytes(metaRaw!.body!));
      expect(meta.complete).toBe(true);
      expect(meta.received).toBe(8);
    });

    it("retries on 500 error", async () => {
      const modelData = new Uint8Array([1, 2, 3]);
      mockFetch
        .mockResolvedValueOnce(makeFetchResponse(500) as any)
        .mockResolvedValueOnce(makeFetchResponse(200, modelData) as any);

      const onProgress = jest.fn<any>();
      const stream = await loadLiteRtModelStream("http://model", onProgress);

      expect(mockFetch).toHaveBeenCalledTimes(2);

      const reader = stream.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      const meta = JSON.parse(
        decodeBytes(cacheStore.get("http://model?__sc_meta=1")!.body!),
      );
      expect(meta.complete).toBe(true);
    });

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

  describe("invokeWithLiteRtLm", () => {
    it("emits error when LiteRT is unsupported in current environment", async () => {
      const emit: any = jest.fn();
      await invokeWithLiteRtLm(
        {} as any,
        "g1",
        "system",
        [{ role: "user", content: "hello" }],
        1000,
        emit,
        undefined,
        "litert-community/gemma-4-E2B-it-litert-lm",
      );

      expect(emit).toHaveBeenCalledWith({
        type: "response",
        payload: {
          groupId: "g1",
          text: expect.stringContaining(
            "LiteRT-LM requires WebGPU and WebAssembly.Suspending",
          ),
        },
      });
    });

    it("handles model failure when supported but initialization fails", async () => {
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

      const emitted: any[] = [];
      const emit = jest.fn((msg: any) => {
        emitted.push(msg);
      });

      // Pass an unsupported model ID
      await invokeWithLiteRtLm(
        {} as any,
        "g1",
        "system",
        [{ role: "user", content: "hello" }],
        1000,
        emit,
        undefined,
        "unsupported-model-id",
      );

      expect(
        emitted.some(
          (m) =>
            m.type === "model-download-progress" &&
            m.payload.status === "error",
        ),
      ).toBe(true);
      expect(
        emitted.some(
          (m) =>
            m.type === "response" &&
            m.payload.text.includes("LiteRT-LM failed to initialize"),
        ),
      ).toBe(true);
    });

    it("handles aborted signal gracefully during model download", async () => {
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

      const abortController = new AbortController();
      abortController.abort();

      const emitted: any[] = [];
      const emit = jest.fn((msg: any) => {
        emitted.push(msg);
      });

      await invokeWithLiteRtLm(
        {} as any,
        "g1",
        "system",
        [{ role: "user", content: "hello" }],
        1000,
        emit,
        abortController.signal,
        "litert-community/gemma-4-E2B-it-litert-lm",
      );

      expect(
        emitted.some(
          (m) =>
            m.type === "model-download-progress" &&
            m.payload.status === "error",
        ),
      ).toBe(true);
    });

    it("emits warning response when LiteRT-LM is not supported in browser", async () => {
      Object.defineProperty(global, "navigator", {
        value: {},
        configurable: true,
        writable: true,
      });

      const emitted: any[] = [];
      const emit = jest.fn((msg: any) => {
        emitted.push(msg);
      });

      await invokeWithLiteRtLm(
        {} as any,
        "g1",
        "system",
        [{ role: "user", content: "hello" }],
        1000,
        emit,
        undefined,
        "litert-community/gemma-4-E2B-it-litert-lm",
      );

      expect(
        emitted.some(
          (m) =>
            m.type === "response" &&
            m.payload.text.includes("LiteRT-LM requires WebGPU"),
        ),
      ).toBe(true);
    });

    it("successfully creates conversation and streams response when supported", async () => {
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

      global.fetch = jest.fn<any>().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-length": "100" }),
        body: makeBodyStream(new Uint8Array(100)),
      });

      const emitted: any[] = [];
      const emit = jest.fn((msg: any) => {
        emitted.push(msg);
      });

      await invokeWithLiteRtLm(
        {} as any,
        "g1",
        "system",
        [{ role: "user", content: "hello" }],
        1000,
        emit,
        undefined,
        "litert-community/gemma-4-E2B-it-litert-lm",
      );

      expect(emitted.some((m) => m.type === "streaming-chunk")).toBe(true);
      expect(emitted.some((m) => m.type === "streaming-done")).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// parseModelSpecificToolCall
// ---------------------------------------------------------------------------

describe("parseModelSpecificToolCall", () => {
  it("parses a Gemma 4 native tool call with a JSON-like arg block", () => {
    const raw =
      '<|tool_call>call:web_search{queries:["blueberries latest"]}<tool_call|>';
    const result = parseModelSpecificToolCall(raw);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("web_search");
    expect(result!.input.queries[0]).toBe("blueberries latest");
  });

  it('parses a Gemma 4 native tool call with encoded quote tokens <|"|">', () => {
    const rawInline =
      '<|tool_call>call:web_search{queries:[<|"|>Blueberries latest details<|"|>]}<tool_call|>';
    const resultInline = parseModelSpecificToolCall(rawInline);
    expect(resultInline).not.toBeNull();
    expect(resultInline!.name).toBe("web_search");
    expect(resultInline!.input.queries[0]).toBe("Blueberries latest details");

    const rawWithNewline =
      '<|tool_call>call:web_search{queries:[<|"|>Blueberries latest details<|"|>]}\n<tool_call|>';
    const resultWithNewline = parseModelSpecificToolCall(rawWithNewline);
    expect(resultWithNewline).not.toBeNull();
    expect(resultWithNewline!.input.queries[0]).toBe(
      "Blueberries latest details",
    );
  });

  it("parses without closing sentinel (model cut off early)", () => {
    const raw = '<|tool_call>call:web_search{queries:[<|"|>blueberries<|"|>]}';
    const result = parseModelSpecificToolCall(raw);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("web_search");
  });

  it("returns null for plain text with no tool call", () => {
    expect(parseModelSpecificToolCall("Hello, how can I help you?")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseModelSpecificToolCall("")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseLiteRtStructured
// ---------------------------------------------------------------------------

describe("parseLiteRtStructured", () => {
  it("parses a JSON tool_use envelope (primary path)", () => {
    const raw = JSON.stringify({
      type: "tool_use",
      tool_calls: [{ name: "web_search", input: { queries: ["test"] } }],
    });
    const result = parseLiteRtStructured(raw);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("tool_use");
    expect(result!.tool_calls![0].name).toBe("web_search");
  });

  it("parses a JSON response envelope (primary path)", () => {
    const raw = JSON.stringify({ type: "response", response: "Hello world" });
    const result = parseLiteRtStructured(raw);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("response");
    expect(result!.response).toBe("Hello world");
  });

  it("falls back to Gemma 4 native format when JSON parse fails", () => {
    const raw =
      '<|tool_call>call:web_search{queries:[<|"|>test<|"|>]}<tool_call|>';
    const result = parseLiteRtStructured(raw);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("tool_use");
    expect(result!.tool_calls![0].name).toBe("web_search");
  });

  it("returns null for plain text that is neither JSON nor a native tool call", () => {
    const result = parseLiteRtStructured("Sure, here are the details...");
    expect(result).toBeNull();
  });

  it("extracts JSON embedded inside surrounding prose", () => {
    const raw =
      'Here is my answer: {"type":"response","response":"blueberries are tasty"}';
    const result = parseLiteRtStructured(raw);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("response");
    expect(result!.response).toBe("blueberries are tasty");
  });

  it("parses malformed JSON tool calls with missing braces and tools_calls typo", () => {
    const raw =
      '{"type": "tool_use", "tools_calls": [{ "name": "web_search", "input": { "query": "what is the latest on blueberries" } ]}';
    const result = parseLiteRtStructured(raw);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("tool_use");
    expect(result!.tool_calls![0].name).toBe("web_search");
    expect(result!.tool_calls![0].input!.query).toBe(
      "what is the latest on blueberries",
    );
  });
});
