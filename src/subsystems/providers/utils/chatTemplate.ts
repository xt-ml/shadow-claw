import { Template } from "@huggingface/jinja";
import { modelRegistry } from "../model-registry.js";
import { createModelCacheFetch } from "./createModelCacheFetch.js";

export interface TokenizerConfig {
  chat_template?: string | Record<string, string>;
  bos_token?: string | { content: string };
  eos_token?: string | { content: string };
  pad_token?: string | { content: string };
  unk_token?: string | { content: string };
  [key: string]: any;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "model" | "tool";
  content: string | any[];
  tool_calls?: any[];
  [key: string]: any;
}

export interface NormalizedChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: any[];
  [key: string]: any;
}

export interface RenderChatTemplateOptions {
  modelName?: string;
  template?: string | Record<string, string>;
  messages: any[];
  systemPrompt?: string;
  tools?: any[];
  documents?: any[];
  addGenerationPrompt?: boolean;
  bosToken?: string;
  eosToken?: string;
  padToken?: string;
  unkToken?: string;
  customFetch?: typeof fetch;
}

/**
 * Universal default ChatML template used when an uncached model is accessed offline
 * or when no model-specific Jinja template is available.
 */
export const DEFAULT_CHAT_TEMPLATE = `{%- for message in messages -%}
{{- '<|im_start|>' + message.role + '\n' + message.content + '<|im_end|>\n' -}}
{%- endfor -%}
{%- if add_generation_prompt -%}
{{- '<|im_start|>assistant\n' -}}
{%- endif -%}`;

const tokenizerConfigCache = new Map<string, TokenizerConfig>();
const compiledTemplateCache = new Map<string, Template>();

/**
 * Clears in-memory tokenizer config and compiled template caches (primarily for tests).
 */
export function clearTokenizerConfigCache(): void {
  tokenizerConfigCache.clear();
  compiledTemplateCache.clear();
}

/**
 * Extract plain text string from a message content field (string or block array).
 */
