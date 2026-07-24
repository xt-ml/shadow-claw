import { getModelAttachmentCapabilities } from "../../content/attachment-capabilities.js";
import { modelRegistry } from "./model-registry.js";
import { sanitizeModelOutput } from "../../content/chat-template-sanitizer.js";

import type { ProviderConfig } from "../../config/config.js";
import type { ToolResultContentBlock } from "../../content/types.js";

function formatAttachmentFallbackText(block: any): string {
  return `[Attachment: ${block.fileName} (${block.mimeType}) is available in chat history${block.path ? ` at ${block.path}` : ""}]`;
}

function richToolResultToText(content: ToolResultContentBlock[]): string {
  return content
    .map((block) => {
      if (block.type === "text") {
        return block.text;
      }

      if (block.type === "image") {
        return `[Image: ${block.media_type}, ${Math.ceil((block.data.length * 3) / 4)} bytes base64-encoded]`;
      }

      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function formatOpenAIToolResultContent(
  content: ToolResultContentBlock[],
  model: string,
): string | any[] {
  const canSendImages = canSendNativeImage(model);

  if (!canSendImages) {
    return richToolResultToText(content);
  }

  const blocks: any[] = [];
  for (const block of content) {
    if (block.type === "text") {
      blocks.push({ type: "text", text: block.text });
    } else if (block.type === "image") {
      blocks.push({
        type: "image_url",
        image_url: {
          url: `data:${block.media_type};base64,${block.data}`,
        },
      });
    }
  }

  return blocks;
}

function formatAnthropicToolResultContent(
  content: ToolResultContentBlock[],
  model: string,
): string | any[] {
  const canSendImages = canSendNativeImage(model);

  if (!canSendImages) {
    return richToolResultToText(content);
  }

  const blocks: any[] = [];
  for (const block of content) {
    if (block.type === "text") {
      blocks.push({ type: "text", text: block.text });
    } else if (block.type === "image") {
      blocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: block.media_type,
          data: block.data,
        },
      });
    }
  }

  return blocks;
}

function canSendNativeImage(model: string): boolean {
  const capabilities = getModelAttachmentCapabilities(model);

  return capabilities.images || capabilities.routerByFeatures;
}

function canSendNativeAudio(model: string): boolean {
  const capabilities = getModelAttachmentCapabilities(model);

  return capabilities.audio || capabilities.routerByFeatures;
}

function canSendNativeDocument(model: string): boolean {
  const capabilities = getModelAttachmentCapabilities(model);

  return capabilities.documents || capabilities.routerByFeatures;
}

/**
 * Map an audio MIME type to the format string expected by OpenAI's input_audio.
 */
function mimeTypeToAudioFormat(mimeType: string): string {
  const m = mimeType.toLowerCase();
  if (m.includes("wav")) {
    return "wav";
  }

  if (m.includes("flac")) {
    return "flac";
  }

  if (m.includes("ogg")) {
    return "ogg";
  }

  if (m.includes("aac")) {
    return "aac";
  }

  if (m.includes("webm")) {
    return "webm";
  }

  if (m.includes("mp4")) {
    return "mp4";
  }

  // audio/mpeg covers mp3

  return "mp3";
}

function mapOpenAiUserContent(blocks: any[], model: string): any[] {
  const content: any[] = [];
  const canSendImages = canSendNativeImage(model);

  for (const block of blocks) {
    if (block?.type === "text") {
      content.push({ type: "text", text: block.text || "" });

      continue;
    }

    if (block?.type === "attachment") {
      if (
        block.mediaType === "image" &&
        typeof block.data === "string" &&
        block.data &&
        canSendImages
      ) {
        content.push({
          type: "image_url",
          image_url: {
            url: `data:${block.mimeType};base64,${block.data}`,
          },
        });
      } else if (
        block.mediaType === "audio" &&
        typeof block.data === "string" &&
        block.data &&
        canSendNativeAudio(model)
      ) {
        content.push({
          type: "input_audio",
          input_audio: {
            data: block.data,
            format: mimeTypeToAudioFormat(block.mimeType),
          },
        });
      } else {
        content.push({
          type: "text",
          text: formatAttachmentFallbackText(block),
        });
      }
    }
  }

  return content;
}

