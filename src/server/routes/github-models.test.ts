import { jest } from "@jest/globals";

describe("github-models-routes", () => {
  let routes: Map<string, any>;
  let handleProxyRequestMock: any;
  let handleStreamingProxyRequestMock: any;
  let globalFetchMock: any;

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
      send: jest.fn().mockImplementation((payload: any) => {
        res.body = payload;

        return res;
      }),
    };

    return res;
  }

  beforeEach(async () => {
    jest.resetModules();
    routes = new Map();
    handleProxyRequestMock = jest.fn();
    handleStreamingProxyRequestMock = jest.fn();
    globalFetchMock = jest.fn();

    // Mock proxy helpers
    jest.unstable_mockModule("../utils/proxy-helpers.js", () => ({
      getFirstHeaderValue: (val: any) => (Array.isArray(val) ? val[0] : val),
      extractBearerToken: (val: string) => val?.replace("Bearer ", ""),
      handleProxyRequest: handleProxyRequestMock,
      handleStreamingProxyRequest: handleStreamingProxyRequestMock,
    }));

    // Mock global fetch
    global.fetch = globalFetchMock as any;

    const { registerGitHubModelsRoutes } = await import("./github-models.js");

    const app = {
      post: jest.fn((path: string, handler: any) => {
        routes.set(`POST ${path}`, handler);
      }),
      get: jest.fn((path: string, handler: any) => {
        routes.set(`GET ${path}`, handler);
      }),
    };

    registerGitHubModelsRoutes(app as any, { verbose: false });
  });

  it("proxies chat completions to GitHub Models endpoint", async () => {
    const handler = routes.get(
      "POST /github-models-proxy/inference/chat/completions",
    );
    const req = {
      method: "POST",
      body: { model: "gpt-4o", messages: [], stream: false },
      headers: { authorization: "Bearer ghp_test" },
    };
    const res = createResponse();

    await handler(req, res);

    expect(handleProxyRequestMock).toHaveBeenCalledWith(
      req,
      res,
      expect.objectContaining({
        targetUrl: "https://models.github.ai/inference/chat/completions",
        headers: expect.objectContaining({
          authorization: "Bearer ghp_test",
          "api-key": "ghp_test",
        }),
      }),
    );
  });

  it("handles streaming chat completions", async () => {
    const handler = routes.get(
      "POST /copilot-proxy/azure-openai/chat/completions",
    );
    const req = {
      method: "POST",
      body: { model: "gpt-4o", messages: [], stream: true },
      headers: { "api-key": "test-key" },
    };
    const res = createResponse();

    await handler(req, res);

    expect(handleStreamingProxyRequestMock).toHaveBeenCalledWith(
      req,
      res,
      expect.objectContaining({
        targetUrl: "https://models.github.ai/inference/chat/completions",
      }),
    );
  });

  it("fetches and transforms model catalog", async () => {
    const handler = routes.get("GET /github-models-proxy/catalog/models");
    const mockModels = [
      { id: "gpt-4o", name: "GPT-4o", limits: { max_input_tokens: 128000 } },
    ];
    globalFetchMock.mockResolvedValue({
      ok: true,
      json: async () => mockModels,
    });

    const req = { headers: { authorization: "Bearer token" } };
    const res = createResponse();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        models: expect.arrayContaining([
          expect.objectContaining({ id: "gpt-4o", context_length: 128000 }),
        ]),
      }),
    );
  });

  it("returns fallback models when catalog fetch fails", async () => {
    const handler = routes.get("GET /copilot-proxy/azure-openai/models");
    globalFetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Error",
      text: async () => "error",
    });

    const req = { headers: { authorization: "Bearer token" } };
    const res = createResponse();

    await handler(req, res);

    // Should return fallback models on error
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        models: expect.arrayContaining([
          expect.objectContaining({ id: "openai/gpt-4o" }),
        ]),
      }),
    );
  });
});
