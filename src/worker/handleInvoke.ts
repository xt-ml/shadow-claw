import {
  DEFAULT_MAX_ITERATIONS,
  getProvider,
  ProviderConfig,
} from "../config.js";
import { buildDynamicContext } from "../context/buildDynamicContext.js";
import { estimateTokens } from "../context/estimateTokens.js";
import {
  buildHeaders,
  formatRequest,
  getContextLimit,
  parseResponse,
} from "../providers.js";

import { setStorageRoot } from "../storage/storage.js";
import { TOOL_DEFINITIONS } from "../tools.js";
import { createTokenUsageMessage } from "./createTokenUsageMessage.js";
import { createToolActivityMessage } from "./createToolActivityMessage.js";
import { executeTool } from "./executeTool.js";
import { log } from "./log.js";
import { parseSSEStream } from "./parseSSEStream.js";
import { post } from "./post.js";
import { StreamAccumulator, StreamFormat } from "./StreamAccumulator.js";
import { buildSystemPrompt } from "./system-prompt.js";
import { clearToolState, getToolState } from "./tool-state.js";
import {
  waitForRateLimitSlot,
  updateRateLimitFromHeaders,
  RateLimitConfig,
} from "./rate-limit.js";
import { withRetry, isRetryableHttpError } from "./withRetry.js";
import { InvokePayload, ContentBlock } from "../types.js";

/**
 * Throttle interval (ms) for streaming text chunks sent to the UI.
 * Keeps the main thread responsive during fast token delivery.
 */
const STREAM_THROTTLE_MS = 50;

type ParsedToolCodeBlock = {
  toolBlocks: Array<{
    type: "tool_use";
    id: string;
    name: string;
    input: Record<string, any>;
  }>;
  residualText: string;
};

function parseToolCodeBlock(
  text: string,
  allowedToolNames: Set<string>,
): ParsedToolCodeBlock {
  const trimmed = text.trim();
  const wrappedMatch = trimmed.match(
    /^\[tool_code\]([\s\S]*?)\[\/tool_code\]$/i,
  );
  if (!wrappedMatch?.[1]) {
    return { toolBlocks: [], residualText: text };
  }

  const body = wrappedMatch[1].trim();

  const printMatch = body.match(
    /^print\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*(.*?)\s*\)\s*\)$/s,
  );

  const directMatch = body.match(
    /^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*(.*?)\s*\)$/s,
  );

  const match = printMatch || directMatch;
  if (!match?.[1]) {
    return { toolBlocks: [], residualText: text };
  }

  const toolName = match[1];
  if (!allowedToolNames.has(toolName)) {
    return { toolBlocks: [], residualText: text };
  }

  const rawArgs = (match[2] || "").trim();
  let input: Record<string, any> = {};
  if (rawArgs) {
    if (!rawArgs.startsWith("{") || !rawArgs.endsWith("}")) {
      return { toolBlocks: [], residualText: text };
    }

    try {
      const parsed = JSON.parse(rawArgs);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { toolBlocks: [], residualText: text };
      }

      input = parsed as Record<string, any>;
    } catch {
      return { toolBlocks: [], residualText: text };
    }
  }

  return {
    toolBlocks: [
      {
        type: "tool_use",
        id: `tool_code_${Date.now()}_${Math.random()}`,
        name: toolName,
        input,
      },
    ],
    residualText: "",
  };
}

function normalizeToolCodeResponses(result: any, enabledTools: any[]): any {
  if (
    !result ||
    result.stop_reason === "tool_use" ||
    !Array.isArray(result.content)
  ) {
    return result;
  }

  const allowedToolNames = new Set(
    (enabledTools || [])
      .map((tool: any) => (typeof tool?.name === "string" ? tool.name : ""))
      .filter(Boolean),
  );

  if (allowedToolNames.size === 0) {
    return result;
  }

  const normalizedContent: any[] = [];
  let convertedAny = false;

  for (const block of result.content) {
    if (block?.type !== "text" || typeof block.text !== "string") {
      normalizedContent.push(block);

      continue;
    }

    const parsed = parseToolCodeBlock(block.text, allowedToolNames);
    if (parsed.toolBlocks.length > 0) {
      convertedAny = true;
      if (parsed.residualText.trim()) {
        normalizedContent.push({ type: "text", text: parsed.residualText });
      }

      normalizedContent.push(...parsed.toolBlocks);

      continue;
    }

    normalizedContent.push(block);
  }

  if (!convertedAny) {
    return result;
  }

  return {
    ...result,
    content: normalizedContent,
    stop_reason: "tool_use",
  };
}

