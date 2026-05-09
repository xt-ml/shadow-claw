import {
  buildHeaders,
  getAdapter,
  getContextLimit,
  formatRequest,
  parseResponse,
} from "./providers.js";
import { modelRegistry } from "./model-registry.js";

describe("providers.js", () => {
  describe("buildHeaders", () => {
    it("should build default headers", () => {
      const provider: any = { apiKeyHeader: "Authorization" };

      const headers = buildHeaders(provider, "test-key");
      expect(headers).toEqual({
        "Content-Type": "application/json",
        Authorization: "test-key",
      });
    });

    it("should respect apiKeyHeaderFormat", () => {
      const provider: any = {
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
      const provider: any = {
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
      const provider: any = { format: "openai" };

      const adapter = getAdapter(provider);
      expect(adapter.constructor.name).toBe("OpenAIAdapter");
    });

    it("should throw for unknown format", () => {
      const provider: any = { format: "unknown" };

      expect(() => getAdapter(provider)).toThrow("Unsupported provider format");
    });
  });

  describe("getContextLimit", () => {
    it("should return correct limit for Claude 3 models", () => {
      expect(getContextLimit("claude-3-opus")).toBe(200000);
      expect(getContextLimit("claude-3-haiku")).toBe(200000);
    });

    it("should return correct limit for GPT-4", () => {
      expect(getContextLimit("gpt-4")).toBe(8192);
    });

    it("should return default limit for unknown models", () => {
      expect(getContextLimit("unknown-model")).toBe(4096);
    });
  });

  describe("OpenAIAdapter", () => {
    const mockProvider: any = { format: "openai" };
    const options: any = {
      model: "anthropic/claude-3.5-sonnet",
      maxTokens: 8192,
      system: "You are k9, a personal AI assistant.",
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

    it("should emit native image blocks for OpenAI-compatible multimodal models", () => {
      modelRegistry.registerModelInfo("openai/gpt-4.1", {
        contextWindow: 128000,
        maxOutput: null,
        supportsImageInput: true,
      });

      const result = formatRequest(
        mockProvider,
        [
          {
            role: "user",
            content: [
              { type: "text", text: "You: What is in this image?" },
              {
                type: "attachment",
                mediaType: "image",
                fileName: "photo.png",
                mimeType: "image/png",
                data: "cG5n",
              },
            ],
          },
        ],
        [],
        {
          model: "openai/gpt-4.1",
          maxTokens: 1024,
          system: "",
        },
      );

      expect(result.messages[0]).toEqual({
        role: "user",
        content: [
          { type: "text", text: "You: What is in this image?" },
          {
            type: "image_url",
            image_url: { url: "data:image/png;base64,cG5n" },
          },
        ],
      });
    });

    it("should fall back to text markers for unsupported binary attachments", () => {
      const result = formatRequest(
        mockProvider,
        [
          {
            role: "user",
            content: [
              {
                type: "attachment",
                mediaType: "audio",
                fileName: "note.wav",
                mimeType: "audio/wav",
                path: "attachments/note.wav",
              },
            ],
          },
        ],
        [],
        {
          model: "gpt-3.5-turbo",
          maxTokens: 1024,
          system: "",
        },
      );

      expect(result.messages[0]).toEqual({
        role: "user",
        content: [
          {
            type: "text",
            text: "[Attachment: note.wav (audio/wav) is available in chat history at attachments/note.wav]",
          },
        ],
      });
    });

    it("should parse a tool call response", () => {
      const response: any = {
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
      const response: any = {
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

    it("should strip leaked chat-template tokens from OpenAI text", () => {
      const response: any = {
        choices: [
          {
            message: {
              content: "<|assistant|>Hello there</s>",
              tool_calls: undefined,
            },
            finish_reason: "stop",
          },
        ],
      };

      const result = parseResponse(mockProvider, response);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toBe("Hello there");
    });

    it("should parse response with no content", () => {
      const response: any = {
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
      const response: any = {
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
      expect(result.content[0].input).toEqual({} as any);
    });

    it("should format request without system message", () => {
      const messages = [{ role: "user", content: "Hello" }];
      const options: any = {
        model: "gpt-4",
        maxTokens: 1000,
        system: null,
      };

      const result = formatRequest(
        mockProvider,
        messages,
        null as any,
        options,
      );
      expect(result.messages).toBeDefined();
      const systemMsg = result.messages.find((m) => m.role === "system");
      expect(systemMsg).toBeUndefined();
    });

    it("should format request without tools", () => {
      const messages = [{ role: "user", content: "Hello" }];

      const result = formatRequest(
        mockProvider,
        messages,
        null as any,
        options,
      );
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

      const options2: any = {
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

    it("should include legacy provider routing hint for short model IDs", () => {
      const provider: any = {
        id: "github_models",
        format: "openai",
      };

      const result = formatRequest(provider, [], [], {
        model: "gpt-4o-mini",
        maxTokens: 2048,
        system: "",
      });

      expect(result.provider).toBe("azureml");
    });

    it("should omit provider routing hint for namespaced GitHub model IDs", () => {
      const provider: any = {
        id: "github_models",
        format: "openai",
      };

      const result = formatRequest(provider, [], [], {
        model: "openai/gpt-4.1",
        maxTokens: 2048,
        system: "",
      });

      expect(result.provider).toBeUndefined();
    });

    it("should include num_ctx hint for Ollama when metadata is available", () => {
      const provider: any = {
        id: "ollama",
        format: "openai",
      };

      modelRegistry.registerModelInfo("qwen3:8b", {
        contextWindow: 131072,
        maxOutput: null,
      });

      const result = formatRequest(provider, [], [], {
        model: "qwen3:8b",
        maxTokens: 2048,
        system: "",
      });

      expect(result.options?.num_ctx).toBe(131072);
    });

    it("should omit tools for Ollama models marked as unsupported", () => {
      const provider: any = {
        id: "ollama",
        format: "openai",
      };

      modelRegistry.registerModelInfo("deepseek-r1:1.5b", {
        contextWindow: 65536,
        maxOutput: null,
        supportsTools: false,
      });

      const result = formatRequest(
        provider,
        [{ role: "user", content: "hello" }],
        [
          {
            name: "read_file",
            description: "Read a file",
            input_schema: { type: "object" },
          },
        ],
        {
          model: "deepseek-r1:1.5b",
          maxTokens: 2048,
          system: "",
        },
      );

      expect(result.tools).toBeUndefined();
    });
  });

  describe("Anthropic response parsing", () => {
    const mockProvider: any = { format: "anthropic" };

    it("should strip leaked chat-template tokens from text blocks", () => {
      const response: any = {
        content: [
          {
            type: "text",
            text: "<|im_start|>assistant\nHi<|im_end|>",
          },
        ],
        stop_reason: "end_turn",
        usage: { input_tokens: 1, output_tokens: 1 },
      };

      const result = parseResponse(mockProvider, response);
      expect(result.content).toEqual([{ type: "text", text: "assistant\nHi" }]);
    });
  });

  describe("Claude model context limits", () => {
    it("should return 200k for claude-3-sonnet", () => {
      expect(getContextLimit("claude-3-sonnet")).toBe(200000);
    });

    it("should return 200k for claude-sonnet-4", () => {
      expect(getContextLimit("claude-sonnet-4")).toBe(200000);
    });

    it("should return 8k for llama-3-70b", () => {
      expect(getContextLimit("llama-3-70b")).toBe(8192);
    });

    it("should return 16k for gpt-3.5-turbo", () => {
      expect(getContextLimit("gpt-3.5-turbo")).toBe(16385);
    });

    it("should return 128k for Bedrock model IDs", () => {
      expect(getContextLimit("anthropic.claude-sonnet-4-6-v1:0")).toBe(200000);
    });

    it("should return 128k for gpt-4o", () => {
      expect(getContextLimit("gpt-4o")).toBe(128000);
      expect(getContextLimit("gpt-4o-mini")).toBe(128000);
    });

    it("should return 32k for gemma family models", () => {
      expect(getContextLimit("onnx-community/gemma-4-E2B-it-ONNX")).toBe(32000);
      expect(getContextLimit("google/gemma-2-9b-it")).toBe(32000);
    });

    it("should return 4k default for completely unknown model", () => {
      expect(getContextLimit("my-custom-model")).toBe(4096);
    });
  });

  describe("native audio transport (OpenAI input_audio)", () => {
    const mockProvider: any = { format: "openai" };

    it("should emit input_audio block when model supports audio", () => {
      modelRegistry.registerModelInfo("openai/gpt-4o-audio-preview", {
        contextWindow: 128000,
        maxOutput: null,
        supportsAudioInput: true,
      });

      const result = formatRequest(
        mockProvider,
        [
          {
            role: "user",
            content: [
              { type: "text", text: "Transcribe this" },
              {
                type: "attachment",
                mediaType: "audio",
                fileName: "speech.wav",
                mimeType: "audio/wav",
                data: "d2F2",
              },
            ],
          },
        ],
        [],
        { model: "openai/gpt-4o-audio-preview", maxTokens: 1024, system: "" },
      );

      expect(result.messages[0].content[1]).toEqual({
        type: "input_audio",
        input_audio: { data: "d2F2", format: "wav" },
      });
    });

    it("should fall back to text for audio when model has no audio capability", () => {
      const result = formatRequest(
        mockProvider,
        [
          {
            role: "user",
            content: [
              {
                type: "attachment",
                mediaType: "audio",
                fileName: "note.mp3",
                mimeType: "audio/mpeg",
                data: "bXAz",
              },
            ],
          },
        ],
        [],
        { model: "gpt-3.5-turbo", maxTokens: 1024, system: "" },
      );

      expect(result.messages[0].content[0].type).toBe("text");
    });
  });

  describe("native document transport (Anthropic document block)", () => {
    const mockProvider: any = { format: "anthropic" };

    it("should emit document block for PDF when Claude 3.5+ model is used", () => {
      modelRegistry.registerModelInfo("claude-3-5-sonnet-20241022", {
        contextWindow: 200000,
        maxOutput: null,
        supportsImageInput: true,
        supportsDocumentInput: true,
      });

      const result = formatRequest(
        mockProvider,
        [
          {
            role: "user",
            content: [
              { type: "text", text: "Summarise this PDF" },
              {
                type: "attachment",
                mediaType: "document",
                fileName: "report.pdf",
                mimeType: "application/pdf",
                data: "cGRm",
              },
            ],
          },
        ],
        [],
        { model: "claude-3-5-sonnet-20241022", maxTokens: 4096, system: "" },
      );

      expect(result.messages[0].content[1]).toEqual({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: "cGRm" },
      });
    });

    it("should fall back to text for PDF when model lacks document support", () => {
      const result = formatRequest(
        mockProvider,
        [
          {
            role: "user",
            content: [
              {
                type: "attachment",
                mediaType: "document",
                fileName: "old.pdf",
                mimeType: "application/pdf",
                data: "cGRm",
              },
            ],
          },
        ],
        [],
        { model: "claude-2", maxTokens: 4096, system: "" },
      );

      expect(result.messages[0].content[0].type).toBe("text");
    });
  });

  describe("buildHeaders edge cases", () => {
    it("should handle empty headers object", () => {
      const provider: any = {
        apiKeyHeader: "Authorization",
        headers: {},
      };

      const headers = buildHeaders(provider, "key123");
      expect(headers.Authorization).toBe("key123");
    });

    it("should handle undefined headers", () => {
      const provider: any = {
        apiKeyHeader: "Authorization",
      };

      const headers = buildHeaders(provider, "key123");
      expect(headers.Authorization).toBe("key123");
    });

    it("should use the custom format string exactly as provided", () => {
      const provider: any = {
        apiKeyHeader: "X-Token",
        apiKeyHeaderFormat: "Token {key}",
      };

      const headers = buildHeaders(provider, "abc123");
      expect(headers["X-Token"]).toBe("Token abc123");
    });
  });
});
