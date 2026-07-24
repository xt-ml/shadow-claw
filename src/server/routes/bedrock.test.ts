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
      ConverseCommand: class {
        input: any;

        constructor(input: any) {
          this.input = input;
        }
      },
      ConverseStreamCommand: class {
        input: any;

        constructor(input: any) {
          this.input = input;
        }
      },
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

  it("maps legacy thinking request to adaptive payload for Claude Sonnet 5+ models", async () => {
    const handler = routes.get("POST /bedrock-proxy/invoke");
    const req = {
      headers: { "x-bedrock-region": "us-east-1", "x-bedrock-profile": "test" },
      body: {
        model: "anthropic.claude-sonnet-5-v1:0",
        max_tokens: 4096,
        messages: [
          {
            role: "assistant",
            content: [
              {
                type: "thinking",
                thinking: "I should call the weather tool",
                signature: "sig_123",
              },
            ],
          },
        ],
        thinking: { type: "enabled", budget_tokens: 4096 },
        stream: false,
      },
    };
    const res = createResponse();

    mockBedrockRuntimeSend.mockResolvedValue({
      output: { message: { role: "assistant", content: [{ text: "ok" }] } },
      stopReason: "end_turn",
      usage: { inputTokens: 1, outputTokens: 1 },
    });

    await handler(req, res);

    const command = mockBedrockRuntimeSend.mock.calls[0]?.[0];
    expect(command.input.additionalModelRequestFields).toEqual({
      thinking: { type: "adaptive" },
      output_config: { effort: "max" },
    });
    expect(command.input.messages[0].content[0]).toEqual({
      reasoningContent: {
        reasoningText: {
          text: "I should call the weather tool",
          signature: "sig_123",
        },
      },
    });
  });

  it("keeps legacy thinking payload for older Claude models", async () => {
    const handler = routes.get("POST /bedrock-proxy/invoke");
    const req = {
      headers: { "x-bedrock-region": "us-east-1", "x-bedrock-profile": "test" },
      body: {
        model: "anthropic.claude-sonnet-4-6",
        messages: [],
        thinking: { type: "enabled", budget_tokens: 2048 },
        stream: false,
      },
    };
    const res = createResponse();

    mockBedrockRuntimeSend.mockResolvedValue({
      output: { message: { role: "assistant", content: [{ text: "ok" }] } },
      stopReason: "end_turn",
      usage: { inputTokens: 1, outputTokens: 1 },
    });

    await handler(req, res);

    const command = mockBedrockRuntimeSend.mock.calls[0]?.[0];
    expect(command.input.additionalModelRequestFields).toEqual({
      thinking: { type: "enabled", budget_tokens: 2048 },
    });
  });

  it("uses adaptive-thinking capability learned from /models profile name signal", async () => {
    const listHandler = routes.get("GET /bedrock-proxy/models");
    const invokeHandler = routes.get("POST /bedrock-proxy/invoke");

    const listReq = {
      headers: { "x-bedrock-region": "us-east-1", "x-bedrock-profile": "test" },
    };
    const listRes = createResponse();

    mockBedrockSend
      .mockResolvedValueOnce({ modelSummaries: [] })
      .mockResolvedValueOnce({
        inferenceProfileSummaries: [
          {
            inferenceProfileId: "us.anthropic.experimental-profile",
            inferenceProfileName: "Claude Sonnet 5",
            status: "ACTIVE",
          },
        ],
      });

    await listHandler(listReq, listRes);

    const invokeReq = {
      headers: { "x-bedrock-region": "us-east-1", "x-bedrock-profile": "test" },
      body: {
        model: "us.anthropic.experimental-profile",
        max_tokens: 4000,
        messages: [],
        thinking: { type: "enabled", budget_tokens: 2000 },
        stream: false,
      },
    };
    const invokeRes = createResponse();

    mockBedrockRuntimeSend.mockResolvedValue({
      output: { message: { role: "assistant", content: [{ text: "ok" }] } },
      stopReason: "end_turn",
      usage: { inputTokens: 1, outputTokens: 1 },
    });

    await invokeHandler(invokeReq, invokeRes);

    const command = mockBedrockRuntimeSend.mock.calls[0]?.[0];
    expect(command.input.additionalModelRequestFields).toEqual({
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
    });
  });

  it("omits replayed thinking blocks that are missing a signature", async () => {
    const handler = routes.get("POST /bedrock-proxy/invoke");
    const req = {
      headers: { "x-bedrock-region": "us-east-1", "x-bedrock-profile": "test" },
      body: {
        model: "anthropic.claude-sonnet-5-v1:0",
        messages: [
          {
            role: "assistant",
            content: [
              {
                type: "thinking",
                thinking: "missing signature should not be replayed",
              },
              {
                type: "text",
                text: "regular content",
              },
            ],
          },
        ],
        stream: false,
      },
    };
    const res = createResponse();

    mockBedrockRuntimeSend.mockResolvedValue({
      output: { message: { role: "assistant", content: [{ text: "ok" }] } },
      stopReason: "end_turn",
      usage: { inputTokens: 1, outputTokens: 1 },
    });

    await handler(req, res);

    const command = mockBedrockRuntimeSend.mock.calls[0]?.[0];
    expect(command.input.messages[0].content).toEqual([
      {
        text: "regular content",
      },
    ]);
  });

  it("maps Bedrock reasoningContent to anthropic thinking blocks (non-streaming)", async () => {
    const handler = routes.get("POST /bedrock-proxy/invoke");
    const req = {
      headers: { "x-bedrock-region": "us-east-1", "x-bedrock-profile": "test" },
      body: {
        model: "anthropic.claude-sonnet-5-v1:0",
        messages: [],
        stream: false,
      },
    };
    const res = createResponse();

    mockBedrockRuntimeSend.mockResolvedValue({
      output: {
        message: {
          role: "assistant",
          content: [
            {
              reasoningContent: {
                reasoningText: {
                  text: "internal thought",
                  signature: "sig_abc",
                },
              },
            },
            {
              reasoningContent: {
                redactedContent: { data: "enc_blob" },
              },
            },
            { text: "final answer" },
          ],
        },
      },
      stopReason: "end_turn",
      usage: { inputTokens: 2, outputTokens: 3 },
    });

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        content: [
          {
            type: "thinking",
            thinking: "internal thought",
            signature: "sig_abc",
          },
          {
            type: "redacted_thinking",
            data: "enc_blob",
          },
          { type: "text", text: "final answer" },
        ],
      }),
    );
  });

  it("emits anthropic thinking_delta and redacted_thinking_delta in streaming mode", async () => {
    const handler = routes.get("POST /bedrock-proxy/invoke");
    const req = {
      headers: { "x-bedrock-region": "us-east-1", "x-bedrock-profile": "test" },
      body: {
        model: "anthropic.claude-sonnet-5-v1:0",
        messages: [],
        stream: true,
      },
    };
    const res = createResponse();

    const mockEventStream = (async function* () {
      yield {
        contentBlockStart: {
          contentBlockIndex: 0,
          start: { reasoningContent: {} },
        },
      };
      yield {
        contentBlockDelta: {
          contentBlockIndex: 0,
          delta: {
            reasoningContent: {
              text: "thinking chunk",
            },
          },
        },
      };
      yield {
        contentBlockDelta: {
          contentBlockIndex: 0,
          delta: {
            reasoningContent: {
              signature: "sig_stream_1",
            },
          },
        },
      };
      yield {
        contentBlockDelta: {
          contentBlockIndex: 0,
          delta: {
            reasoningContent: {
              redactedContent: "enc_chunk",
            },
          },
        },
      };
      yield {
        messageStop: { stopReason: "end_turn" },
      };
    })();

    mockBedrockRuntimeSend.mockResolvedValue({ stream: mockEventStream });

    await handler(req, res);

    const writes = res.write.mock.calls.map((c: any[]) => String(c[0]));
    expect(
      writes.some((s: string) => s.includes('"type":"thinking_delta"')),
    ).toBe(true);
    expect(
      writes.some((s: string) => s.includes('"type":"signature_delta"')),
    ).toBe(true);
    expect(
      writes.some((s: string) =>
        s.includes('"type":"redacted_thinking_delta"'),
      ),
    ).toBe(true);
  });
});
