import { getModelAttachmentCapabilities } from "./attachment-capabilities.js";
import { modelRegistry } from "./model-registry.js";
import type { ProviderConfig } from "./config.js";

function formatAttachmentFallbackText(block: any): string {
  return `[Attachment: ${block.fileName} (${block.mimeType}) is available in chat history${block.path ? ` at ${block.path}` : ""}]`;
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

    if (block?.type === "tool_use" || block?.type === "tool_result") {
      content.push(block);

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
    messages: any[],
    tools: any[],
    options: {
      model: string;
      maxTokens: number;
      system: string;
      contextCompression?: boolean;
    },
  ): any {
    throw new Error("Not implemented");
  }

  parseResponse(response: any): any {
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
    },
  ): any {
    const { model, maxTokens, system, contextCompression } = options;
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
          openaiMessages.push({
            role: "tool",
            tool_call_id: toolResult.tool_use_id,
            content:
              typeof toolResult.content === "string"
                ? toolResult.content
                : JSON.stringify(toolResult.content),
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
      content.push({ type: "text", text: message.content });
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
    },
  ): any {
    const { model, maxTokens, system } = options;

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

    return {
      model,
      max_tokens: maxTokens,
      ...(system && { system }),
      messages: filteredMessages,
      ...(anthropicTools.length > 0 && { tools: anthropicTools }),
    };
  }

  parseResponse(response: any): any {
    // Anthropic/Bedrock responses are already in the internal format

    return {
      content: response.content || [],
      stop_reason: response.stop_reason || "end_turn",
      usage: {
        input_tokens: response.usage?.input_tokens || 0,
        output_tokens: response.usage?.output_tokens || 0,
      },
    };
  }
}

/**
 * Map of format string to Adapter class
 */
const ADAPTER_MAP: Record<string, typeof BaseAdapter> = {
  openai: OpenAIAdapter,
  anthropic: AnthropicAdapter,
};

/**
 * Get the adapter for a given provider
 */
export function getAdapter(provider: ProviderConfig): BaseAdapter {
  const AdapterClass = ADAPTER_MAP[provider.format];
  if (!AdapterClass) {
    throw new Error(`Unknown provider format: ${provider.format}`);
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
  },
): any {
  return getAdapter(provider).formatRequest(messages, tools, options);
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
  // Check dynamic registry first
  const info = modelRegistry.getModelInfo(model);
  if (info?.contextWindow) {
    return info.contextWindow;
  }

  const m = model.toLowerCase();

  // Anthropic / AWS Bedrock (e.g. "anthropic.claude-sonnet-4-6-v1:0", "claude-sonnet-4-6")
  if (m.includes("claude")) {
    return 200_000;
  }

  // OpenAI / Azure OpenAI
  if (m.includes("gpt-4o")) {
    return 128_000;
  }

  if (m.includes("gpt-4-turbo")) {
    return 128_000;
  }

  if (m.includes("gpt-4")) {
    return 8_192;
  }

  if (m.includes("gpt-3.5-turbo")) {
    return 16_385;
  }

  if (m.includes("gpt-3.5")) {
    return 4_096;
  }

  // Meta Llama (OpenRouter)
  if (m.includes("llama-3.1") || m.includes("llama-3-1")) {
    return 128_000;
  }

  if (m.includes("llama-3")) {
    return 8_192;
  }

  if (m.includes("llama")) {
    return 4_096;
  }

  // Google
  if (m.includes("gemini")) {
    return 128_000;
  }

  // Gemma family (for example local Transformers.js Gemma 4 variants)
  if (m.includes("gemma-4") || m.includes("gemma 4") || m.includes("gemma")) {
    return 32_000;
  }

  // Mistral (Bedrock or OpenRouter)
  if (m.includes("mistral-large")) {
    return 128_000;
  }

  if (m.includes("mistral")) {
    return 32_000;
  }

  // Amazon Bedrock native models
  if (m.includes("amazon.titan")) {
    return 8_192;
  }

  if (m.includes("amazon.nova")) {
    return 128_000;
  }

  if (m.includes("ai21")) {
    return 8_192;
  }

  if (m.includes("cohere")) {
    return 128_000;
  }

  // Browser built-in / small models
  if (m.includes("phi-4") || m.includes("gemini-nano")) {
    return 4_096;
  }

  // Default fallback

  return 4_096;
}
