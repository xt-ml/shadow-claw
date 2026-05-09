import { jest } from "@jest/globals";

describe("transformers-js-routes", () => {
  let routes: Map<string, any>;
  let service: any;

  function createResponse() {
    const res: any = {
      statusCode: 200,
      body: undefined,
      headers: {},
      status: jest.fn().mockImplementation((code: any) => {
        res.statusCode = code;

        return res;
      }),
      json: jest.fn().mockImplementation((payload: any) => {
        res.body = payload;

        return res;
      }),
      setHeader: jest.fn().mockImplementation((key: any, val: any) => {
        res.headers[key] = val;

        return res;
      }),
      flushHeaders: jest.fn(),
      once: jest.fn(),
      off: jest.fn(),
      end: jest.fn(),
    };

    return res;
  }

  beforeEach(async () => {
    jest.resetModules();
    routes = new Map();
    service = {
      getDownloadStatus: jest.fn(),
      getDiskCacheStatus: jest.fn(),
      prewarmModel: jest.fn(),
      fetchDynamicModels: jest.fn(),
      runChatCompletion: jest.fn(),
    };

    jest.unstable_mockModule("../utils/openai-sse.js", () => ({
      writeOpenAiDeltaChunk: jest.fn(),
      writeOpenAiToolCallChunk: jest.fn(),
      writeOpenAiDoneChunk: jest.fn(),
      sendStreamingProxyError: jest.fn(),
    }));

    const { registerTransformersJsRoutes } =
      await import("./transformers-js.js");

    const app = {
      get: jest.fn((path: string, handler: any) => {
        routes.set(`GET ${path}`, handler);
      }),
      post: jest.fn((path: string, handler: any) => {
        routes.set(`POST ${path}`, handler);
      }),
    };

    registerTransformersJsRoutes(app as any, service, { verbose: false });
  });

  it("lists dynamic Transformers.js models", async () => {
    const handler = routes.get("GET /transformers-js-proxy/models");
    service.fetchDynamicModels.mockResolvedValue([{ id: "Xenova/gpt2" }]);

    const res = createResponse();
    await handler({}, res);

    expect(res.json).toHaveBeenCalledWith({ data: [{ id: "Xenova/gpt2" }] });
  });

  it("returns current Transformers.js runtime status", async () => {
    const handler = routes.get("GET /transformers-js-proxy/status");
    service.getDiskCacheStatus.mockResolvedValue({
      modelsCatalogPath: "/tmp/models.json",
      modelsCatalogExists: true,
      runtimeCacheDir: "/tmp/cache",
      runtimeCacheDirExists: true,
      runtimeCacheEntryCount: 1,
      runtimeCacheEntries: ["onnx-community"],
      loadedRuntimeModels: ["onnx-community/gemma-4-E2B-it-ONNX"],
    });
    service.getDownloadStatus.mockReturnValue({
      status: "running",
      progress: 0.25,
      message: "Downloading model files",
      modelId: "onnx-community/gemma-4-E2B-it-ONNX",
      updatedAt: 123,
    });

    const res = createResponse();
    await handler({}, res);

    expect(res.json).toHaveBeenCalledWith({
      status: "running",
      progress: 0.25,
      message: "Downloading model files",
      modelId: "onnx-community/gemma-4-E2B-it-ONNX",
      updatedAt: 123,
      cache: {
        modelsCatalogPath: "/tmp/models.json",
        modelsCatalogExists: true,
        runtimeCacheDir: "/tmp/cache",
        runtimeCacheDirExists: true,
        runtimeCacheEntryCount: 1,
        runtimeCacheEntries: ["onnx-community"],
        loadedRuntimeModels: ["onnx-community/gemma-4-E2B-it-ONNX"],
      },
    });
  });

  it("prewarms Transformers.js runtime and reports cache details", async () => {
    const handler = routes.get("POST /transformers-js-proxy/prewarm");
    service.prewarmModel.mockResolvedValue({
      modelId: "onnx-community/gemma-4-E2B-it-ONNX",
      loader: "Gemma4ForConditionalGeneration/q4f16",
      cacheDir: "/tmp/cache",
    });
    service.getDiskCacheStatus.mockResolvedValue({
      modelsCatalogPath: "/tmp/models.json",
      modelsCatalogExists: true,
      runtimeCacheDir: "/tmp/cache",
      runtimeCacheDirExists: true,
      runtimeCacheEntryCount: 2,
      runtimeCacheEntries: ["onnx-community", "models.json"],
      loadedRuntimeModels: ["onnx-community/gemma-4-E2B-it-ONNX"],
    });

    const req = {
      body: { model: "onnx-community/gemma-4-E2B-it-ONNX" },
      once: jest.fn(),
      off: jest.fn(),
    };
    const res = createResponse();

    await handler(req, res);

    expect(service.prewarmModel).toHaveBeenCalledWith({
      modelId: "onnx-community/gemma-4-E2B-it-ONNX",
      verbose: false,
    });
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      modelId: "onnx-community/gemma-4-E2B-it-ONNX",
      loader: "Gemma4ForConditionalGeneration/q4f16",
      cacheDir: "/tmp/cache",
      cache: {
        modelsCatalogPath: "/tmp/models.json",
        modelsCatalogExists: true,
        runtimeCacheDir: "/tmp/cache",
        runtimeCacheDirExists: true,
        runtimeCacheEntryCount: 2,
        runtimeCacheEntries: ["onnx-community", "models.json"],
        loadedRuntimeModels: ["onnx-community/gemma-4-E2B-it-ONNX"],
      },
    });
  });

  it("returns 500 when prewarm fails", async () => {
    const handler = routes.get("POST /transformers-js-proxy/prewarm");
    service.prewarmModel.mockRejectedValue(new Error("boom"));

    const req = {
      body: {},
      once: jest.fn(),
      off: jest.fn(),
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: "Transformers.js prewarm failed: boom",
    });
  });

  it("handles non-streaming chat completions", async () => {
    const handler = routes.get("POST /transformers-js-proxy/chat/completions");
    service.runChatCompletion.mockResolvedValue({
      text: "Hello from transformers.js",
      promptTokens: 5,
      completionTokens: 10,
    });

    const req = {
      body: { model: "Xenova/gpt2", messages: [], stream: false },
      once: jest.fn(),
      off: jest.fn(),
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        choices: [
          expect.objectContaining({
            message: expect.objectContaining({
              content: "Hello from transformers.js",
            }),
          }),
        ],
      }),
    );
  });

  it("handles streaming chat completions", async () => {
    const handler = routes.get("POST /transformers-js-proxy/chat/completions");

    service.runChatCompletion.mockImplementation(async (params: any) => {
      params.onToken("Hello");
      params.onToken(" world");

      return { text: "Hello world" };
    });

    const req = {
      body: { model: "Xenova/gpt2", messages: [], stream: true },
      once: jest.fn(),
      off: jest.fn(),
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.end).toHaveBeenCalled();
  });
});