function buildToolResultsFallbackText(toolResults: ContentBlock[]): string {
  const lines = toolResults
    .filter((entry) => entry?.type === "tool_result")
    .map((entry) => {
      const content =
        typeof entry.content === "string"
          ? entry.content.trim()
          : JSON.stringify(entry.content).trim();

      return content;
    })
    .filter(Boolean);

  if (lines.length === 0) {
    return "";
  }

  return lines.join("\n\n").slice(0, 10_000);
}

function formatToolFallbackResponseText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }

  return `Tool result:\n${trimmed}`;
}

/**
 * Handle agent invocation with tool-use loop
 */
export async function handleInvoke(
  db: any,
  payload: InvokePayload & { isScheduledTask?: boolean },
  abortSignal?: AbortSignal,
): Promise<void> {
  const {
    groupId,
    messages,
    systemPrompt,
    apiKey,
    model,
    maxTokens,
    provider: providerId,
    storageHandle,
    enabledTools,
    streaming = false,
    maxIterations: payloadMaxIterations,
    isScheduledTask = false,
    contextCompression = false,
    contextLimit: payloadContextLimit,
    providerHeaders = {},
    rateLimitCallsPerMinute = 0,
    rateLimitAutoAdapt = true,
    assistantName,
    memory,
  } = payload;

  const rateLimitConfig: RateLimitConfig = {
    callsPerMinute: Number.isFinite(rateLimitCallsPerMinute)
      ? Math.max(0, Math.floor(rateLimitCallsPerMinute))
      : 0,
    autoAdapt: rateLimitAutoAdapt !== false,
  };

  if (storageHandle) {
    setStorageRoot(storageHandle);
  }

  const provider = getProvider(providerId);
  if (!provider) {
    post({
      type: "error",
      payload: { groupId, error: `Unknown provider: ${providerId}` },
    });

    return;
  }

  const typedProvider = provider as ProviderConfig;

  // Determine whether we can actually use streaming for this provider.
  const useStreaming =
    streaming &&
    typedProvider.supportsStreaming === true &&
    typedProvider.format !== "prompt_api";

  post({ type: "typing", payload: { groupId } });

  log(
    groupId,
    "info",
    "Starting",
    `Provider: ${typedProvider.name} · Model: ${model} · Max tokens: ${maxTokens} · Streaming: ${useStreaming ? "on" : "off"}${streaming && !useStreaming ? " (provider does not support streaming)" : ""}`,
  );

  try {
    let currentMessages = [...messages];
    let iterations = 0;

    const maxIterations =
      typeof payloadMaxIterations === "number" && payloadMaxIterations > 0
        ? payloadMaxIterations
        : DEFAULT_MAX_ITERATIONS;

    let currentTools = Array.isArray(enabledTools)
      ? enabledTools
      : TOOL_DEFINITIONS;
    let currentSystemPrompt = systemPrompt;
    let latestToolResultsFallbackText = "";

    // Track exact tool calls to prevent loops
    const toolCallHistory: string[] = [];

    while (iterations < maxIterations) {
      iterations++;

      // Check for mid-invocation tool updates from main thread
      const updatedState = getToolState(groupId);
      if (updatedState) {
        currentTools = updatedState.enabledTools;
        currentSystemPrompt = buildSystemPrompt(
          assistantName,
          memory,
          currentTools,
          updatedState.systemPromptOverride,
        );
      }

      const contextLimit = payloadContextLimit ?? getContextLimit(model);
      const systemPromptTokens = estimateTokens(currentSystemPrompt);

      // Re-evaluate context dynamically for each API call to handle large tool outputs
      const { messages: payloadMessages, estimatedTokens } =
        buildDynamicContext(currentMessages as any, {
          contextLimit,
          systemPromptTokens,
          maxOutputTokens: maxTokens,
          skimTop: contextCompression,
        });

      // Strict proxy boundaries (e.g. Azure OpenAI) calculate: prompt_tokens + max_tokens <= context_window.
      const SAFETY_BUFFER = 500;
      const totalPromptEstimate =
        (estimatedTokens as number) + systemPromptTokens;

      // Mathematically guarantee we don't overflow the strict provider budget
      const safeMaxTokens = Math.max(
        100, // floor
        Math.min(maxTokens, contextLimit - totalPromptEstimate - SAFETY_BUFFER),
      );

      const body = formatRequest(
        typedProvider,
        payloadMessages,
        currentTools as any,
        {
          model,
          maxTokens: safeMaxTokens,
          system: currentSystemPrompt,
          contextCompression,
        },
      );

      log(
        groupId,
        "api-call",
        `API call #${iterations}`,
        `${payloadMessages.length} messages in context`,
      );

      const headers = {
        ...buildHeaders(typedProvider, apiKey),
        ...providerHeaders,
      };

      const url = typedProvider.baseUrl;

      let result: any;

      if (useStreaming) {
        result = await callWithStreaming(
          providerId,
          typedProvider,
          url,
          headers,
          body,
          groupId,
          model,
          rateLimitConfig,
          abortSignal,
        );
      } else {
        result = await callApi(
          providerId,
          typedProvider,
          url,
          headers,
          body,
          groupId,
          rateLimitConfig,
          abortSignal,
        );
      }

      result = normalizeToolCodeResponses(result, currentTools as any[]);

      // Emit token usage
      if (result.usage) {
        post(
          createTokenUsageMessage(
            groupId,
            result.usage,
            getContextLimit(model),
          ),
        );
      }

      // Log text blocks
      for (const block of result.content) {
        if (block.type === "text" && block.text) {
          const preview =
            block.text.length > 200
              ? block.text.slice(0, 200) + "…"
              : block.text;

          log(groupId, "text", "Response text", preview);
        }
      }

      if (result.stop_reason === "tool_use") {
        const allowedToolNames = new Set(
          (currentTools as any[])
            .map((tool: any) =>
              typeof tool?.name === "string" ? tool.name : "",
            )
            .filter(Boolean),
        );

        // If the response includes text alongside tool calls, persist it
        const intermediateText = result.content
          .filter((b: any) => b.type === "text")
          .map((b: any) => b.text)
          .join("")
          .replace(/<internal>[\s\S]*?<\/internal>/g, "")
          .trim();

        if (intermediateText) {
          post({
            type: "intermediate-response",
            payload: { groupId, text: intermediateText },
          });
        }

        // If we were streaming text before tool calls, clear the streaming bubble
        if (useStreaming) {
          post({
            type: "streaming-end",
            payload: { groupId },
          });
        }

        // Execute tool calls
        const toolResults: ContentBlock[] = [];
        for (const block of result.content) {
          if (block.type === "tool_use") {
            const isAllowed = allowedToolNames.has(block.name);

            // Prevent infinite loops by detecting repeated identical tool calls
            const toolCallSignature = `${block.name}:${JSON.stringify(block.input)}`;
            const timesCalled = toolCallHistory.filter(
              (s) => s === toolCallSignature,
            ).length;

            toolCallHistory.push(toolCallSignature);

            if (!isAllowed) {
              const blockedMessage =
                `SYSTEM ERROR: Tool '${block.name}' is disabled or unavailable for this request. ` +
                "Do not call it again. Try a different approach or ask the user for help.";

              log(groupId, "warning", "Tool blocked", blockedMessage);

              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: blockedMessage,
              });

              continue;
            }

            const inputPreview = JSON.stringify(block.input);
            const inputShort =
              inputPreview.length > 300
                ? inputPreview.slice(0, 300) + "…"
                : inputPreview;

            log(groupId, "tool-call", `Tool: ${block.name}`, inputShort);

            post(createToolActivityMessage(groupId, block.name, "running"));

            let output: any;
            if (timesCalled >= 3) {
              output = `SYSTEM ERROR: You have repeatedly called this tool with the exact same input (${timesCalled + 1} times). This is a rigid loop. STOP calling this tool with these arguments. Try a different approach, fix the underlying issue, or ask the user for help.`;

              console.warn(
                `[Worker] Blocked repetitive tool call:`,
                toolCallSignature,
              );
            } else {
              output = await executeTool(db, block.name, block.input, groupId, {
                isScheduledTask,
              });
            }

            const outputStr =
              typeof output === "string" ? output : JSON.stringify(output);

            const outputShort =
              outputStr.length > 500
                ? outputStr.slice(0, 500) + "…"
                : outputStr;

            log(groupId, "tool-result", `Result: ${block.name}`, outputShort);

            post(createToolActivityMessage(groupId, block.name, "done"));

            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content:
                typeof output === "string"
                  ? output.slice(0, 100_000)
                  : JSON.stringify(output).slice(0, 100_000),
            });
          }
        }

        // Continue conversation with tool results
        latestToolResultsFallbackText =
          buildToolResultsFallbackText(toolResults);
        currentMessages.push({ role: "assistant", content: result.content });
        currentMessages.push({ role: "user", content: toolResults as any });

        post({ type: "typing", payload: { groupId } });
      } else {
        // Final response
        const text = result.content
          .filter((b: any) => b.type === "text")
          .map((b: any) => b.text)
          .join("");

        const cleaned = text
          .replace(/<internal>[\s\S]*?<\/internal>/g, "")
          .trim();
        const isPlaceholderOnly = cleaned.toLowerCase() === "(no response)";
        const preferredModelText = isPlaceholderOnly ? "" : cleaned;
        const finalText = preferredModelText
          ? preferredModelText
          : latestToolResultsFallbackText
            ? formatToolFallbackResponseText(latestToolResultsFallbackText)
            : "(no response)";

        // If streaming was used, the text was already streamed chunk-by-chunk.
        if (useStreaming) {
          post({
            type: "streaming-done",
            payload: { groupId, text: finalText },
          });
        }

        post({
          type: "response",
          payload: { groupId, text: finalText },
        });

        return;
      }
    }

    // Max iterations reached
    post({
      type: "response",
      payload: {
        groupId,
        text: `⚠️ Reached maximum tool-use iterations (${maxIterations}). Stopping to avoid excessive API usage.`,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return;
    }

    const message = err instanceof Error ? err.message : String(err);

    // If we were streaming when the error occurred, preserve partial content
    if (useStreaming) {
      post({
        type: "streaming-error",
        payload: { groupId, error: message },
      });
    }

    post({ type: "error", payload: { groupId, error: message } });
  } finally {
    clearToolState(groupId);
  }
}

