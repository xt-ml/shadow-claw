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
import { withRetry, isRetryableHttpError } from "./withRetry.js";
import { InvokePayload, ContentBlock } from "../types.js";

/**
 * Throttle interval (ms) for streaming text chunks sent to the UI.
 * Keeps the main thread responsive during fast token delivery.
 */
const STREAM_THROTTLE_MS = 50;

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
  } = payload;

  const tools =
    Array.isArray(enabledTools) && enabledTools.length > 0
      ? enabledTools
      : TOOL_DEFINITIONS;

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

    // Track exact tool calls to prevent loops
    const toolCallHistory: string[] = [];

    while (iterations < maxIterations) {
      iterations++;

      const contextLimit = payloadContextLimit ?? getContextLimit(model);
      const systemPromptTokens = estimateTokens(systemPrompt);

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

      const body = formatRequest(typedProvider, payloadMessages, tools as any, {
        model,
        maxTokens: safeMaxTokens,
        system: systemPrompt,
        contextCompression,
      });

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

      let result: any;

      if (useStreaming) {
        result = await callWithStreaming(
          typedProvider,
          headers,
          body,
          groupId,
          model,
          abortSignal,
        );
      } else {
        result = await callWithoutStreaming(
          typedProvider,
          headers,
          body,
          groupId,
          abortSignal,
        );
      }

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
            const inputPreview = JSON.stringify(block.input);
            const inputShort =
              inputPreview.length > 300
                ? inputPreview.slice(0, 300) + "…"
                : inputPreview;

            log(groupId, "tool-call", `Tool: ${block.name}`, inputShort);

            post(createToolActivityMessage(groupId, block.name, "running"));

            // Prevent infinite loops by detecting repeated identical tool calls
            const toolCallSignature = `${block.name}:${JSON.stringify(block.input)}`;
            const timesCalled = toolCallHistory.filter(
              (s) => s === toolCallSignature,
            ).length;

            toolCallHistory.push(toolCallSignature);

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

        // If streaming was used, the text was already streamed chunk-by-chunk.
        if (useStreaming) {
          post({
            type: "streaming-done",
            payload: { groupId, text: cleaned || "(no response)" },
          });
        }

        post({
          type: "response",
          payload: { groupId, text: cleaned || "(no response)" },
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
  }
}

/**
 * Make a non-streaming LLM API call with retry.
 */
async function callWithoutStreaming(
  typedProvider: ProviderConfig,
  headers: Record<string, string>,
  body: any,
  groupId: string,
  abortSignal?: AbortSignal,
): Promise<any> {
  return withRetry(
    async () => {
      const res = await fetch(typedProvider.baseUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: abortSignal,
      });

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
      onRetry: (attempt, maxRetries, delayMs, error) => {
        const errMsg = error instanceof Error ? error.message : String(error);

        log(
          groupId,
          "warning",
          `Retrying API call (${attempt}/${maxRetries})`,
          errMsg,
        );

        post({
          type: "show-toast",
          payload: {
            message: `LLM API: Retrying (${attempt}/${maxRetries})… ${errMsg.slice(0, 120)}`,
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
  typedProvider: ProviderConfig,
  headers: Record<string, string>,
  body: any,
  groupId: string,
  model: string,
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

  const res = await fetch(typedProvider.baseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(streamBody),
    signal: abortSignal,
  });

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
