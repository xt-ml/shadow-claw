import {
  buildHeaders,
  getAdapter,
  getContextLimit,
  formatRequest,
  parseResponse,
} from "./providers.mjs";

describe("providers.mjs", () => {
  describe("buildHeaders", () => {
    it("should build default headers", () => {
      const provider = { apiKeyHeader: "Authorization" };
      const headers = buildHeaders(provider, "test-key");
      expect(headers).toEqual({
        "Content-Type": "application/json",
        Authorization: "test-key",
      });
    });

    it("should respect apiKeyHeaderFormat", () => {
      const provider = {
        apiKeyHeader: "Authorization",
        apiKeyHeaderFormat: "Bearer {key}",
      };
      const headers = buildHeaders(provider, "test-key");
      expect(headers).toEqual({
        "Content-Type": "application/json",
        Authorization: "Bearer test-key",
      });
    });

    it("should merge custom headers", () => {
      const provider = {
        apiKeyHeader: "X-API-Key",
        headers: { "X-Custom": "value" },
      };
      const headers = buildHeaders(provider, "test-key");
      expect(headers["X-Custom"]).toBe("value");
      expect(headers["X-API-Key"]).toBe("test-key");
    });
  });

  describe("getAdapter", () => {
    it("should return OpenAIAdapter for openai format", () => {
      const provider = { format: "openai" };
      const adapter = getAdapter(provider);
      expect(adapter.constructor.name).toBe("OpenAIAdapter");
    });

    it("should throw for unknown format", () => {
      const provider = { format: "unknown" };
      expect(() => getAdapter(provider)).toThrow("Unknown provider format");
    });
  });

  describe("getContextLimit", () => {
    it("should return correct limit for Claude 3 models", () => {
      expect(getContextLimit("claude-3-opus")).toBe(200000);
      expect(getContextLimit("claude-3-haiku")).toBe(200000);
    });

    it("should return correct limit for GPT-4", () => {
      expect(getContextLimit("gpt-4")).toBe(8000);
    });

    it("should return default limit for unknown models", () => {
      expect(getContextLimit("unknown-model")).toBe(4096);
    });
  });

  describe("OpenAIAdapter", () => {
    const mockProvider = { format: "openai" };
    const options = {
      model: "anthropic/claude-3.5-sonnet",
      maxTokens: 8096,
      system: "You are rover, a personal AI assistant.",
    };

    const mockMessages = [
      { role: "user", content: "You: I'm curious" },
      {
        role: "assistant",
        content: [
          {
            type: "text",
            text: "I'll show you what files are in our workspace",
          },
          {
            type: "tool_use",
            id: "tool_123",
            name: "list_files",
            input: { path: "." },
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "tool_123",
            content: "file1.txt\nfile2.txt",
          },
        ],
      },
    ];

    const tools = [
      {
        name: "list_files",
        description: "List files",
        input_schema: {
          type: "object",
          properties: { path: { type: "string" } },
        },
      },
    ];

    it("should correctly format an OpenAI-style request", () => {
      const result = formatRequest(mockProvider, mockMessages, tools, options);

      expect(result.messages).toBeDefined();
      const systemMsg = result.messages.find((m) => m.role === "system");
      expect(systemMsg).toBeDefined();
      expect(systemMsg.content).toBe(options.system);

      const assistantMsg = result.messages.find((m) => m.role === "assistant");
      expect(assistantMsg.tool_calls).toBeDefined();
      expect(assistantMsg.tool_calls[0].function.name).toBe("list_files");

      const toolMsg = result.messages.find((m) => m.role === "tool");
      expect(toolMsg).toBeDefined();
      expect(toolMsg.tool_call_id).toBe("tool_123");
    });

    it("should parse a tool call response", () => {
      const response = {
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: "c1",
                  type: "function",
                  function: { name: "my_tool", arguments: '{"x":1}' },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
      };
      const result = parseResponse(mockProvider, response);
      expect(result.content[0].type).toBe("tool_use");
      expect(result.content[0].name).toBe("my_tool");
      expect(result.stop_reason).toBe("tool_use");
    });

    it("should throw if no choices in response", () => {
      expect(() => parseResponse(mockProvider, {})).toThrow(
        "No choices in OpenAI response",
      );
    });
  });
});
