import { getProvider } from "../config.mjs";
import {
  buildHeaders,
  formatRequest,
  getContextLimit,
  parseResponse,
} from "../providers.mjs";
import { setStorageRoot } from "../storage/storage.mjs";
import { TOOL_DEFINITIONS } from "../tools.mjs";
import { createTokenUsageMessage } from "./createTokenUsageMessage.mjs";
import { createToolActivityMessage } from "./createToolActivityMessage.mjs";
import { executeTool } from "./executeTool.mjs";
import { log } from "./log.mjs";
import { post } from "./post.mjs";

/**
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

/**
 * Handle agent invocation with tool-use loop
 *
 * @param {ShadowClawDatabase} db
 * @param {any} payload
 */
export async function handleInvoke(db, payload) {
  const {
    groupId,
    messages,
    systemPrompt,
    apiKey,
    model,
    maxTokens,
    provider: providerId,
    storageHandle,
  } = payload;

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

  /** @type {import('../config.mjs').ProviderConfig} */
  const typedProvider = provider;

  post({ type: "typing", payload: { groupId } });

  log(
    groupId,
    "info",
    "Starting",
    `Provider: ${typedProvider.name} · Model: ${model} · Max tokens: ${maxTokens}`,
  );

  try {
    let currentMessages = [...messages];
    let iterations = 0;

    const maxIterations = 25;

    // Track exact tool calls to prevent loops
    const toolCallHistory = [];

    while (iterations < maxIterations) {
      iterations++;

      const body = formatRequest(
        typedProvider,
        currentMessages,
        TOOL_DEFINITIONS,
        {
          model,
          maxTokens,
          system: systemPrompt,
        },
      );

      log(
        groupId,
        "api-call",
        `API call #${iterations}`,
        `${currentMessages.length} messages in context`,
      );

      const headers = buildHeaders(typedProvider, apiKey);
      const res = await fetch(typedProvider.baseUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errBody = await res.text();

        throw new Error(
          `${typedProvider.name} API error ${res.status}: ${errBody}`,
        );
      }

      const rawResult = await res.json();
      const result = parseResponse(typedProvider, rawResult);

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
        // Execute tool calls
        const toolResults = [];
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

            let output;
            if (timesCalled >= 3) {
              output = `SYSTEM ERROR: You have repeatedly called this tool with the exact same input (${timesCalled + 1} times). This is a rigid loop. STOP calling this tool with these arguments. Try a different approach, fix the underlying issue, or ask the user for help.`;

              console.warn(
                `[Worker] Blocked repetitive tool call:`,
                toolCallSignature,
              );
            } else {
              output = await executeTool(db, block.name, block.input, groupId);
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
        currentMessages.push({ role: "user", content: toolResults });

        post({ type: "typing", payload: { groupId } });
      } else {
        // Final response
        const text = result.content
          .filter((/** @type {any} */ b) => b.type === "text")
          .map((/** @type {any} */ b) => b.text)
          .join("");

        const cleaned = text
          .replace(/<internal>[\s\S]*?<\/internal>/g, "")
          .trim();

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
        text: "⚠️ Reached maximum tool-use iterations (25). Stopping to avoid excessive API usage.",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    post({ type: "error", payload: { groupId, error: message } });
  }
}