function mapAnthropicContent(blocks: any[], model: string): any[] {
  const content: any[] = [];
  const canSendImages = canSendNativeImage(model);

  for (const block of blocks) {
    if (block?.type === "text") {
      content.push({ type: "text", text: block.text || "" });

      continue;
    }

    if (block?.type === "tool_use") {
      content.push(block);

      continue;
    }

    if (block?.type === "thinking") {
      content.push({
        type: "thinking",
        thinking: block.thinking || "",
        ...(typeof block.signature === "string" && {
          signature: block.signature,
        }),
      });

      continue;
    }

    if (block?.type === "redacted_thinking") {
      content.push({
        type: "redacted_thinking",
        data: block.data || "",
      });

      continue;
    }

    if (block?.type === "tool_result") {
      if (Array.isArray(block.content)) {
        content.push({
          ...block,
          content: formatAnthropicToolResultContent(block.content, model),
        });
      } else {
        content.push(block);
      }

      continue;
    }

    if (block?.type === "attachment") {
      if (
        block.mediaType === "image" &&
        typeof block.data === "string" &&
        block.data &&
        canSendImages
      ) {
        content.push({
          type: "image",
          source: {
            type: "base64",
            media_type: block.mimeType,
            data: block.data,
          },
        });
      } else if (
        block.mediaType === "document" &&
        typeof block.data === "string" &&
        block.data &&
        canSendNativeDocument(model)
      ) {
        content.push({
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: block.data,
          },
        });
      } else {
        content.push({
          type: "text",
          text: formatAttachmentFallbackText(block),
        });
      }
    }
  }

  return content;
}

/**
 * Prepare API headers for a specific provider
 */
export function buildHeaders(provider: ProviderConfig, apiKey: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...provider.headers,
  };

  // Add API key with provider-specific formatting
  if (provider.apiKeyHeaderFormat) {
    headers[provider.apiKeyHeader] = provider.apiKeyHeaderFormat.replace(
      "{key}",
      apiKey,
    );
  } else {
    headers[provider.apiKeyHeader] = apiKey;
  }

  return headers;
}

/**
 * Base class for provider adapters
 */
class BaseAdapter {
  provider: ProviderConfig;

  constructor(provider: ProviderConfig) {
    this.provider = provider;
  }

  formatRequest(
    _messages: any[],
    _tools: any[],
    _options: {
      model: string;
      maxTokens: number;
      system: string;
      contextCompression?: boolean;
      reasoning?: {
        effort?: string;
        max_tokens?: number;
        exclude?: boolean;
        enabled?: boolean;
      };
    },
  ): any {
    throw new Error("Not implemented");
  }

  parseResponse(_response: any): any {
    throw new Error("Not implemented");
  }
}

/**
 * Adapter for OpenAI compatible format
 */
