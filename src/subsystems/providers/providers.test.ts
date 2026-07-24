import { modelRegistry } from "./model-registry.js";

import {
  buildHeaders,
  formatRequest,
  getAdapter,
  getContextLimit,
  parseResponse,
} from "./providers.js";

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
      maxTokens: 8192,
      model: "anthropic/claude-3.5-sonnet",
      system: "You are example, a personal AI assistant.",
    };

    const mockMessages = [
      { role: "user", content: "You: I'm curious" },
      {
        role: "assistant",
        content: [
          {
            text: "I'll show you what files are in our workspace",
            type: "text",
          },
          {
            id: "tool_123",
            input: { path: "." },
            name: "list_files",
            type: "tool_use",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            content: "file1.txt\nfile2.txt",
            tool_use_id: "tool_123",
            type: "tool_result",
          },
        ],
      },
    ];

    const tools = [
      {
        input_schema: {
          properties: { path: { type: "string" } },
          type: "object",
        },
        description: "List files",
        name: "list_files",
      },
    ];

    it("should correctly format an OpenAI-style request", () => {
      const result = formatRequest(mockProvider, mockMessages, tools, options);
      expect(result.messages).toBeDefined();

      const systemMsg = result.messages.find((m: any) => m.role === "system");
      expect(systemMsg).toBeDefined();
      expect(systemMsg.content).toBe(options.system);

      const assistantMsg = result.messages.find(
        (m: any) => m.role === "assistant",
      );
      expect(assistantMsg.tool_calls).toBeDefined();
      expect(assistantMsg.tool_calls[0].function.name).toBe("list_files");

      const toolMsg = result.messages.find((m: any) => m.role === "tool");
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
                data: "cG5n",
                fileName: "photo.png",
                mediaType: "image",
                mimeType: "image/png",
                type: "attachment",
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
            image_url: { url: "data:image/png;base64,cG5n" },
            type: "image_url",
          },
        ],
      });
    });

    it("should fall back to text markers for unsupported binary attachments", () => {
      const result = formatRequest(
        mockProvider,
        [
          {
            content: [
              {
                fileName: "note.wav",
                mediaType: "audio",
                mimeType: "audio/wav",
                path: "attachments/note.wav",
                type: "attachment",
              },
            ],
            role: "user",
          },
        ],
        [],
        {
          maxTokens: 1024,
          model: "gpt-3.5-turbo",
          system: "",
        },
      );

      expect(result.messages[0]).toEqual({
        content: [
          {
            text: "[Attachment: note.wav (audio/wav) is available in chat history at attachments/note.wav]",
            type: "text",
          },
        ],
        role: "user",
      });
    });

    it("should parse a tool call response", () => {
      const response: any = {
        choices: [
          {
            finish_reason: "tool_calls",
            message: {
              content: null,
              tool_calls: [
                {
                  function: { name: "my_tool", arguments: '{"x":1}' },
                  id: "c1",
                  type: "function",
                },
              ],
            },
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
            finish_reason: "stop",
            message: {
              tool_calls: undefined,
              content: "Hello, how can I help?",
            },
          },
        ],
        usage: {
          completion_tokens: 50,
          prompt_tokens: 100,
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
            finish_reason: "stop",
            message: {
              content: "<|assistant|>Hello there</s>",
              tool_calls: undefined,
            },
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
            finish_reason: "stop",
            message: {
              content: null,
              tool_calls: undefined,
            },
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
              finish_reason: "tool_calls",
              content: null,
              tool_calls: [
                {
                  id: "c1",
                  type: "function",
                  function: { name: "my_tool", arguments: "invalid json {" },
                },
              ],
            },
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
        maxTokens: 1000,
        model: "gpt-4",
        system: null,
      };

      const result = formatRequest(
        mockProvider,
        messages,
        null as any,
        options,
      );

      expect(result.messages).toBeDefined();

      const systemMsg = result.messages.find((m: any) => m.role === "system");
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
              text: "I'll help you",
              type: "text",
            },
          ],
        },
      ];

      const result = formatRequest(mockProvider, messages, [], options);
      const assistantMsg = result.messages.find(
        (m: any) => m.role === "assistant",
      );
      expect(assistantMsg.content).toBe("I'll help you");
      expect(assistantMsg.tool_calls).toBeUndefined();
    });

    it("should format user message with tool results only", () => {
      const messages = [
        {
          content: [
            {
              content: "result data",
              tool_use_id: "tool_123",
              type: "tool_result",
            },
          ],
          role: "user",
        },
      ];

      const result = formatRequest(mockProvider, messages, [], options);
      const toolMsg = result.messages.find((m: any) => m.role === "tool");
      expect(toolMsg).toBeDefined();
      expect(toolMsg.content).toBe("result data");
    });

    it("should serialize tool result content as JSON when not a string", () => {
      const messages = [
        {
          content: [
            {
              content: { data: "value", count: 42 },
              tool_use_id: "tool_123",
              type: "tool_result",
            },
          ],
          role: "user",
        },
      ];

      const result = formatRequest(mockProvider, messages, [], options);
      const toolMsg = result.messages.find((m: any) => m.role === "tool");
      expect(JSON.parse(toolMsg.content)).toEqual({ data: "value", count: 42 });
    });

    it("should skip duplicate system messages", () => {
      const messages = [
        { role: "system", content: "System 1" },
        { role: "user", content: "Hello" },
      ];

      const options2: any = {
        maxTokens: 1000,
        model: "gpt-4",
        system: "System 2",
      };

      const result = formatRequest(mockProvider, messages, [], options2);
      const systemMsgs = result.messages.filter(
        (m: any) => m.role === "system",
      );
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
              id: "tool_1",
              input: { file: "file1.txt" },
              name: "read_file",
              type: "tool_use",
            },
            {
              id: "tool_2",
              input: { file: "file2.txt" },
              name: "read_file",
              type: "tool_use",
            },
          ],
        },
      ];

      const result = formatRequest(mockProvider, messages, [], options);
      const assistantMsg = result.messages.find(
        (m: any) => m.role === "assistant",
      );
      expect(assistantMsg.tool_calls).toHaveLength(2);
      expect(assistantMsg.content).toBe("I found multiple files:");
    });

    it("should handle empty tool calls array", () => {
      const messages = [
        {
          content: [
            {
              text: "No tools needed",
              type: "text",
            },
          ],
          role: "assistant",
        },
      ];

      const result = formatRequest(mockProvider, messages, [], options);
      const assistantMsg = result.messages.find(
        (m: any) => m.role === "assistant",
      );
      expect(assistantMsg.tool_calls).toBeUndefined();
      expect(assistantMsg.content).toBe("No tools needed");
    });

    it("should include tools in request when provided", () => {
      const tools = [
        {
          description: "A test tool",
          input_schema: { type: "object" },
          name: "test_tool",
        },
      ];

      const result = formatRequest(mockProvider, [], tools, options);
      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].function.name).toBe("test_tool");
    });

    it("should include legacy provider routing hint for short model IDs", () => {
      const provider: any = {
        format: "openai",
        id: "github_models",
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
        format: "openai",
        id: "github_models",
      };

      const result = formatRequest(provider, [], [], {
        maxTokens: 2048,
        model: "openai/gpt-4.1",
        system: "",
      });

      expect(result.provider).toBeUndefined();
    });

    it("should include num_ctx hint for Ollama when metadata is available", () => {
      const provider: any = {
        format: "openai",
        id: "ollama",
      };

      modelRegistry.registerModelInfo("qwen3:8b", {
        contextWindow: 131072,
        maxOutput: null,
      });

      const result = formatRequest(provider, [], [], {
        maxTokens: 2048,
        model: "qwen3:8b",
        system: "",
      });

      expect(result.options?.num_ctx).toBe(131072);
    });

    it("should include reasoning payload for providers configured with reasoningParam=reasoning", () => {
      const provider: any = {
        format: "openai",
        id: "openrouter",
        reasoningParam: "reasoning",
      };

      const result = formatRequest(provider, [], [], {
        maxTokens: 4096,
        model: "anthropic/claude-sonnet-5",
        reasoning: { effort: "high" },
        system: "",
      } as any);

      expect(result.reasoning).toEqual({ effort: "high" });
    });

    it("should include reasoning payload for providers configured with reasoningParam=thinkingConfig", () => {
      const provider: any = {
        format: "openai",
        id: "gemini_proxy",
        reasoningParam: "thinkingConfig",
      };

      const result = formatRequest(provider, [], [], {
        maxTokens: 4096,
        model: "gemini-2.5-flash",
        reasoning: { effort: "medium", max_tokens: 2048 },
        system: "",
      } as any);

      expect(result.reasoning).toEqual({ effort: "medium", max_tokens: 2048 });
    });

    it("should omit tools for Ollama models marked as unsupported", () => {
      const provider: any = {
        format: "openai",
        id: "ollama",
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
            description: "Read a file",
            input_schema: { type: "object" },
            name: "read_file",
          },
        ],
        {
          maxTokens: 2048,
          model: "deepseek-r1:1.5b",
          system: "",
        },
      );

      expect(result.tools).toBeUndefined();
    });

    it("should format rich tool result with image blocks for OpenAi (vision model)", () => {
      const messages = [
        {
          role: "user",
          content: [
            {
              content: [
                { type: "text", text: "Contents of image file: photo.png" },
                {
                  data: "iVBORw0KGgoAAAANSUhEUg==",
                  media_type: "image/png",
                  type: "image",
                },
              ],
              type: "tool_result",
              tool_use_id: "tool_img",
            },
          ],
        },
      ];

      const result = formatRequest(mockProvider, messages, [], {
        maxTokens: 1000,
        model: "gpt-4o",
        system: "",
      });

      const toolMsg = result.messages.find((m: any) => m.role === "tool");
      expect(toolMsg).toBeDefined();
      expect(Array.isArray(toolMsg.content)).toBe(true);
      expect(toolMsg.content[0]).toEqual({
        text: "Contents of image file: photo.png",
        type: "text",
      });

      expect(toolMsg.content[1]).toEqual({
        image_url: {
          url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
        },
        type: "image_url",
      });
    });

    it("should fall back to text for rich tool result on non-vision model", () => {
      const messages = [
        {
          content: [
            {
              type: "tool_result",
              tool_use_id: "tool_img",
              content: [
                { type: "text", text: "Contents of image file: photo.png" },
                {
                  data: "iVBORw0KGgoAAAANSUhEUg==",
                  media_type: "image/png",
                  type: "image",
                },
              ],
            },
          ],
          role: "user",
        },
      ];

      const result = formatRequest(mockProvider, messages, [], {
        maxTokens: 1000,
        model: "text-only-model-no-vision",
        system: "",
      });

      const toolMsg = result.messages.find((m: any) => m.role === "tool");
      expect(toolMsg).toBeDefined();

      expect(typeof toolMsg.content).toBe("string");
      expect(toolMsg.content).toContain("Contents of image file: photo.png");
      expect(toolMsg.content).toContain("[Image:");
    });
  });

  describe("Anythropic rich tool results", () => {
    const anthropicProvider: any = {
      apiKeyHeader: "x-api-key",
      format: "anthropic",
      id: "anthropic",
      reasoningParam: "thinking",
    };

    const anthropicOptions: any = {
      maxTokens: 4096,
      model: "claude-sonnet-4-20250514",
      system: "You are helpful",
    };

    it("should format rich tool result with native image blocks for Anthropic", () => {
      const messages = [
        {
          content: [
            {
              id: "tool_img",
              input: { path: "photo.png" },
              name: "read_file",
              type: "tool_use",
            },
          ],
          role: "assistant",
        },
        {
          content: [
            {
              content: [
                {
                  text: "Contents of image file: photo.png",
                  type: "text",
                },
                {
                  data: "iVBORw0KGgoAAAANSUhEUg==",
                  media_type: "image/png",
                  type: "image",
                },
              ],
              tool_use_id: "tool_img",
              type: "tool_result",
            },
          ],
          role: "user",
        },
      ];

      const result = formatRequest(
        anthropicProvider,
        messages,
        [],
        anthropicOptions,
      );

      const userMsg = result.messages.find(
        (m: any) =>
          m.role === "user" &&
          Array.isArray(m.content) &&
          m.content.some((b: any) => b.type === "tool_result"),
      );

      expect(userMsg).toBeDefined();

      const toolResult = userMsg.content.find(
        (b: any) => b.type === "tool_result",
      );

      expect(toolResult).toBeDefined();
      expect(Array.isArray(toolResult.content)).toBe(true);
      expect(toolResult.content[0]).toEqual({
        text: "Contents of image file: photo.png",
        type: "text",
      });

      expect(toolResult.content[1]).toEqual({
        source: {
          data: "iVBORw0KGgoAAAANSUhEUg==",
          media_type: "image/png",
          type: "base64",
        },
        type: "image",
      });
    });

    it("should map reasoning effort to anthropic thinking budget", () => {
      const result = formatRequest(anthropicProvider, [], [], {
        maxTokens: 10000,
        model: "claude-sonnet-4-20250514",
        reasoning: { effort: "high" },
        system: "You are helpful",
      } as any);

      expect(result.thinking).toEqual({
        type: "enabled",
        budget_tokens: 8000,
      });
    });

    it("should preserve anthropic thinking history blocks", () => {
      const result = formatRequest(
        anthropicProvider,
        [
          {
            role: "assistant",
            content: [
              {
                type: "thinking",
                thinking: "intermediate thought",
                signature: "sig_1",
              },
              {
                type: "redacted_thinking",
                data: "enc_1",
              },
              {
                type: "text",
                text: "answer",
              },
            ],
          },
        ],
        [],
        anthropicOptions,
      );

      expect(result.messages[0].content).toEqual([
        {
          type: "thinking",
          thinking: "intermediate thought",
          signature: "sig_1",
        },
        {
          type: "redacted_thinking",
          data: "enc_1",
        },
        {
          type: "text",
          text: "answer",
        },
      ]);
    });
  });

  describe("Anthropic response parsing", () => {
    const mockProvider: any = { format: "anthropic" };

    it("should strip leaked chat-template tokens from text blocks", () => {
      const response: any = {
        stop_reason: "end_turn",
        usage: { input_tokens: 1, output_tokens: 1 },
        content: [
          {
            text: "<|im_start|>assistant\nHi<|im_end|>",
            type: "text",
          },
        ],
      };

      const result = parseResponse(mockProvider, response);
      expect(result.content).toEqual([{ type: "text", text: "assistant\nHi" }]);
    });
  });

  describe("Claude model context limits", () => {
    it("should return 200k for claude-3-sonnet", () => {
      expect(getContextLimit("claude-3-sonnet")).toBe(200000);
    });

    it("should return 1M for claude-sonnet-4", () => {
      expect(getContextLimit("claude-sonnet-4")).toBe(1_000_000);
    });

    it("should return 8k for llama-3-70b", () => {
      expect(getContextLimit("llama-3-70b")).toBe(8192);
    });

    it("should return 16k for gpt-3.5-turbo", () => {
      expect(getContextLimit("gpt-3.5-turbo")).toBe(16385);
    });

    it("should return 1M for Bedrock model IDs", () => {
      expect(getContextLimit("anthropic.claude-sonnet-4-6-v1:0")).toBe(
        1_000_000,
      );
    });

    it("should return 128k for gpt-4o", () => {
      expect(getContextLimit("gpt-4o")).toBe(128000);
      expect(getContextLimit("gpt-4o-mini")).toBe(128000);
    });

    it("should return 128k for Gemma 4 E2B / E4B models", () => {
      expect(getContextLimit("onnx-community/gemma-4-E2B-it-ONNX")).toBe(
        128_000,
      );
      expect(
        getContextLimit("onnx-community/gemma-4-E4B-it-qat-mobile-ONNX"),
      ).toBe(128_000);
    });

    it("should return 256k for Gemma 4 12B / E9B / E27B models", () => {
      expect(getContextLimit("onnx-community/gemma-4-12B-it-ONNX")).toBe(
        256_000,
      );
      expect(getContextLimit("onnx-community/gemma-4-E9B-it-ONNX")).toBe(
        256_000,
      );
      expect(getContextLimit("onnx-community/gemma-4-E27B-it-ONNX")).toBe(
        256_000,
      );
    });

    it("should return 8k for Gemma 2 models", () => {
      expect(getContextLimit("google/gemma-2-9b-it")).toBe(8192);
    });

    it("should return 32k for Gemma 3 1B models", () => {
      expect(getContextLimit("onnx-community/gemma-3-1b-it-ONNX")).toBe(32000);
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
            content: [
              { type: "text", text: "Transcribe this" },
              {
                data: "d2F2",
                fileName: "speech.wav",
                mediaType: "audio",
                mimeType: "audio/wav",
                type: "attachment",
              },
            ],
            role: "user",
          },
        ],
        [],
        { model: "openai/gpt-4o-audio-preview", maxTokens: 1024, system: "" },
      );

      expect(result.messages[0].content[1]).toEqual({
        input_audio: { data: "d2F2", format: "wav" },
        type: "input_audio",
      });
    });

    it("should fall back to text for audio when model has no audio capability", () => {
      const result = formatRequest(
        mockProvider,
        [
          {
            content: [
              {
                data: "bXAz",
                fileName: "note.mp3",
                mediaType: "audio",
                mimeType: "audio/mpeg",
                type: "attachment",
              },
            ],
            role: "user",
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
        supportsDocumentInput: true,
        supportsImageInput: true,
      });

      const result = formatRequest(
        mockProvider,
        [
          {
            content: [
              { type: "text", text: "Summarise this PDF" },
              {
                data: "cGRm",
                fileName: "report.pdf",
                mediaType: "document",
                mimeType: "application/pdf",
                type: "attachment",
              },
            ],
            role: "user",
          },
        ],
        [],
        { model: "claude-3-5-sonnet-20241022", maxTokens: 4096, system: "" },
      );

      expect(result.messages[0].content[1]).toEqual({
        source: { type: "base64", media_type: "application/pdf", data: "cGRm" },
        type: "document",
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
                data: "cGRm",
                fileName: "old.pdf",
                mediaType: "document",
                mimeType: "application/pdf",
                type: "attachment",
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