export function extractContentText(content: any): string {
  if (typeof content === "string") {
    return content;
  }
  if (!content) {
    return "";
  }
  if (Array.isArray(content)) {
    return content
      .map((block: any) => {
        if (!block) return "";
        if (typeof block === "string") return block;
        if (block.type === "text") return block.text || block.value || "";
        if (block.type === "tool_use") {
          return `[TOOL_CALL ${block.name}] ${JSON.stringify(block.input || {})}`;
        }
        if (block.type === "tool_result") {
          const res =
            typeof block.content === "string"
              ? block.content
              : JSON.stringify(block.content || "");
          return `[TOOL_RESULT ${block.tool_use_id || ""}] ${res}`;
        }
        if (block.type === "attachment") {
          return `[ATTACHMENT ${block.mediaType || "file"}] ${block.fileName || "attachment"}`;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  if (typeof content === "object") {
    return JSON.stringify(content);
  }
  return String(content);
}

/**
 * Dynamically fetch tokenizer_config.json for a given model from Hugging Face or persistent CacheStorage.
 */
export async function fetchTokenizerConfig(
  modelName: string,
  customFetch?: typeof fetch,
): Promise<TokenizerConfig | null> {
  const cleanModel = String(modelName || "").trim();
  if (!cleanModel) {
    return null;
  }

  if (tokenizerConfigCache.has(cleanModel)) {
    return tokenizerConfigCache.get(cleanModel)!;
  }

  const baseFetch =
    customFetch ||
    (typeof globalThis.fetch === "function"
      ? globalThis.fetch.bind(globalThis)
      : undefined);

  if (!baseFetch) {
    return null;
  }

  // Use disk-backed model cache fetch if no custom fetch function is explicitly passed
  const fetchFn = customFetch || createModelCacheFetch(baseFetch);
  const url = `https://huggingface.co/${encodeURI(cleanModel)}/resolve/main/tokenizer_config.json`;

  try {
    const res = await fetchFn(url);
    if (res.ok) {
      const config: TokenizerConfig = await res.json();
      if (config && typeof config === "object") {
        // If tokenizer_config.json does not contain chat_template, check for standalone chat_template.jinja
        if (!config.chat_template) {
          try {
            const jinjaUrl = `https://huggingface.co/${encodeURI(cleanModel)}/resolve/main/chat_template.jinja`;
            const jinjaRes = await fetchFn(jinjaUrl);
            if (jinjaRes.ok) {
              const jinjaText = await jinjaRes.text();
              if (jinjaText && jinjaText.trim()) {
                config.chat_template = jinjaText.trim();
              }
            }
          } catch {
            // Ignore standalone jinja fetch failures
          }
        }

        if (
          typeof config.model_max_length === "number" &&
          Number.isFinite(config.model_max_length) &&
          config.model_max_length > 0 &&
          config.model_max_length <= 2_097_152
        ) {
          const existing = modelRegistry.getModelInfo(cleanModel);
          modelRegistry.registerModelInfo(cleanModel, {
            contextWindow: config.model_max_length,
            maxOutput: existing?.maxOutput ?? null,
            ...(existing || {}),
          });
        }

        tokenizerConfigCache.set(cleanModel, config);
        return config;
      }
    }
  } catch (err) {
    // Network or parse error
  }

  return null;
}

/**
 * Map tools to the standard OpenAI/Transformers function format.
 */
export function mapToolsForChatTemplate(tools?: any[]): any[] | undefined {
  if (!tools || !Array.isArray(tools) || tools.length === 0) {
    return undefined;
  }

  return tools.map((t) => {
    if (t.type === "function" && t.function) {
      return t;
    }
    return {
      type: "function",
      function: {
        name: t.name,
        description: t.description || "",
        parameters: t.input_schema ||
          t.parameters || { type: "object", properties: {} },
      },
    };
  });
}

/**
 * Normalizes messages to ensure compliance with strict chat template requirements:
 * 1. Consolidates system prompt into a single initial system message.
 * 2. Merges adjacent messages of identical role (e.g. consecutive user turns).
 * 3. Ensures strict user -> assistant -> user alternation.
 * 4. Ensures first turn after system is a user message.
 */
export function normalizeMessagesForChatTemplate(
  rawMessages: any[],
  systemPrompt?: string,
): NormalizedChatMessage[] {
  let combinedSystemText = String(systemPrompt || "").trim();
  const nonSystem: Array<{
    role: "user" | "assistant" | "tool";
    content: string;
    tool_calls?: any[];
  }> = [];

  for (const msg of rawMessages) {
    if (!msg) continue;
    const rawRole = String(msg.role || "user").toLowerCase();
    const contentText = extractContentText(msg.content);

    if (rawRole === "system") {
      combinedSystemText = combinedSystemText
        ? `${combinedSystemText}\n\n${contentText}`
        : contentText;
    } else if (rawRole === "tool") {
      nonSystem.push({ role: "tool", content: contentText });
    } else if (rawRole === "assistant" || rawRole === "model") {
      nonSystem.push({
        role: "assistant",
        content: contentText,
        ...(msg.tool_calls ? { tool_calls: msg.tool_calls } : {}),
      });
    } else {
      nonSystem.push({ role: "user", content: contentText });
    }
  }

  // Merge consecutive messages with the same role
  const merged: Array<{
    role: "user" | "assistant" | "tool";
    content: string;
    tool_calls?: any[];
  }> = [];
  for (const msg of nonSystem) {
    if (
      merged.length > 0 &&
      merged[merged.length - 1].role === msg.role &&
      msg.role !== "tool"
    ) {
      const prev = merged[merged.length - 1];
      prev.content = prev.content
        ? `${prev.content}\n\n${msg.content}`
        : msg.content;
      if (msg.tool_calls) {
        prev.tool_calls = [...(prev.tool_calls || []), ...msg.tool_calls];
      }
    } else {
      merged.push({ ...msg });
    }
  }

  // If conversation starts with an assistant message, insert an initial user prompt
  if (merged.length > 0 && merged[0].role === "assistant") {
    merged.unshift({ role: "user", content: "Hello" });
  }

  // If conversation is completely empty, provide a default user turn
  if (merged.length === 0 && !combinedSystemText) {
    merged.push({ role: "user", content: "Hello" });
  }

  const result: NormalizedChatMessage[] = [];
  if (combinedSystemText) {
    result.push({ role: "system", content: combinedSystemText });
  }
  result.push(...merged);

  return result;
}

/**
 * Render dynamic Jinja2 chat template for messages, tools, and options.
 */
export async function renderChatTemplate(
  options: RenderChatTemplateOptions,
): Promise<string> {
  const {
    modelName = "",
    messages,
    systemPrompt,
    tools,
    documents,
    addGenerationPrompt = true,
    customFetch,
  } = options;

  let templateStr: string | null = null;

  if (typeof options.template === "string") {
    templateStr = options.template;
  } else if (options.template && typeof options.template === "object") {
    if (tools && tools.length > 0 && "tool_use" in options.template) {
      templateStr = (options.template as Record<string, string>)["tool_use"];
    } else if ("default" in options.template) {
      templateStr = (options.template as Record<string, string>)["default"];
    }
  }

  let bosToken = options.bosToken;
  let eosToken = options.eosToken;

  if (!templateStr && modelName) {
    const config = await fetchTokenizerConfig(modelName, customFetch);
    if (config) {
      if (typeof config.chat_template === "string") {
        templateStr = config.chat_template;
      } else if (
        config.chat_template &&
        typeof config.chat_template === "object"
      ) {
        if (tools && tools.length > 0 && "tool_use" in config.chat_template) {
          templateStr = config.chat_template["tool_use"];
        } else if ("default" in config.chat_template) {
          templateStr = config.chat_template["default"];
        }
      }
      if (!bosToken && config.bos_token) {
        bosToken =
          typeof config.bos_token === "string"
            ? config.bos_token
            : config.bos_token.content;
      }
      if (!eosToken && config.eos_token) {
        eosToken =
          typeof config.eos_token === "string"
            ? config.eos_token
            : config.eos_token.content;
      }
    }
  }

  // Universal fallback template if still not found
  if (!templateStr) {
    templateStr = DEFAULT_CHAT_TEMPLATE;
  }

  const normalized = normalizeMessagesForChatTemplate(messages, systemPrompt);
  const mappedTools = mapToolsForChatTemplate(tools);

  let compiled = compiledTemplateCache.get(templateStr);
  if (!compiled) {
    compiled = new Template(templateStr);
    compiledTemplateCache.set(templateStr, compiled);
  }

  return compiled.render({
    messages: normalized,
    tools: mappedTools,
    documents: documents || null,
    add_generation_prompt: addGenerationPrompt,
    bos_token: bosToken || "",
    eos_token: eosToken || "",
    pad_token: options.padToken || "",
    unk_token: options.unkToken || "",
  });
}
