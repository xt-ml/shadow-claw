import { jest } from "@jest/globals";

describe("ollama-routes", () => {
  let routes: Map<string, any>;
  let globalFetchMock: any;
  let withRetryMock: any;

  function createResponse() {
    const res: any = {
      statusCode: 200,
      body: undefined,
      headers: new Map(),
      status: jest.fn().mockImplementation((code: any) => {
        res.statusCode = code;

        return res;
      }),
      json: jest.fn().mockImplementation((payload: any) => {
        res.body = payload;

        return res;
      }),
      setHeader: jest.fn().mockImplementation((key: any, val: any) => {
        res.headers.set(key, val);

        return res;
      }),
      send: jest.fn().mockImplementation((payload: any) => {
        res.body = payload;

        return res;
      }),
      flushHeaders: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    };

    return res;
  }

  beforeEach(async () => {
    jest.resetModules();
    routes = new Map();
    globalFetchMock = jest.fn();
    withRetryMock = jest.fn((fn: any) => fn());

    // Mock global fetch
    global.fetch = globalFetchMock as any;

    // Mock dependencies
    jest.unstable_mockModule("../../worker/withRetry.js", () => ({
      withRetry: withRetryMock,
      isRetryableHttpError: jest.fn(),
    }));

    jest.unstable_mockModule("../utils/proxy-helpers.js", () => ({
      getFirstHeaderValue: (val: any) => (Array.isArray(val) ? val[0] : val),
      fetchWithTimeout: globalFetchMock,
      parsePositiveInteger: (val: any, def: number) =>
        val ? parseInt(val, 10) : def,
      parseNonNegativeInteger: (val: any, def: number) =>
        val ? parseInt(val, 10) : def,
      requestHasTools: jest.fn(() => false),
      stripToolsFromRequest: (b: any) => b,
      ollamaDoesNotSupportTools: jest.fn(() => false),
    }));

    const { registerOllamaRoutes } = await import("./ollama.js");

    const app = {
      post: jest.fn((path: string, handler: any) => {
        routes.set(`POST ${path}`, handler);
      }),
      get: jest.fn((path: string, handler: any) => {
        routes.set(`GET ${path}`, handler);
      }),
    };

    registerOllamaRoutes(app as any, { verbose: false });
  });

  it("lists local Ollama models with metadata", async () => {
    const handler = routes.get("GET /ollama-proxy/models");

    // Mock /api/tags
    globalFetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: [{ name: "llama3" }] }),
    });

    // Mock /api/show for llama3
    globalFetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ context_length: 8192, capabilities: ["tools"] }),
    });

    const res = createResponse();
    await handler({}, res);

    expect(res.json).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          id: "llama3",
          context_length: 8192,
          supports_tools: true,
        }),
      ],
    });
  });

  it("handles chat completions via /v1/chat/completions", async () => {
    const handler = routes.get("POST /ollama-proxy/chat/completions");

    globalFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map(),
      arrayBuffer: async () => Buffer.from(JSON.stringify({ choices: [] })),
    });

    const req = {
      body: { model: "llama3", messages: [], stream: false },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(globalFetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/v1/chat/completions"),
      expect.objectContaining({ method: "POST" }),
      expect.any(Number),
    );
    expect(res.send).toHaveBeenCalled();
  });

  it("handles streaming chat completions", async () => {
    const handler = routes.get("POST /ollama-proxy/chat/completions");

    const mockStream = {
      getReader: () => ({
        read: jest
          .fn<any>()
          .mockResolvedValueOnce({ done: false, value: Buffer.from("chunk1") })
          .mockResolvedValueOnce({ done: true }),
        releaseLock: jest.fn(),
      }),
    };

    globalFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: mockStream,
    });

    const req = {
      body: { model: "llama3", messages: [], stream: true },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.write).toHaveBeenCalledWith(expect.any(Buffer));
    expect(res.end).toHaveBeenCalled();
  });
});
