import { jest } from "@jest/globals";

describe("bedrock-routes", () => {
  let routes: Map<string, any>;
  let mockBedrockSend: any;
  let mockBedrockRuntimeSend: any;

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
      write: jest.fn(),
      end: jest.fn(),
    };

    return res;
  }

  beforeEach(async () => {
    jest.resetModules();
    routes = new Map();
    mockBedrockSend = jest.fn();
    mockBedrockRuntimeSend = jest.fn();

    // Mock AWS SDK
    jest.unstable_mockModule("@aws-sdk/client-bedrock", () => ({
      BedrockClient: class {
        send = mockBedrockSend;
      },
      ListFoundationModelsCommand: class {},
      ListInferenceProfilesCommand: class {},
    }));

    jest.unstable_mockModule("@aws-sdk/client-bedrock-runtime", () => ({
      BedrockRuntimeClient: class {
        send = mockBedrockRuntimeSend;
      },
      ConverseCommand: class {},
      ConverseStreamCommand: class {},
    }));

    jest.unstable_mockModule("@aws-sdk/credential-providers", () => ({
      fromNodeProviderChain: jest.fn(),
      fromSSO: jest.fn(),
    }));

    jest.unstable_mockModule("../utils/proxy-helpers.js", () => ({
      getFirstHeaderValue: (val: any) => (Array.isArray(val) ? val[0] : val),
    }));

    const { registerBedrockRoutes } = await import("./bedrock.js");

    const app = {
      get: jest.fn((path: string, handler: any) => {
        routes.set(`GET ${path}`, handler);
      }),
      post: jest.fn((path: string, handler: any) => {
        routes.set(`POST ${path}`, handler);
      }),
    };

    registerBedrockRoutes(app as any, { verbose: false });
  });

  it("returns 400 when Bedrock is not configured", async () => {
    const handler = routes.get("GET /bedrock-proxy/models");
    const req = { headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.error).toContain("Bedrock is not configured");
  });

  it("lists Bedrock models and inference profiles", async () => {
    const handler = routes.get("GET /bedrock-proxy/models");
    const req = {
      headers: { "x-bedrock-region": "us-east-1", "x-bedrock-profile": "test" },
    };
    const res = createResponse();

    mockBedrockSend
      .mockResolvedValueOnce({
        modelSummaries: [
          {
            modelId: "anthropic.claude-v2",
            modelName: "Claude v2",
            modelLifecycle: { status: "ACTIVE" },
          },
        ],
      })
      .mockResolvedValueOnce({
        inferenceProfileSummaries: [
          {
            inferenceProfileId: "us.anthropic.claude-3-sonnet",
            inferenceProfileName: "Claude 3 Sonnet",
            status: "ACTIVE",
          },
        ],
      });

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({
      models: expect.arrayContaining([
        { id: "anthropic.claude-v2", name: "Claude v2" },
        {
          id: "us.anthropic.claude-3-sonnet",
          name: "Claude 3 Sonnet (Profile)",
        },
      ]),
    });
  });

  it("handles non-streaming model invocation", async () => {
    const handler = routes.get("POST /bedrock-proxy/invoke");
    const req = {
      headers: { "x-bedrock-region": "us-east-1", "x-bedrock-profile": "test" },
      body: { model: "anthropic.claude-v2", messages: [], stream: false },
    };
    const res = createResponse();

    // Converse API response shape
    const mockResponse = {
      output: {
        message: {
          role: "assistant",
          content: [{ text: "hi" }],
        },
      },
      stopReason: "end_turn",
      usage: { inputTokens: 10, outputTokens: 5 },
    };
    mockBedrockRuntimeSend.mockResolvedValue(mockResponse);

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "message",
        role: "assistant",
        content: [{ type: "text", text: "hi" }],
        stop_reason: "end_turn",
      }),
    );
  });

  it("handles streaming model invocation", async () => {
    const handler = routes.get("POST /bedrock-proxy/invoke");
    const req = {
      headers: { "x-bedrock-region": "us-east-1", "x-bedrock-profile": "test" },
      body: { model: "anthropic.claude-v2", messages: [], stream: true },
    };
    const res = createResponse();

    // ConverseStream event format
    const mockEventStream = (async function* () {
      yield {
        contentBlockStart: {
          contentBlockIndex: 0,
          start: {},
        },
      };
      yield {
        contentBlockDelta: {
          contentBlockIndex: 0,
          delta: { text: "hello" },
        },
      };
      yield {
        contentBlockStop: { contentBlockIndex: 0 },
      };
      yield {
        messageStop: { stopReason: "end_turn" },
      };
    })();

    mockBedrockRuntimeSend.mockResolvedValue({ stream: mockEventStream });

    await handler(req, res);

    expect(res.write).toHaveBeenCalledWith(expect.stringContaining("hello"));
    expect(res.end).toHaveBeenCalled();
  });
});