class OpenAIAdapter extends BaseAdapter {
  formatRequest(
    messages: any[],
    tools: any[],
    options: {
      model: string;
      maxTokens: number;
      system: string;
      contextCompression?: boolean;
      reasoning?: {
        effort?: string;
        max_tokens?: number;
        exclude?: boolean;
        enabled?: boolean;
      };
    },
  ): any {
    const { model, maxTokens, system, contextCompression, reasoning } = options;
    const openaiMessages: any[] = [];

    if (system) {
      openaiMessages.push({ role: "system", content: system });
    }

    for (const msg of messages) {
      if (msg.role === "system") {
        if (system) {
          continue;
        }

        openaiMessages.push(msg);

        continue;
      }

      if (msg.role === "assistant" && Array.isArray(msg.content)) {
        const textContent = msg.content
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("\n");
        const toolUses = msg.content.filter((b) => b.type === "tool_use");

        const resultMsg: {
          role: string;
          content: string | null;
          tool_calls?: any[];
        } = {
          role: "assistant",
          content: textContent || null,
        };

        if (toolUses.length > 0) {
          resultMsg.tool_calls = toolUses.map((toolUse) => ({
            id: toolUse.id,
            type: "function",
            function: {
              name: toolUse.name,
              arguments: JSON.stringify(toolUse.input),
            },
          }));
        }

        openaiMessages.push(resultMsg);

        continue;
      }

      if (msg.role === "user" && Array.isArray(msg.content)) {
        const toolResults = msg.content.filter((b) => b.type === "tool_result");
        const contentBlocks = mapOpenAiUserContent(msg.content, model);
        const textContent = contentBlocks
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("\n");

        if (toolResults.length === 0) {
          if (contentBlocks.length > 0) {
            openaiMessages.push({ role: "user", content: contentBlocks });
          }

          continue;
        }

        if (textContent) {
          openaiMessages.push({ role: "user", content: textContent });
        }

        for (const toolResult of toolResults) {
          let toolContent: string | any[];
          if (typeof toolResult.content === "string") {
            toolContent = toolResult.content;
          } else if (Array.isArray(toolResult.content)) {
            toolContent = formatOpenAIToolResultContent(
              toolResult.content,
              model,
            );
          } else {
            toolContent = JSON.stringify(toolResult.content);
          }

          openaiMessages.push({
            role: "tool",
            tool_call_id: toolResult.tool_use_id,
            content: toolContent,
          });
        }

        continue;
      }

      openaiMessages.push(msg);
    }

    const modelInfo = modelRegistry.getModelInfo(model);
    const shouldSendTools =
      this.provider.id !== "ollama" || modelInfo?.supportsTools !== false;

    const openaiTools = shouldSendTools
      ? tools?.map((tool) => ({
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.input_schema,
          },
        })) || []
      : [];

    const payload: any = {
      model,
      max_tokens: maxTokens,
      messages: openaiMessages,
      ...(openaiTools.length > 0 && { tools: openaiTools }),
    };

    // Legacy short model IDs (for example "gpt-4o-mini") may require provider
    // routing hints on some Azure-backed gateways. Canonical GitHub Models IDs
    // are namespaced (for example "openai/gpt-4.1") and should not include it.
    if (
      (this.provider.id === "copilot_azure_openai_proxy" ||
        this.provider.id === "github_models") &&
      typeof model === "string" &&
      !model.includes("/")
    ) {
      payload.provider = "azureml";
    }

    // Ollama defaults many models to a 4096 runtime context unless num_ctx is
    // explicitly requested. Reuse discovered model metadata when available.
    if (this.provider.id === "ollama") {
      if (modelInfo?.contextWindow && modelInfo.contextWindow > 0) {
        payload.options = {
          ...(payload.options || {}),
          num_ctx: modelInfo.contextWindow,
        };
      }
    }

    if (this.provider.id === "openrouter" && contextCompression) {
      payload.plugins = [
        {
          id: "context-compression",
          enabled: true,
        },
      ];
    }

    if (
      (this.provider.reasoningParam === "reasoning" ||
        this.provider.reasoningParam === "thinkingConfig") &&
      reasoning
    ) {
      payload.reasoning = reasoning;
    }

    return payload;
  }

  parseResponse(response: any): any {
    const choice = response.choices?.[0];
    if (!choice) {
      throw new Error("No choices in OpenAI response");
    }

    const { message, finish_reason } = choice;
    const content: any[] = [];
    let stopReason = "end_turn";

    // Text content
    if (typeof message.content === "string" && message.content) {
      const cleaned = sanitizeModelOutput(message.content, "openai");
      if (cleaned) {
        content.push({ type: "text", text: cleaned });
      }
    }

    // Tool calls (The Fix)
    if (message.tool_calls && Array.isArray(message.tool_calls)) {
      stopReason = "tool_use";
      for (const toolCall of message.tool_calls) {
        let toolInput;
        try {
          toolInput =
            typeof toolCall.function.arguments === "string"
              ? JSON.parse(toolCall.function.arguments)
              : toolCall.function.arguments;
        } catch (e) {
          console.error("Failed to parse tool arguments:", e);
          toolInput = {};
        }

        content.push({
          type: "tool_use",
          id: toolCall.id || `call_${Date.now()}_${Math.random()}`,
          name: toolCall.function.name,
          input: toolInput,
        });
      }
    }

    if (finish_reason === "tool_calls") {
      stopReason = "tool_use";
    }

    return {
      content,
      stop_reason: stopReason,
      usage: {
        input_tokens: response.usage?.prompt_tokens || 0,
        output_tokens: response.usage?.completion_tokens || 0,
      },
    };
  }
}