/**
 * Make a non-streaming LLM API call with retry.
 */
async function callApi(
  providerId: string,
  typedProvider: ProviderConfig,
  url: string,
  headers: Record<string, string>,
  body: any,
  groupId: string,
  rateLimitConfig: RateLimitConfig,
  abortSignal?: AbortSignal,
): Promise<any> {
  return withRetry(
    async () => {
      await waitForRateLimitSlot(
        providerId,
        groupId,
        rateLimitConfig,
        abortSignal,
      );

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: abortSignal,
      });

      updateRateLimitFromHeaders(providerId, res.headers, rateLimitConfig);

      if (!res.ok) {
        const errBody = await res.text();
        const error = new Error(
          `${typedProvider.name} API error ${res.status}: ${errBody}`,
        );
        (error as any).status = res.status;

        throw error;
      }

      const rawResult = await res.json();

      return parseResponse(typedProvider, rawResult);
    },
    {
      maxRetries: 3,
      baseDelayMs: 2000,
      maxDelayMs: 30_000,
      jitterFactor: 0.5,
      signal: abortSignal,
      shouldRetry: (error) => isRetryableHttpError(error),
      onRetry: (_attempt, _maxRetries, _delayMs, _error) => {
        const errMsg =
          _error instanceof Error ? _error.message : String(_error);

        log(
          groupId,
          "warning",
          `Retrying API call (${_attempt}/${_maxRetries})`,
          errMsg,
        );

        post({
          type: "show-toast",
          payload: {
            message: `LLM API: Retrying (${_attempt}/${_maxRetries})… ${errMsg.slice(0, 120)}`,
            type: "warning",
            duration: 5000,
          },
        });
      },
    },
  );
}

