import { jest } from "@jest/globals";

describe("mesh-llm routes", () => {
  let routes: Map<string, any>;
  let mockHandleProxyRequest: jest.Mock<any>;
  let mockHandleStreamingProxyRequest: jest.Mock<any>;

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
    };
    return res;
  }

  beforeEach(async () => {
    jest.resetModules();
    routes = new Map();

    mockHandleProxyRequest = jest.fn().mockResolvedValue(undefined as never);
    mockHandleStreamingProxyRequest = jest
      .fn()
      .mockResolvedValue(undefined as never);

    jest.unstable_mockModule("../utils/proxy-helpers.js", () => ({
      handleProxyRequest: mockHandleProxyRequest,
      handleStreamingProxyRequest: mockHandleStreamingProxyRequest,
    }));

    const { registerMeshLlmRoutes } = await import("./mesh-llm.js");

    const app = {
      get: jest.fn((path: string, handler: any) => {
        routes.set(`GET ${path}`, handler);
      }),
      post: jest.fn((path: string, handler: any) => {
        routes.set(`POST ${path}`, handler);
      }),
    };

    registerMeshLlmRoutes(app as any, { verbose: true });
  });

  describe("POST /mesh-llm-proxy/chat/completions", () => {
    const route = "POST /mesh-llm-proxy/chat/completions";

    it("handles non-streaming chat completions proxying", async () => {
      const handler = routes.get(route);
      const req = {
        headers: {
          host: "localhost",
          origin: "http://localhost",
          referer: "http://localhost/chat",
          authorization: "Bearer mesh-token",
          "x-mesh-llm-host": "https://custom.mesh.io",
        },
        body: {
          model: "mesh-70b",
          messages: [{ role: "user", content: "hello" }],
          stream: false,
        },
      };
      const res = createResponse();

      await handler(req, res);

      expect(mockHandleProxyRequest).toHaveBeenCalledWith(
        req,
        res,
        expect.objectContaining({
          targetUrl: "https://custom.mesh.io/v1/chat/completions",
          method: "POST",
          headers: {
            authorization: "Bearer mesh-token",
            "x-mesh-llm-host": "https://custom.mesh.io",
          },
          body: JSON.stringify(req.body),
        }),
      );
    });

    it("handles streaming chat completions proxying with array header", async () => {
      const handler = routes.get(route);
      const req = {
        headers: {
          host: "localhost",
          authorization: "Bearer mesh-token",
          "x-mesh-llm-host": ["https://node1.mesh.io", "https://node2.mesh.io"],
        },
        body: {
          model: "mesh-70b",
          messages: [{ role: "user", content: "stream hello" }],
          stream: true,
        },
      };
      const res = createResponse();

      await handler(req, res);

      expect(mockHandleStreamingProxyRequest).toHaveBeenCalledWith(
        req,
        res,
        expect.objectContaining({
          targetUrl: "https://node1.mesh.io/v1/chat/completions",
          headers: expect.not.objectContaining({ host: "localhost" }),
          body: JSON.stringify(req.body),
        }),
      );
    });
  });

  describe("GET /mesh-llm-proxy/models", () => {
    const route = "GET /mesh-llm-proxy/models";

    it("fetches and normalises models catalog", async () => {
      const handler = routes.get(route);
      const mockCatalog = {
        data: [
          {
            id: "model-1",
            metadata: {
              context_length: 32768,
            },
          },
          {
            id: "model-2",
          },
        ],
      };

      (globalThis as any).fetch = (jest.fn() as any).mockResolvedValue({
        ok: true,
        json: async () => mockCatalog,
      });

      const req = { headers: {} };
      const res = createResponse();

      await handler(req, res);

      expect(res.json).toHaveBeenCalledWith({
        data: [
          {
            id: "model-1",
            metadata: { context_length: 32768 },
            context_length: 32768,
          },
          {
            id: "model-2",
          },
        ],
      });
    });

    it("falls back to default fallback model on fetch failure", async () => {
      const handler = routes.get(route);
      (globalThis as any).fetch = (jest.fn() as any).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: async () => "Upstream error",
      });

      const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const req = { headers: {} };
      const res = createResponse();

      await handler(req, res);

      expect(res.json).toHaveBeenCalledWith({
        models: [
          {
            id: "mesh",
            name: "mesh",
            context_length: 8000,
            max_completion_tokens: 4096,
          },
        ],
      });
      errSpy.mockRestore();
    });
  });
});
