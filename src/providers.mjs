/**
 * Prepare API headers for a specific provider
 *
 * @param {import('./config.mjs').ProviderConfig} provider - The provider config
 * @param {string} apiKey - The API key
 *
 * @returns {Record<string, string>} - Headers object
 */
export function buildHeaders(provider, apiKey) {
  /** @type {Record<string, string>} */
  const headers = {
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
  /**
   * @param {import('./config.mjs').ProviderConfig} provider
   */
  constructor(provider) {
    this.provider = provider;
  }

  /**
   * @param {any[]} messages
   * @param {any[]} tools
   * @param {{model: string, maxTokens: number, system: string}} options
   *
   * @returns {any}
   */
  formatRequest(messages, tools, options) {
    throw new Error("Not implemented");
  }

  /**
   * @param {any} response
   *
   * @returns {any}
   */
  parseResponse(response) {
    throw new Error("Not implemented");
  }
}

/**
 * Adapter for OpenAI compatible format
 */
class OpenAIAdapter extends BaseAdapter {
  /**
   * @param {any[]} messages
   * @param {any[]} tools
   * @param {{model: string, maxTokens: number, system: string}} options
   * @returns {any}
   */
  formatRequest(messages, tools, options) {
    const { model, maxTokens, system } = options;
    const openaiMessages = [];

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
          .filter((/** @type {any} */ b) => b.type === "text")
          .map((/** @type {any} */ b) => b.text)
          .join("\n");
        const toolUses = msg.content.filter(
          (/** @type {any} */ b) => b.type === "tool_use",
        );

        /** @type {{role: string, content: string|null, tool_calls?: any[]}} */
        const resultMsg = {
          role: "assistant",
          content: textContent || null,
        };

        if (toolUses.length > 0) {
          resultMsg.tool_calls = toolUses.map((/** @type {any} */ toolUse) => ({
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
        const toolResults = msg.content.filter(
          (/** @type {any} */ b) => b.type === "tool_result",
        );
        const textContent = msg.content
          .filter((/** @type {any} */ b) => b.type === "text")
          .map((/** @type {any} */ b) => b.text)
          .join("\n");

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

    const openaiTools =
      tools?.map((/** @type {any} */ tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema,
        },
      })) || [];

    return {
      model,
      max_tokens: maxTokens,
      messages: openaiMessages,
      ...(openaiTools.length > 0 && { tools: openaiTools }),
    };
  }

  /**
   * @param {any} response
   * @returns {any}
   */
  parseResponse(response) {
    const choice = response.choices?.[0];
    if (!choice) {
      throw new Error("No choices in OpenAI response");
    }

    const { message, finish_reason } = choice;
    const content = [];
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
 * Map of format string to Adapter class
 *
 * @type {Record<string, typeof BaseAdapter>}
 */
const ADAPTER_MAP = {
  openai: OpenAIAdapter,
};

/**
 * Get the adapter for a given provider
 *
 * @param {import('./config.mjs').ProviderConfig} provider
 *
 * @returns {BaseAdapter}
 */
export function getAdapter(provider) {
  const AdapterClass = ADAPTER_MAP[provider.format];
  if (!AdapterClass) {
    throw new Error(`Unknown provider format: ${provider.format}`);
  }

  return new AdapterClass(provider);
}

/**
 * Convert message format
 *
 * @param {import('./config.mjs').ProviderConfig} provider - The provider config
 * @param {any[]} messages - Messages in format
 * @param {any[]} tools - Tool definitions
 * @param {{model: string, maxTokens: number, system: string}} options - Additional options
 *
 * @returns {any} - Formatted request body for the provider
 */
export function formatRequest(provider, messages, tools, options) {
  return getAdapter(provider).formatRequest(messages, tools, options);
}

/**
 * Parse response from provider API call
 *
 * @param {import('./config.mjs').ProviderConfig} provider - The provider config
 * @param {any} response - Raw response from provider
 *
 * @returns {any} - Normalized response format
 */
export function parseResponse(provider, response) {
  return getAdapter(provider).parseResponse(response);
}

/**
 * Get context limit for a model
 *
 * @param {string} model - Model name
 *
 * @returns {number} - Context window size in tokens
 */
export function getContextLimit(model) {
  // Anthropic models
  if (model.includes("claude-3-opus")) return 200_000;
  if (model.includes("claude-3-sonnet")) return 200_000;
  if (model.includes("claude-sonnet-4")) return 8000;
  if (model.includes("claude-3-haiku")) return 200_000;

  // OpenRouter models (approximate)
  if (model.includes("llama-3-70b")) return 8000;
  if (model.includes("llama-3-8b")) return 8000;
  if (model.includes("gpt-4")) return 8000;
  if (model.includes("gpt-3.5")) return 4000;

  // Default fallback
  return 4096;
}