/**
 * Adapter for Anthropic Messages API format (used by Bedrock proxy)
 */
class AnthropicAdapter extends BaseAdapter {
  formatRequest(
    messages: any[],
    tools: any[],
    options: {
      model: string;
      maxTokens: number;
      system: string;
      contextCompression?: boolean;
      reasoning?: {
        effort?: string;
        max_tokens?: number;
        exclude?: boolean;
        enabled?: boolean;
      };
    },
  ): any {
    const { model, maxTokens, system, reasoning } = options;

    // Messages are already in Anthropic format internally.
    // Filter out system messages (system is passed separately).
    const filteredMessages = messages
      .filter((msg) => msg.role !== "system")
      .map((msg) => {
        if (!Array.isArray(msg.content)) {
          return msg;
        }

        return {
          ...msg,
          content: mapAnthropicContent(msg.content, model),
        };
      });

    const anthropicTools =
      tools?.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.input_schema,
      })) || [];

    const request: any = {
      model,
      max_tokens: maxTokens,
      ...(system && { system }),
      messages: filteredMessages,
      ...(anthropicTools.length > 0 && { tools: anthropicTools }),
    };

    if (
      this.provider.reasoningParam === "thinking" &&
      reasoning?.max_tokens &&
      Number.isFinite(reasoning.max_tokens)
    ) {
      request.thinking = {
        type: "enabled",
        budget_tokens: Math.max(1024, Math.floor(reasoning.max_tokens)),
      };
    } else if (
      this.provider.reasoningParam === "thinking" &&
      typeof reasoning?.effort === "string"
    ) {
      const ratio = effortToAnthropicBudgetRatio(reasoning.effort);
      if (ratio > 0) {
        request.thinking = {
          type: "enabled",
          budget_tokens: Math.max(1024, Math.floor(maxTokens * ratio)),
        };
      }
    }

    return request;
  }

  parseResponse(response: any): any {
    // Anthropic/Bedrock responses are already in the internal format

    const cleanedContent = Array.isArray(response.content)
      ? response.content
          .map((block: any) => {
            if (block?.type !== "text" || typeof block?.text !== "string") {
              return block;
            }

            return {
              ...block,
              text: sanitizeModelOutput(block.text, "anthropic"),
            };
          })
          .filter((block: any) =>
            block?.type === "text"
              ? typeof block.text === "string" && block.text.length > 0
              : true,
          )
      : [];

    return {
      content: cleanedContent,
      stop_reason: response.stop_reason || "end_turn",
      usage: {
        input_tokens: response.usage?.input_tokens || 0,
        output_tokens: response.usage?.output_tokens || 0,
      },
    };
  }
}

function mapGoogleContent(content: any[], _model: string): any[] {
  return content
    .map((block) => {
      if (block.type === "text") {
        return { text: block.text };
      }

      if (block.type === "image_url") {
        const url = block.image_url.url;
        if (url.startsWith("data:")) {
          const match = url.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            return {
              inlineData: {
                mimeType: match[1],
                data: match[2],
              },
            };
          }
        }
      }

      if (
        block.type === "document_url" ||
        block.type === "audio_url" ||
        block.type === "video_url"
      ) {
        const urlKey = block.type;
        const url = block[urlKey]?.url;
        if (url?.startsWith("data:")) {
          const match = url.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            return {
              inlineData: {
                mimeType: match[1],
                data: match[2],
              },
            };
          }
        }
      }

      if (block.type === "tool_use") {
        return {
          functionCall: {
            name: block.name,
            args: block.input || {},
          },
        };
      }

      if (block.type === "tool_result") {
        let resultContent: string;
        if (typeof block.content === "string") {
          resultContent = block.content;
        } else if (Array.isArray(block.content)) {
          resultContent = richToolResultToText(block.content);
        } else if (typeof block.output === "string") {
          resultContent = block.output;
        } else {
          resultContent = JSON.stringify(block.output ?? block.content ?? "");
        }

        return {
          functionResponse: {
            name: block.name,
            response: { result: resultContent },
          },
        };
      }

      return { text: "" };
    })
    .filter(Boolean);
}

