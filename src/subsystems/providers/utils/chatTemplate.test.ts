import fs from "node:fs";
import { jest } from "@jest/globals";
import { modelRegistry } from "../model-registry.js";
import { TOOL_DEFINITIONS } from "../../tools/tools.js";
import {
  fetchTokenizerConfig,
  clearTokenizerConfigCache,
  mapToolsForChatTemplate,
  normalizeMessagesForChatTemplate,
  renderChatTemplate,
  DEFAULT_CHAT_TEMPLATE,
} from "./chatTemplate.js";

describe("chatTemplate", () => {
  beforeEach(() => {
    clearTokenizerConfigCache();
    modelRegistry.clear();
  });

  describe("normalizeMessagesForChatTemplate", () => {
    it("places system prompt at index 0 and alternates turns", () => {
      const raw = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
        { role: "user", content: "How are you?" },
      ];
      const normalized = normalizeMessagesForChatTemplate(
        raw,
        "You are a helpful assistant.",
      );
      expect(normalized).toEqual([
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
        { role: "user", content: "How are you?" },
      ]);
    });

    it("merges consecutive messages of the same role to prevent Jinja alternation errors", () => {
      const raw = [
        { role: "system", content: "System 1" },
        { role: "system", content: "System 2" },
        { role: "user", content: "User 1" },
        { role: "user", content: "User 2" },
        { role: "assistant", content: "Assistant 1" },
        { role: "assistant", content: "Assistant 2" },
        { role: "user", content: "User 3" },
      ];
      const normalized = normalizeMessagesForChatTemplate(raw);
      expect(normalized).toEqual([
        { role: "system", content: "System 1\n\nSystem 2" },
        { role: "user", content: "User 1\n\nUser 2" },
        { role: "assistant", content: "Assistant 1\n\nAssistant 2" },
        { role: "user", content: "User 3" },
      ]);
    });

    it("prepends user message if first non-system message is assistant", () => {
      const raw = [{ role: "assistant", content: "I am ready." }];
      const normalized = normalizeMessagesForChatTemplate(raw, "System");
      expect(normalized).toEqual([
        { role: "system", content: "System" },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "I am ready." },
      ]);
    });

    it("handles block array content properly", () => {
      const raw = [
        {
          role: "user",
          content: [
            { type: "text", text: "Read this:" },
            {
              type: "attachment",
              fileName: "notes.txt",
              mediaType: "text/plain",
            },
          ],
        },
      ];
      const normalized = normalizeMessagesForChatTemplate(raw);
      expect(normalized).toHaveLength(1);
      expect(normalized[0].role).toBe("user");
      expect(normalized[0].content).toContain("Read this:");
      expect(normalized[0].content).toContain(
        "[ATTACHMENT text/plain] notes.txt",
      );
    });

    it("preserves tool_call_id and resolves tool name on tool messages", () => {
      const raw = [
        { role: "user", content: "List files" },
        {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_abc123",
              type: "function",
              function: { name: "list_files", arguments: "{}" },
            },
          ],
        },
        {
          role: "tool",
          tool_call_id: "call_abc123",
          content: "file1.txt\nfile2.txt",
        },
      ];

      const normalized = normalizeMessagesForChatTemplate(raw);
      expect(normalized).toHaveLength(3);
      expect(normalized[1].role).toBe("assistant");
      expect(normalized[1].content).toBe("");
      expect(normalized[1].tool_calls).toHaveLength(1);
      expect(normalized[2]).toEqual({
        role: "tool",
        content: "file1.txt\nfile2.txt",
        tool_call_id: "call_abc123",
        name: "list_files",
      });
    });

    it("parses JSON string arguments to object in assistant tool_calls to prevent Jinja double-brace rendering", () => {
      const raw = [
        { role: "user", content: "read file" },
        {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_abc123",
              type: "function",
              function: {
                name: "read_file",
                arguments: '{"path":"package.json"}',
              },
            },
          ],
        },
      ];

      const normalized = normalizeMessagesForChatTemplate(raw);
      expect(normalized[1].tool_calls?.[0]?.function?.arguments).toEqual({
        path: "package.json",
      });
    });

    it("normalizes Anthropic-style tool_use in assistant and tool_result in user message", () => {
      const raw = [
        { role: "user", content: "list files in database" },
        {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "call_123",
              name: "list_files",
              input: { path: "database" },
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "call_123",
              name: "list_files",
              content: "agent.db",
            },
          ],
        },
      ];

      const normalized = normalizeMessagesForChatTemplate(raw);
      expect(normalized).toHaveLength(3);
      expect(normalized[0]).toEqual({
        role: "user",
        content: "list files in database",
      });
      expect(normalized[1].role).toBe("assistant");
      expect(normalized[1].tool_calls).toHaveLength(1);
      expect(normalized[1].tool_calls?.[0]).toEqual({
        id: "call_123",
        type: "function",
        function: {
          name: "list_files",
          arguments: { path: "database" },
        },
      });
      expect(normalized[2]).toEqual({
        role: "tool",
        content: "agent.db",
        tool_call_id: "call_123",
        name: "list_files",
      });
    });
  });

  describe("fetchTokenizerConfig", () => {
    it("fetches tokenizer_config.json dynamically when customFetch is provided", async () => {
      const mockFetch = (jest.fn() as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          chat_template:
            "{{ bos_token }}[CUSTOM]{% for m in messages %}{{ m.role }}: {{ m.content }}\n{% endfor %}",
          bos_token: "<custom_bos>",
          eos_token: "<custom_eos>",
        }),
      });

      const config = await fetchTokenizerConfig("custom/test-model", mockFetch);
      expect(config?.bos_token).toBe("<custom_bos>");
      expect(config?.eos_token).toBe("<custom_eos>");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://huggingface.co/custom/test-model/resolve/main/tokenizer_config.json",
      );

      // Subsequent call uses cache
      const cachedConfig = await fetchTokenizerConfig(
        "custom/test-model",
        mockFetch,
      );
      expect(cachedConfig).toBe(config);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("registers model_max_length in modelRegistry when present", async () => {
      const mockFetch = (jest.fn() as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          chat_template:
            "{{ bos_token }}{% for m in messages %}{{ m.content }}{% endfor %}",
          bos_token: "<bos>",
          eos_token: "<eos>",
          model_max_length: 131072,
        }),
      });

      await fetchTokenizerConfig("onnx-community/Qwen3-0.6B-ONNX", mockFetch);

      const registered = modelRegistry.getModelInfo(
        "onnx-community/Qwen3-0.6B-ONNX",
      );
      expect(registered).not.toBeNull();
      expect(registered?.contextWindow).toBe(131072);
    });

    it("fetches chat_template.jinja if chat_template is missing in tokenizer_config.json", async () => {
      const mockFetch = (jest.fn() as any).mockImplementation(
        async (url: string) => {
          if (url.includes("tokenizer_config.json")) {
            return {
              ok: true,
              json: async () => ({
                bos_token: "<s>",
                eos_token: "</s>",
              }),
            };
          }
          if (url.includes("chat_template.jinja")) {
            return {
              ok: true,
              text: async () =>
                "{{ bos_token }}{% for m in messages %}{{ m.content }}{% endfor %}",
            };
          }
          return { ok: false, status: 404 };
        },
      );

      const config = await fetchTokenizerConfig(
        "model/with-separate-jinja",
        mockFetch,
      );
      expect(config?.chat_template).toBe(
        "{{ bos_token }}{% for m in messages %}{{ m.content }}{% endfor %}",
      );
      expect(config?.bos_token).toBe("<s>");
    });

    it("returns null if modelName is empty or fetch fails completely", async () => {
      expect(await fetchTokenizerConfig("")).toBeNull();

      const failingFetch = (jest.fn() as any).mockRejectedValue(
        new Error("Network offline"),
      );
      const config = await fetchTokenizerConfig("offline/model", failingFetch);
      expect(config).toBeNull();
    });
  });

  describe("renderChatTemplate", () => {
    it("renders dynamically fetched template with system and user messages", async () => {
      const mockFetch = (jest.fn() as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          chat_template:
            "{{ bos_token }}{% for message in messages %}<start>{{ message.role }}:{{ message.content }}<end>{% endfor %}{% if add_generation_prompt %}<start>model:{% endif %}",
          bos_token: "<bos>",
        }),
      });

      const rendered = await renderChatTemplate({
        modelName: "custom/dynamic-model",
        messages: [
          { role: "system", content: "System rules." },
          { role: "user", content: "Hello there!" },
        ],
        addGenerationPrompt: true,
        customFetch: mockFetch,
      });

      expect(rendered).toContain(
        "<bos><start>system:System rules.<end><start>user:Hello there!<end><start>model:",
      );
    });

    it("renders dynamically fetched template with tool signatures", async () => {
      const mockFetch = (jest.fn() as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          chat_template:
            "{% if tools %}TOOLS:{% for t in tools %}{{ t.function.name }};{% endfor %}{% endif %}{% for m in messages %}{{ m.role }}:{{ m.content }}\n{% endfor %}",
        }),
      });

      const rendered = await renderChatTemplate({
        modelName: "custom/tool-model",
        messages: [{ role: "user", content: "What is the weather?" }],
        tools: [
          {
            name: "get_weather",
            description: "Get weather for location",
            input_schema: {
              type: "object",
              properties: { location: { type: "string" } },
              required: ["location"],
            },
          },
        ],
        customFetch: mockFetch,
      });

      expect(rendered).toContain("TOOLS:get_weather;");
      expect(rendered).toContain("user:What is the weather?");
    });

    it("falls back to DEFAULT_CHAT_TEMPLATE when no template is found and fetch fails", async () => {
      expect(DEFAULT_CHAT_TEMPLATE).toContain("<|im_start|>");
      expect(DEFAULT_CHAT_TEMPLATE).toContain("<|im_end|>");

      const failingFetch = (jest.fn() as any).mockRejectedValue(
        new Error("Offline"),
      );

      const rendered = await renderChatTemplate({
        modelName: "unknown/model",
        messages: [{ role: "user", content: "Hello offline" }],
        addGenerationPrompt: true,
        customFetch: failingFetch,
      });

      expect(rendered).toContain("<|im_start|>user\nHello offline<|im_end|>");
      expect(rendered).toContain("<|im_start|>assistant\n");
    });
  });

  describe("mapToolsForChatTemplate", () => {
    it("maps shadowclaw tool format to OpenAI function schema", () => {
      const tools = [
        {
          name: "read_file",
          description: "Read a file",
          input_schema: {
            type: "object",
            properties: { path: { type: "string" } },
          },
        },
      ];
      const mapped = mapToolsForChatTemplate(tools);
      expect(mapped).toEqual([
        {
          type: "function",
          function: {
            name: "read_file",
            description: "Read a file",
            parameters: {
              type: "object",
              properties: { path: { type: "string" } },
            },
          },
        },
      ]);
    });

    it("defensively ensures all property definitions have a type and object properties have a properties map", () => {
      const tools = [
        {
          name: "git_unstage",
          description: "Unstage file",
          input_schema: {
            type: "object",
            properties: {
              repo: { type: "string" },
              filepath: {
                anyOf: [
                  { type: "string" },
                  { type: "array", items: { type: "string" } },
                ],
              },
            },
          },
        },
        {
          name: "render_component",
          description: "Render A2UI surface",
          input_schema: {
            type: "object",
            properties: {
              dataModel: {
                type: "object",
                additionalProperties: true,
              },
              value: {
                description: "untyped value",
              },
            },
          },
        },
      ];

      const mapped = mapToolsForChatTemplate(tools);
      const gitProps = mapped?.[0]?.function?.parameters?.properties;
      expect(gitProps?.filepath?.type).toBe("string");

      const a2uiProps = mapped?.[1]?.function?.parameters?.properties;
      expect(a2uiProps?.dataModel?.properties).toBeDefined();
      expect(typeof a2uiProps?.dataModel?.properties).toBe("object");
      expect(a2uiProps?.value?.type).toBe("string");
    });

    it("renders all TOOL_DEFINITIONS with Gemma 4 template without filter crashes", async () => {
      const gemma4JinjaPath =
        ".cache/assets/cache/transformers.js/onnx-community/gemma-4-E4B-it-ONNX/chat_template.jinja";
      if (!fs.existsSync(gemma4JinjaPath)) return;
      const jinja = fs.readFileSync(gemma4JinjaPath, "utf-8");

      for (const tool of TOOL_DEFINITIONS) {
        await expect(
          renderChatTemplate({
            template: jinja,
            messages: [{ role: "user", content: "test" }],
            tools: [tool],
            addGenerationPrompt: true,
          }),
        ).resolves.toBeDefined();
      }
    });

    it("renders assistant tool call without double curly braces in Gemma 4 template", async () => {
      const gemma4JinjaPath =
        ".cache/assets/cache/transformers.js/onnx-community/gemma-4-E4B-it-ONNX/chat_template.jinja";
      if (!fs.existsSync(gemma4JinjaPath)) return;
      const jinja = fs.readFileSync(gemma4JinjaPath, "utf-8");

      const rendered = await renderChatTemplate({
        template: jinja,
        messages: [
          { role: "user", content: "read file" },
          {
            role: "assistant",
            content: "",
            tool_calls: [
              {
                id: "call_abc123",
                type: "function",
                function: {
                  name: "read_file",
                  arguments: '{"path":"index.ts"}',
                },
              },
            ],
          },
        ],
        addGenerationPrompt: false,
      });

      expect(rendered).toContain('call:read_file{path:<|"|>index.ts<|"|>}');
      expect(rendered).not.toContain("call:read_file{{");
    });
  });
});