/**
 * Make a streaming LLM API call.
 */
async function callWithStreaming(
  providerId: string,
  typedProvider: ProviderConfig,
  url: string,
  headers: Record<string, string>,
  body: any,
  groupId: string,
  model: string,
  rateLimitConfig: RateLimitConfig,
  abortSignal?: AbortSignal,
): Promise<any> {
  // Add stream flag to the request body
  const streamBody = {
    ...body,
    stream: true,
    // For OpenAI-compatible APIs, request usage in the stream
    ...(typedProvider.format === "openai" && {
      stream_options: { include_usage: true },
    }),
  };

  await waitForRateLimitSlot(providerId, groupId, rateLimitConfig, abortSignal);

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(streamBody),
    signal: abortSignal,
  });

  updateRateLimitFromHeaders(providerId, res.headers, rateLimitConfig);

  if (!res.ok) {
    const errBody = await res.text();
    const error = new Error(
      `${typedProvider.name} API error ${res.status}: ${errBody}`,
    );
    (error as any).status = res.status;

    throw error;
  }

  if (!res.body) {
    throw new Error("Streaming response has no body");
  }

  // Signal the UI that a streaming response is starting
  post({
    type: "streaming-start",
    payload: { groupId },
  });

  let lastChunkTime = 0;
  let pendingText = "";

  const accumulator = new StreamAccumulator(
    typedProvider.format as StreamFormat,
    {
      source: typedProvider.id,
      onText: (text) => {
        const now = Date.now();

        // Always buffer incoming text
        pendingText += text;

        // Flush to the UI only when the throttle interval has elapsed
        if (now - lastChunkTime >= STREAM_THROTTLE_MS) {
          post({
            type: "streaming-chunk",
            payload: { groupId, text: pendingText },
          });
          pendingText = "";
          lastChunkTime = now;
        }
      },
      onToolStart: (name) => {
        post(createToolActivityMessage(groupId, name, "running"));
      },
      onUsage: (usage) => {
        post(createTokenUsageMessage(groupId, usage, getContextLimit(model)));
      },
    },
  );

  for await (const chunk of parseSSEStream(res.body, abortSignal)) {
    accumulator.push(chunk);
  }

  // Flush any remaining buffered text that didn't make it through the throttle
  if (pendingText) {
    post({
      type: "streaming-chunk",
      payload: { groupId, text: pendingText },
    });
  }

  return accumulator.finalize();
}
