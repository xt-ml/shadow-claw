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
      },
      headers: { "x-goog-api-key": "test-key" },
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
        name: "models/gemini-2.0-flash",
        displayName: "Gemini 2.0 Flash",
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
          id: "gemini-2.0-flash",
          name: "Gemini 2.0 Flash",
        }),
      ],
    });
  });
});
