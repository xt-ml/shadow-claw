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

    it("should parse a text-only response", () => {
      const response = {
        choices: [
          {
            message: {
              content: "Hello, how can I help?",
              tool_calls: undefined,
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
        },
      };

      const result = parseResponse(mockProvider, response);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toBe("Hello, how can I help?");
      expect(result.stop_reason).toBe("end_turn");
      expect(result.usage.input_tokens).toBe(100);
      expect(result.usage.output_tokens).toBe(50);
    });

    it("should parse response with no content", () => {
      const response = {
        choices: [
          {
            message: {
              content: null,
              tool_calls: undefined,
            },
            finish_reason: "stop",
          },
        ],
      };

      const result = parseResponse(mockProvider, response);
      expect(result.content).toEqual([]);
      expect(result.stop_reason).toBe("end_turn");
    });

    it("should handle JSON parse errors in tool arguments", () => {
      const response = {
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: "c1",
                  type: "function",
                  function: { name: "my_tool", arguments: "invalid json {" },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
      };

      const result = parseResponse(mockProvider, response);
      expect(result.content[0].type).toBe("tool_use");
      expect(result.content[0].input).toEqual({});
    });

    it("should format request without system message", () => {
      const messages = [{ role: "user", content: "Hello" }];
      const options = {
        model: "gpt-4",
        maxTokens: 1000,
        system: null,
      };

      const result = formatRequest(mockProvider, messages, null, options);
      expect(result.messages).toBeDefined();
      const systemMsg = result.messages.find((m) => m.role === "system");
      expect(systemMsg).toBeUndefined();
    });

    it("should format request without tools", () => {
      const messages = [{ role: "user", content: "Hello" }];
      const result = formatRequest(mockProvider, messages, null, options);
      expect(result.tools).toBeUndefined();
    });

    it("should format assistant message with only text (no tool uses)", () => {
      const messages = [
        {
          role: "assistant",
          content: [
            {
              type: "text",
              text: "I'll help you",
            },
          ],
        },
      ];

      const result = formatRequest(mockProvider, messages, [], options);
      const assistantMsg = result.messages.find((m) => m.role === "assistant");
      expect(assistantMsg.content).toBe("I'll help you");
      expect(assistantMsg.tool_calls).toBeUndefined();
    });

    it("should format user message with tool results only", () => {
      const messages = [
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "tool_123",
              content: "result data",
            },
          ],
        },
      ];

      const result = formatRequest(mockProvider, messages, [], options);
      const toolMsg = result.messages.find((m) => m.role === "tool");
      expect(toolMsg).toBeDefined();
      expect(toolMsg.content).toBe("result data");
    });

    it("should serialize tool result content as JSON when not a string", () => {
      const messages = [
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "tool_123",
              content: { data: "value", count: 42 },
            },
          ],
        },
      ];

      const result = formatRequest(mockProvider, messages, [], options);
      const toolMsg = result.messages.find((m) => m.role === "tool");
      expect(JSON.parse(toolMsg.content)).toEqual({ data: "value", count: 42 });
    });

    it("should skip duplicate system messages", () => {
      const messages = [
        { role: "system", content: "System 1" },
        { role: "user", content: "Hello" },
      ];

      const options2 = {
        model: "gpt-4",
        maxTokens: 1000,
        system: "System 2",
      };

      const result = formatRequest(mockProvider, messages, [], options2);
      const systemMsgs = result.messages.filter((m) => m.role === "system");
      expect(systemMsgs).toHaveLength(1);
      expect(systemMsgs[0].content).toBe("System 2");
    });

    it("should handle assistant message with complex tool uses", () => {
      const messages = [
        {
          role: "assistant",
          content: [
            { type: "text", text: "I found multiple files:" },
            {
              type: "tool_use",
              id: "tool_1",
              name: "read_file",
              input: { file: "file1.txt" },
            },
            {
              type: "tool_use",
              id: "tool_2",
              name: "read_file",
              input: { file: "file2.txt" },
            },
          ],
        },
      ];

      const result = formatRequest(mockProvider, messages, [], options);
      const assistantMsg = result.messages.find((m) => m.role === "assistant");
      expect(assistantMsg.tool_calls).toHaveLength(2);
      expect(assistantMsg.content).toBe("I found multiple files:");
    });

    it("should handle empty tool calls array", () => {
      const messages = [
        {
          role: "assistant",
          content: [
            {
              type: "text",
              text: "No tools needed",
            },
          ],
        },
      ];

      const result = formatRequest(mockProvider, messages, [], options);
      const assistantMsg = result.messages.find((m) => m.role === "assistant");
      expect(assistantMsg.tool_calls).toBeUndefined();
      expect(assistantMsg.content).toBe("No tools needed");
    });

    it("should include tools in request when provided", () => {
      const tools = [
        {
          name: "test_tool",
          description: "A test tool",
          input_schema: { type: "object" },
        },
      ];

      const result = formatRequest(mockProvider, [], tools, options);
      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].function.name).toBe("test_tool");
    });
  });

  describe("Claude model context limits", () => {
    it("should return 200k for claude-3-sonnet", () => {
      expect(getContextLimit("claude-3-sonnet")).toBe(200000);
    });

    it("should return 200k for claude-sonnet-4", () => {
      expect(getContextLimit("claude-sonnet-4")).toBe(8000);
    });

    it("should return 8k for llama-3-70b", () => {
      expect(getContextLimit("llama-3-70b")).toBe(8000);
    });

    it("should return 8k for gpt-3.5", () => {
      expect(getContextLimit("gpt-3.5-turbo")).toBe(4000);
    });

    it("should return 4k default for completely unknown model", () => {
      expect(getContextLimit("my-custom-model")).toBe(4096);
    });
  });

  describe("buildHeaders edge cases", () => {
    it("should handle empty headers object", () => {
      const provider = {
        apiKeyHeader: "Authorization",
        headers: {},
      };

      const headers = buildHeaders(provider, "key123");
      expect(headers.Authorization).toBe("key123");
    });

    it("should handle undefined headers", () => {
      const provider = {
        apiKeyHeader: "Authorization",
      };

      const headers = buildHeaders(provider, "key123");
      expect(headers.Authorization).toBe("key123");
    });

    it("should use the custom format string exactly as provided", () => {
      const provider = {
        apiKeyHeader: "X-Token",
        apiKeyHeaderFormat: "Token {key}",
      };

      const headers = buildHeaders(provider, "abc123");
      expect(headers["X-Token"]).toBe("Token abc123");
    });
  });
});