/**
 * Adapter for Google Gemini format
 */
class GoogleAdapter extends BaseAdapter {
  formatRequest(
    messages: any[],
    tools: any[],
    options: {
      model: string;
      maxTokens: number;
      system: string;
      contextCompression?: boolean;
      reasoning?: {
        effort?: string;
        max_tokens?: number;
        exclude?: boolean;
        enabled?: boolean;
      };
    },
  ): any {
    const { model, maxTokens, system } = options;

    const contents = messages
      .filter((msg) => msg.role !== "system")
      .map((msg) => {
        return {
          role:
            msg.role === "assistant"
              ? "model"
              : msg.role === "tool"
                ? "function"
                : "user",
          parts: Array.isArray(msg.content)
            ? mapGoogleContent(msg.content, model)
            : [{ text: msg.content || "" }],
        };
      });

    const googleTools =
      tools?.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      })) || [];

    return {
      contents,
      ...(system && {
        system_instruction: {
          parts: [{ text: system }],
        },
      }),
      generationConfig: {
        maxOutputTokens: maxTokens,
      },
      ...(googleTools.length > 0 && {
        tools: [{ function_declarations: googleTools }],
      }),
    };
  }

  parseResponse(response: any): any {
    const candidate = response.candidates?.[0];
    if (!candidate) {
      throw new Error("No candidates in Gemini response");
    }

    const content: any[] = [];
    let stopReason = "end_turn";

    if (candidate.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.text) {
          const cleaned = sanitizeModelOutput(part.text, "openai");
          if (cleaned) {
            content.push({ type: "text", text: cleaned });
          }
        }

        if (part.functionCall) {
          stopReason = "tool_use";
          content.push({
            type: "tool_use",
            id: `call_${Date.now()}_${Math.random()}`,
            name: part.functionCall.name,
            input: part.functionCall.args || {},
          });
        }
      }
    }

    if (candidate.finishReason === "SAFETY") {
      throw new Error("Gemini response blocked by safety filters");
    }

    return {
      content,
      stop_reason: stopReason,
      usage: {
        input_tokens: response.usageMetadata?.promptTokenCount || 0,
        output_tokens: response.usageMetadata?.candidatesTokenCount || 0,
      },
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Mesh LLM Adapter
// Mesh LLM uses a non-standard response format:
//   - Thought blocks: <|channel>thought ... <channel|>
//   - Tool calls:     <|tool_call>call:toolName{...json...}<tool_call|>
//
// Request formatting reuses the standard OpenAI path since Mesh LLM accepts
// standard /v1/chat/completions requests.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strip Mesh LLM thought-channel blocks: <|channel>thought ... <channel|>
 */
function stripMeshLlmThoughtBlocks(text: string): string {
  // <|channel>thought ... <channel|>

  return text
    .replace(/<\|channel>[\s\S]*?<channel\|>/g, "")
    .replace(/^[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Parse Mesh LLM tool calls out of text content.
 *
 * Format: <|tool_call>call:toolName{...json...}<tool_call|>
 *
 * Returns { toolBlocks, residualText } where residualText is the text
 * with all tool call blocks removed.
 */
function parseMeshLlmToolCalls(text: string): {
  toolBlocks: Array<{
    type: "tool_use";
    id: string;
    name: string;
    input: Record<string, any>;
  }>;
  residualText: string;
} {
  const TOOL_CALL_RE =
    /<\|tool_call>call:([a-zA-Z_][a-zA-Z0-9_]*)(\{[\s\S]*?\})?<tool_call\|>/g;
  const toolBlocks: Array<{
    type: "tool_use";
    id: string;
    name: string;
    input: Record<string, any>;
  }> = [];

  const residualText = text.replace(TOOL_CALL_RE, (_, name, rawJson) => {
    let input: Record<string, any> = {};
    if (rawJson) {
      try {
        const parsed = JSON.parse(rawJson);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          input = parsed;
        }
      } catch {
        // Malformed JSON — use empty input
      }
    }

    toolBlocks.push({
      type: "tool_use",
      id: `mesh_llm_call_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      name,
      input,
    });

    return "";
  });

  return {
    toolBlocks,
    residualText: residualText
      .replace(/^[ \t]+$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  };
}

/**
 * Post-process a finalized Mesh LLM result (from either non-streaming or
 * streaming path) to strip thought blocks and convert inline tool call
 * syntax to the internal tool_use format.
 *
 * Exported so that `handleInvoke` can apply the same transformation after
 * the `StreamAccumulator` finalizes a streaming response.
 */
export function normalizeMeshLlmResult(result: any): any {
  if (!result || !Array.isArray(result.content)) {
    return result;
  }

  const processedContent: any[] = [];
  let hasToolCalls = false;

  for (const block of result.content) {
    if (block.type !== "text") {
      processedContent.push(block);

      continue;
    }

    // 1. Strip thought blocks
    const withoutThoughts = stripMeshLlmThoughtBlocks(block.text);

    // 2. Parse inline tool calls
    const { toolBlocks, residualText } = parseMeshLlmToolCalls(withoutThoughts);

    if (residualText) {
      processedContent.push({ type: "text", text: residualText });
    }

    if (toolBlocks.length > 0) {
      hasToolCalls = true;
      processedContent.push(...toolBlocks);
    }
  }

  return {
    ...result,
    content: processedContent,
    stop_reason:
      hasToolCalls || result.stop_reason === "tool_use"
        ? "tool_use"
        : result.stop_reason,
  };
}

/**
 * Adapter for Mesh LLM — uses standard OpenAI request format but applies
 * custom response parsing to handle Mesh LLM's proprietary token syntax.
 */
class MeshLlmAdapter extends OpenAIAdapter {
  parseResponse(response: any): any {
    // First, run the base OpenAI parse to get text + any standard tool_calls
    const base = super.parseResponse(response);

    return normalizeMeshLlmResult(base);
  }
}

/**
 * Map of format string to Adapter class
 */
const ADAPTER_MAP: Record<string, typeof BaseAdapter> = {
  openai: OpenAIAdapter,
  anthropic: AnthropicAdapter,
  google: GoogleAdapter,
  "mesh-llm": MeshLlmAdapter,
};

/**
 * Get the adapter for a given provider
 */
export function getAdapter(provider: ProviderConfig): BaseAdapter {
  const AdapterClass = ADAPTER_MAP[provider.format];
  if (!AdapterClass) {
    throw new Error(`Unsupported provider format: ${provider.format}`);
  }

  return new AdapterClass(provider);
}

/**
 * Convert message format
 */
export function formatRequest(
  provider: ProviderConfig,
  messages: any[],
  tools: any[],
  options: {
    model: string;
    maxTokens: number;
    system: string;
    contextCompression?: boolean;
    reasoning?: {
      effort?: string;
      max_tokens?: number;
      exclude?: boolean;
      enabled?: boolean;
    };
  },
): any {
  return getAdapter(provider).formatRequest(messages, tools, options);
}

function effortToAnthropicBudgetRatio(effort: string): number {
  const normalized = effort.toLowerCase();
  if (normalized === "none") {
    return 0;
  }

  if (normalized === "max" || normalized === "xhigh") {
    return 0.95;
  }

  if (normalized === "high") {
    return 0.8;
  }

  if (normalized === "medium") {
    return 0.5;
  }

  if (normalized === "low") {
    return 0.2;
  }

  if (normalized === "minimal") {
    return 0.1;
  }

  return 0;
}

/**
 * Parse response from provider API call
 */
export function parseResponse(provider: ProviderConfig, response: any): any {
  return getAdapter(provider).parseResponse(response);
}

/**
 * Get context limit for a model
 */
export function getContextLimit(model: string): number {
  const info = modelRegistry.getModelInfo(model);
  if (info?.contextWindow) {
    return info.contextWindow;
  }

  const m = model.toLowerCase();

  // OpenAI / Azure OpenAI
  if (m.includes("gpt-4.1")) {
    return 1_047_576;
  }

  if (m.includes("gpt-5")) {
    return 400_000;
  }

  if (m.includes("gpt-4o")) {
    return 128_000;
  }

  if (m.includes("gpt-4-turbo")) {
    return 128_000;
  }

  if (m === "gpt-4" || m.startsWith("gpt-4-")) {
    return 8_192;
  }

  if (m.includes("gpt-3.5-turbo")) {
    return 16_385;
  }

  if (m.includes("gpt-3.5")) {
    return 4_096;
  }

  if (m.includes("o1") || m.includes("o3") || m.includes("o4")) {
    return 200_000;
  }

  // Anthropic / Bedrock
  if (m.includes("claude-opus-4") || m.includes("claude-sonnet-4")) {
    return 1_000_000;
  }

  if (m.includes("claude")) {
    return 200_000;
  }

  // Google Gemini
  if (m.includes("gemini-nano")) {
    return 4_096;
  }

  if (m.includes("gemini-1.5-pro")) {
    return 2_097_152;
  }

  if (
    m.includes("gemini-2.5") ||
    m.includes("gemini-2.0") ||
    m.includes("gemini-1.5")
  ) {
    return 1_048_576;
  }

  if (m.includes("gemini-1.0") || m.includes("gemini-pro")) {
    return 32_768;
  }

  if (m.includes("gemini")) {
    return 1_048_576;
  }

  // Meta Llama
  if (m.includes("llama-3.1") || m.includes("llama-3-1")) {
    return 128_000;
  }

  if (m.includes("llama-3")) {
    return 8_192;
  }

  if (m.includes("llama")) {
    return 4_096;
  }

  // Gemma family
  if (
    m.includes("gemma-4-12b") ||
    m.includes("gemma-4-26b") ||
    m.includes("gemma-4-31b") ||
    m.includes("gemma-4-e9b") ||
    m.includes("gemma-4-e27b")
  ) {
    return 256_000;
  }

  if (m.includes("gemma-4") || m.includes("gemma 4")) {
    return 128_000;
  }

  if (
    m.includes("gemma-3-4b") ||
    m.includes("gemma-3-12b") ||
    m.includes("gemma-3-27b")
  ) {
    return 128_000;
  }

  if (m.includes("gemma-3") || m.includes("gemma 3")) {
    return 32_000;
  }

  if (
    m.includes("gemma-2") ||
    m.includes("gemma-7b") ||
    m.includes("gemma-2b")
  ) {
    return 8_192;
  }

  if (m.includes("gemma")) {
    return 8_192;
  }

  // Mistral
  if (m.includes("mistral-large")) {
    return 128_000;
  }

  if (m.includes("mistral")) {
    return 32_000;
  }

  // Bedrock native
  if (m.includes("amazon.titan")) {
    return 8_192;
  }

  if (m.includes("amazon.nova-micro") || m.includes("nova-micro")) {
    return 128_000;
  }

  if (
    m.includes("amazon.nova") ||
    m.includes("nova-pro") ||
    m.includes("nova-lite")
  ) {
    return 300_000;
  }

  if (m.includes("ai21")) {
    return 8_192;
  }

  if (m.includes("cohere")) {
    return 128_000;
  }

  // Smaller local models
  if (m.includes("phi-4-mini")) {
    return 128_000;
  }

  if (m.includes("phi-4")) {
    return 16_384;
  }

  if (m.includes("phi-3.5") || m.includes("128k")) {
    return 128_000;
  }

  if (m.includes("phi-3")) {
    return 4_096;
  }

  // Qwen3 / Qwen3.5 (covers Mesh LLM unsloth GGUF variants)
  // native_context_length from Mesh LLM API:
  //   Qwen3.5-9B-MTP: 262 144   Qwen3-0.6B/8B: 40 960   Qwen3-4B: 32 768
  if (m.includes("qwen3.5")) {
    return 262_144;
  }

  if (m.includes("qwen3-0.6b") || m.includes("qwen3-1.7b")) {
    return 40_960;
  }

  if (m.includes("qwen3")) {
    return 128_000;
  }

  // Mesh LLM "mesh" routing model (MoA) — reported context_length 242 144
  if (m === "mesh") {
    return 242_144;
  }

  return 4_096;
}
