import { jest } from "@jest/globals";

describe("Vertex AI proxy", () => {
  let mod: any;
  let app: any;
  let routes: Map<string, any>;
  let mockGenerateContent: jest.Mock<any>;
  let mockGenerateContentStream: jest.Mock<any>;
  let mockListModels: jest.Mock<any>;
  let capturedConstructorArgs: any;

  beforeEach(async () => {
    jest.resetModules();
    routes = new Map();
    capturedConstructorArgs = null;

    mockGenerateContent = jest.fn();
    mockGenerateContentStream = jest.fn();
    mockListModels = jest.fn();

    jest.unstable_mockModule("@google/genai", () => ({
      GoogleGenAI: class {
        models = {
          generateContent: mockGenerateContent,
          generateContentStream: mockGenerateContentStream,
          list: mockListModels,
        };
        constructor(args: any) {
          capturedConstructorArgs = args;
        }
      },
    }));

    mod = await import("../proxy.js");
    app = {
      get: jest.fn((path: string, handler: any) => {
        routes.set(`GET ${path}`, handler);
      }),
      post: jest.fn((path: string, handler: any) => {
        routes.set(`POST ${path}`, handler);
      }),
      all: jest.fn(),
    } as any;

    mod.registerProxyRoutes(app, { verbose: false });
  });

  it("returns 401 when project ID is missing", async () => {
    const handler = routes.get("POST /vertex-ai-proxy/chat/completions");
    expect(handler).toBeDefined();

    const req = {
      body: {
        model: "gemini-2.5-flash",
        messages: [{ role: "user", content: "hi" }],
      },
      headers: {},
    } as any;

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("project") }),
    );
  });

  it("initializes SDK with vertexai: true and project/location", async () => {
    const handler = routes.get("POST /vertex-ai-proxy/chat/completions");

    mockGenerateContent.mockResolvedValue({
      get text() {
        return "Hello!";
      },
      candidates: [{ content: { parts: [{ text: "Hello!" }] } }],
      usageMetadata: {
        promptTokenCount: 5,
        candidatesTokenCount: 3,
        totalTokenCount: 8,
      },
    });

    const req = {
      body: {
        model: "gemini-2.5-flash",
        messages: [{ role: "user", content: "hi" }],
        stream: false,
      },
      headers: {
        "x-vertex-project": "my-gcp-project",
        "x-vertex-location": "europe-west4",
      },
    } as any;

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;

    await handler(req, res);

    expect(capturedConstructorArgs).toEqual({
      vertexai: true,
      project: "my-gcp-project",
      location: "europe-west4",
    });
  });

  it("handles non-streaming chat completions", async () => {
    const handler = routes.get("POST /vertex-ai-proxy/chat/completions");

    mockGenerateContent.mockResolvedValue({
      get text() {
        return "Hello from Vertex AI!";
      },
      candidates: [{ content: { parts: [{ text: "Hello from Vertex AI!" }] } }],
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 5,
        totalTokenCount: 15,
      },
    });

    const req = {
      body: {
        model: "gemini-2.5-flash",
        messages: [{ role: "user", content: "hi" }],
        stream: false,
      },
      headers: { "x-vertex-project": "test-project" },
    } as any;

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;

    await handler(req, res);

    expect(mockGenerateContent).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        choices: [
          expect.objectContaining({
            message: expect.objectContaining({
              content: "Hello from Vertex AI!",
            }),
          }),
        ],
      }),
    );
  });

  it("handles streaming chat completions", async () => {
    const handler = routes.get("POST /vertex-ai-proxy/chat/completions");

    const mockStream = (async function* () {
      yield {
        get text() {
          return "Hello ";
        },
        candidates: [{ content: { parts: [{ text: "Hello " }] } }],
      };
      yield {
        get text() {
          return "world!";
        },
        candidates: [{ content: { parts: [{ text: "world!" }] } }],
      };
    })();

    mockGenerateContentStream.mockResolvedValue(mockStream);

    const req = {
      body: {
        model: "gemini-2.5-flash",
        messages: [{ role: "user", content: "hi" }],
        stream: true,
      },
      headers: { "x-vertex-project": "test-project" },
    } as any;

    const res = {
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    } as any;

    await handler(req, res);

    expect(mockGenerateContentStream).toHaveBeenCalled();
    expect(res.write).toHaveBeenCalledWith(expect.stringContaining("Hello "));
    expect(res.write).toHaveBeenCalledWith(expect.stringContaining("world!"));
    expect(res.write).toHaveBeenCalledWith(
      expect.stringContaining("data: [DONE]"),
    );
    expect(res.end).toHaveBeenCalled();
  });

  it("translates tool calls in non-streaming responses", async () => {
    const handler = routes.get("POST /vertex-ai-proxy/chat/completions");

    mockGenerateContent.mockResolvedValue({
      get text() {
        return "";
      },
      candidates: [
        {
          content: {
            parts: [
              {
                functionCall: {
                  name: "get_weather",
                  args: { location: "Tokyo" },
                },
              },
            ],
          },
          finishReason: "STOP",
        },
      ],
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 5,
        totalTokenCount: 15,
      },
    });

    const req = {
      body: {
        model: "gemini-2.5-flash",
        messages: [{ role: "user", content: "weather in Tokyo" }],
        tools: [{ function: { name: "get_weather", parameters: {} } }],
      },
      headers: { "x-vertex-project": "test-project" },
    } as any;

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        choices: [
          expect.objectContaining({
            finish_reason: "tool_calls",
            message: expect.objectContaining({
              tool_calls: [
                expect.objectContaining({
                  function: expect.objectContaining({
                    name: "get_weather",
                    arguments: JSON.stringify({ location: "Tokyo" }),
                  }),
                }),
              ],
            }),
          }),
        ],
      }),
    );
  });

  it("lists models dynamically", async () => {
    const handler = routes.get("GET /vertex-ai-proxy/models");
    expect(handler).toBeDefined();

    const mockResponse = (async function* () {
      yield {
        name: "models/gemini-2.5-flash",
        displayName: "Gemini 2.5 Flash",
        inputTokenLimit: 1048576,
        outputTokenLimit: 65536,
        supportedGenerationMethods: ["generateContent"],
      };
      yield {
        name: "models/embedding-001",
        supportedGenerationMethods: ["embedContent"],
      };
    })();
    mockListModels.mockResolvedValue(mockResponse);

    const req = {
      headers: { "x-vertex-project": "test-project" },
    } as any;

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;

    await handler(req, res);

    expect(capturedConstructorArgs).toEqual(
      expect.objectContaining({ vertexai: true, project: "test-project" }),
    );

    expect(res.json).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          id: "gemini-2.5-flash",
          name: "Gemini 2.5 Flash",
          context_length: 1048576,
          max_completion_tokens: 65536,
        }),
      ],
    });
  });

  it("returns fallback models when listing fails", async () => {
    const handler = routes.get("GET /vertex-ai-proxy/models");

    mockListModels.mockRejectedValue(new Error("Permission denied"));

    const req = {
      headers: { "x-vertex-project": "test-project" },
    } as any;

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;

    await handler(req, res);

    const responseData = res.json.mock.calls[0][0];
    expect(responseData.data.length).toBeGreaterThan(0);
    expect(responseData.data[0]).toEqual(
      expect.objectContaining({
        id: expect.stringContaining("gemini"),
        supports_tools: true,
      }),
    );
  });

  it("surfaces error status codes from SDK errors", async () => {
    const handler = routes.get("POST /vertex-ai-proxy/chat/completions");

    const sdkError = new Error(
      JSON.stringify({
        error: {
          code: 429,
          message: "Quota exceeded",
          status: "RESOURCE_EXHAUSTED",
        },
      }),
    );
    mockGenerateContent.mockRejectedValue(sdkError);

    const req = {
      body: {
        model: "gemini-2.5-flash",
        messages: [{ role: "user", content: "hi" }],
        stream: false,
      },
      headers: { "x-vertex-project": "test-project" },
    } as any;

    const res = {
      headersSent: false,
      writableEnded: false,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    } as any;

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining("Quota exceeded"),
      }),
    );
  });
});
