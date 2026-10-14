import { jest } from "@jest/globals";

describe("Gemini proxy", () => {
  let mod: any;
  let app: any;
  let routes: Map<string, any>;
  let mockGenerateContent: jest.Mock<any>;
  let mockGenerateContentStream: jest.Mock<any>;
  let mockListModels: jest.Mock<any>;

  beforeEach(async () => {
    jest.resetModules();
    routes = new Map();

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

  it("handles non-streaming chat completions", async () => {
    const handler = routes.get("POST /gemini-proxy/chat/completions");

    mockGenerateContent.mockResolvedValue({
      get text() {
        return "Hello from Gemini!";
      },
      candidates: [{ content: { parts: [{ text: "Hello from Gemini!" }] } }],
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 5,
        totalTokenCount: 15,
      },
    });

    const req = {
      body: {
        model: "gemini-2.0-flash",
        messages: [{ role: "user", content: "hi" }],
        stream: false,
        reasoning: {
          effort: "low",
          max_tokens: 2048,
        },
      },
      headers: { "x-goog-api-key": "test-key" },
    } as any;

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;

    await handler(req, res);

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        generationConfig: expect.objectContaining({
          thinkingConfig: {
            includeThoughts: true,
            thinkingBudget: 2048,
          },
        }),
      }),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        choices: [
          expect.objectContaining({
            message: expect.objectContaining({
              content: "Hello from Gemini!",
            }),
          }),
        ],
      }),
    );
  });

  it("handles streaming chat completions", async () => {
    const handler = routes.get("POST /gemini-proxy/chat/completions");

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
        model: "gemini-2.0-flash",
        messages: [{ role: "user", content: "hi" }],
        stream: true,
      },
      headers: { "x-goog-api-key": "test-key" },
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

  it("emits reasoning deltas for thought parts in streaming responses", async () => {
    const handler = routes.get("POST /gemini-proxy/chat/completions");

    const mockStream = (async function* () {
      yield {
        get text() {
          return "";
        },
        candidates: [
          {
            content: {
              parts: [{ thought: true, text: "hidden reasoning" }],
            },
          },
        ],
      };
    })();

    mockGenerateContentStream.mockResolvedValue(mockStream);

    const req = {
      body: {
        model: "gemini-2.5-flash",
        messages: [{ role: "user", content: "hi" }],
        stream: true,
      },
      headers: { "x-goog-api-key": "test-key" },
    } as any;

    const res = {
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    } as any;

    await handler(req, res);

    expect(res.write).toHaveBeenCalledWith(
      expect.stringContaining('"reasoning":"hidden reasoning"'),
    );
  });

  it("translates tool calls in non-streaming responses", async () => {
    const handler = routes.get("POST /gemini-proxy/chat/completions");

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
                  args: { location: "London" },
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
        model: "gemini-2.0-flash",
        messages: [{ role: "user", content: "weather in London" }],
        tools: [{ function: { name: "get_weather", parameters: {} } }],
      },
      headers: { "x-goog-api-key": "test-key" },
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
                    arguments: JSON.stringify({ location: "London" }),
                  }),
                }),
              ],
            }),
          }),
        ],
      }),
    );
  });

  it("lists models", async () => {
    const handler = routes.get("GET /gemini-proxy/models");

    const mockResponse = (async function* () {
      yield {
        name: "models/gemini-2.5-flash",
        displayName: "Gemini 2.5 Flash",
        supportedGenerationMethods: ["generateContent"],
      };
      yield {
        name: "models/embedding-001",
        supportedGenerationMethods: ["embedContent"],
      };
    })();
    mockListModels.mockResolvedValue(mockResponse);

    const req = {
      headers: { "x-goog-api-key": "test-key" },
    } as any;

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          id: "gemini-2.5-flash",
          name: "Gemini 2.5 Flash",
          reasoning: expect.objectContaining({
            default_effort: "medium",
            supports_max_tokens: true,
          }),
        }),
      ],
    });
  });

  it("uses thinkingLevel for Gemini 3 reasoning requests", async () => {
    const handler = routes.get("POST /gemini-proxy/chat/completions");

    mockGenerateContent.mockResolvedValue({
      get text() {
        return "Hello from Gemini 3!";
      },
      candidates: [{ content: { parts: [{ text: "Hello from Gemini 3!" }] } }],
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 5,
        totalTokenCount: 15,
      },
    });

    const req = {
      body: {
        model: "gemini-3-pro",
        messages: [{ role: "user", content: "hi" }],
        stream: false,
        reasoning: {
          effort: "high",
        },
      },
      headers: { "x-goog-api-key": "test-key" },
    } as any;

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;

    await handler(req, res);

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        generationConfig: expect.objectContaining({
          thinkingConfig: {
            thinkingLevel: "high",
          },
        }),
      }),
    );
  });

  it("returns 401 when API key is missing", async () => {
    const oldKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const handler = routes.get("POST /gemini-proxy/chat/completions");
      const req = { body: {}, headers: {} } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(401);

      const modelsHandler = routes.get("GET /gemini-proxy/models");
      await modelsHandler(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    } finally {
      if (oldKey) process.env.GEMINI_API_KEY = oldKey;
    }
  });

  it("handles multimodal content and tools in non-streaming completions", async () => {
    const handler = routes.get("POST /gemini-proxy/chat/completions");

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
                  name: "fetch_url",
                  args: { url: "https://example.com" },
                },
              },
            ],
          },
        },
      ],
      usageMetadata: {
        promptTokenCount: 5,
        candidatesTokenCount: 10,
        totalTokenCount: 15,
      },
    });

    const req = {
      body: {
        model: "gemini-2.0-flash",
        messages: [
          { role: "system", content: "You are helpful" },
          {
            role: "user",
            content: [
              { type: "text", text: "Look at this" },
              {
                type: "image_url",
                image_url: { url: "data:image/png;base64,iVBORw0KGgo=" },
              },
              { type: "tool_use", name: "calculator", input: { a: 1 } },
              { type: "tool_result", name: "calculator", content: "2" },
              { type: "unknown" },
            ],
          },
          { role: "assistant", content: "working" },
          { role: "tool", content: "result" },
        ],
        tools: [
          {
            function: {
              name: "fetch_url",
              description: "Fetch URL",
              parameters: { type: "object" },
            },
          },
        ],
      },
      headers: { "x-goog-api-key": "test-key" },
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
              role: "assistant",
              tool_calls: [
                expect.objectContaining({
                  function: expect.objectContaining({
                    name: "fetch_url",
                  }),
                }),
              ],
            }),
          }),
        ],
      }),
    );
  });

  it("handles streaming chunks with reasoning and function calls", async () => {
    const handler = routes.get("POST /gemini-proxy/chat/completions");

    const asyncIterable = (async function* () {
      yield {
        text: "Thinking...",
        candidates: [
          {
            content: {
              parts: [
                { thought: true, text: "Let me check..." },
                {
                  functionCall: {
                    name: "test_tool",
                    args: { x: 1 },
                  },
                },
              ],
            },
          },
        ],
      };
      yield {
        text: "Done!",
      };
    })();

    mockGenerateContentStream.mockResolvedValue(asyncIterable);

    const written: string[] = [];
    const req = {
      body: {
        stream: true,
        messages: [{ role: "user", content: "run test" }],
      },
      headers: { "x-goog-api-key": "test-key" },
    } as any;

    const res = {
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: jest.fn((chunk: string) => written.push(chunk)),
      end: jest.fn(),
    } as any;

    await handler(req, res);

    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "text/event-stream",
    );
    expect(res.end).toHaveBeenCalled();
    expect(written.length).toBeGreaterThan(0);
  });

  it("handles errors during completion with JSON error payload", async () => {
    const handler = routes.get("POST /gemini-proxy/chat/completions");

    mockGenerateContent.mockRejectedValue(
      new Error(
        JSON.stringify({ error: { code: 429, message: "Resource exhausted" } }),
      ),
    );

    const req = {
      body: { messages: [{ role: "user", content: "hi" }] },
      headers: { "x-goog-api-key": "test-key" },
    } as any;

    const res = {
      headersSent: false,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;

    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it("provides fallback models when listing fails during iteration or yields empty list", async () => {
    const handler = routes.get("GET /gemini-proxy/models");

    const throwingIterable = (async function* () {
      throw new Error("Quota exceeded during iteration");
    })();
    mockListModels.mockResolvedValue(throwingIterable);

    const req = {
      headers: { "x-goog-api-key": "test-key" },
    } as any;

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ id: "gemini-2.0-flash" }),
          expect.objectContaining({ id: "gemini-1.5-flash" }),
        ]),
      }),
    );
  });

  it("returns 502 when models.list() itself throws", async () => {
    const handler = routes.get("GET /gemini-proxy/models");

    mockListModels.mockRejectedValue(new Error("Network failure"));

    const req = {
      headers: { "x-goog-api-key": "test-key" },
    } as any;

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining("Network failure"),
      }),
    );
  });
});
