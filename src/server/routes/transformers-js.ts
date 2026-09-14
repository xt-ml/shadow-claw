/**
 * Transformers.js proxy routes.
 *
 * Handles:
 *   - GET  /transformers-js-proxy/status
 *   - GET  /transformers-js-proxy/models
 *   - POST /transformers-js-proxy/prewarm
 *   - POST /transformers-js-proxy/chat/completions
 */

import {
  DEFAULT_TRANSFORMERS_JS_MODEL,
  TransformersRuntimeService,
} from "../services/transformers-runtime.js";

import {
  writeOpenAiDeltaChunk,
  writeOpenAiToolCallChunk,
  writeOpenAiDoneChunk,
  sendStreamingProxyError,
} from "../utils/openai-sse.js";

import { parseLocalModelToolCall } from "../../subsystems/providers/utils/parseLocalModelToolCall.js";

import type { Express } from "express";

export function registerTransformersJsRoutes(
  app: Express,
  service: TransformersRuntimeService,
  options: { verbose?: boolean } = {},
): void {
  const verbose = options.verbose ?? false;

  // ---- Transformers.js: runtime status ----
  app.get("/transformers-js-proxy/status", async (_req, res) => {
    const cache = await service.getDiskCacheStatus();
    res.json({
      ...service.getDownloadStatus(),
      cache,
    });
  });

  // ---- Transformers.js: list models ----
  app.get("/transformers-js-proxy/models", async (_req, res) => {
    try {
      const models = await service.fetchDynamicModels();
      res.json({ data: models });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Transformers.js models discovery error:", message);
      res.status(502).json({
        error: `Failed to list Transformers.js models: ${message}`,
      });
    }
  });

  // ---- Transformers.js: prewarm model runtime/cache ----
  app.post("/transformers-js-proxy/prewarm", async (req, res) => {
    try {
      const requestBody =
        req.body && typeof req.body === "object" ? req.body : null;
      const requestedModel =
        requestBody && typeof requestBody.model === "string"
          ? requestBody.model.trim()
          : "";
      const modelId = requestedModel || DEFAULT_TRANSFORMERS_JS_MODEL;

      const warmed = await service.prewarmModel({ modelId, verbose });
      const cache = await service.getDiskCacheStatus();

      res.json({
        ok: true,
        ...warmed,
        cache,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({
        ok: false,
        error: `Transformers.js prewarm failed: ${message}`,
      });
    }
  });

  // ---- Transformers.js: chat completions ----
  app.post("/transformers-js-proxy/chat/completions", async (req, res) => {
    try {
      const requestBody =
        req.body && typeof req.body === "object" ? req.body : null;
      if (!requestBody) {
        return res.status(400).json({ error: "Missing request body" });
      }

      const modelId =
        typeof requestBody.model === "string" && requestBody.model.trim()
          ? requestBody.model.trim()
          : DEFAULT_TRANSFORMERS_JS_MODEL;

      const messages = Array.isArray(requestBody.messages)
        ? requestBody.messages
        : [];

      const maxCompletionTokensRaw =
        typeof requestBody.max_tokens === "number"
          ? requestBody.max_tokens
          : Number.parseInt(String(requestBody.max_tokens), 10);

      const maxCompletionTokens =
        Number.isFinite(maxCompletionTokensRaw) && maxCompletionTokensRaw > 0
          ? Math.min(Math.floor(maxCompletionTokensRaw), 4096)
          : 512;

      const tools = Array.isArray(requestBody.tools)
        ? requestBody.tools
        : undefined;

      if (requestBody.stream === true) {
        const abortController = new AbortController();
        const abortInference = () => abortController.abort();
        req.once("aborted", abortInference);
        res.once("close", abortInference);

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");
        res.flushHeaders?.();

        const streamedChunks: string[] = [];
        const result = await service
          .runChatCompletion({
            modelId,
            messages,
            tools,
            maxCompletionTokens,
            verbose,
            abortSignal: abortController.signal,
            onToken: (text: string) => {
              if (!text || abortController.signal.aborted) {
                return;
              }

              streamedChunks.push(text);
            },
          })
          .finally(() => {
            req.off("aborted", abortInference);
            res.off("close", abortInference);
          });

        if (abortController.signal.aborted || res.writableEnded) {
          return;
        }

        const finalText = (streamedChunks.join("") || result.text || "").trim();

        const toolCall = parseLocalModelToolCall(finalText);
        if (toolCall) {
          writeOpenAiToolCallChunk(res, modelId, toolCall);
          writeOpenAiDoneChunk(res, modelId, "tool_calls");

          return res.end();
        }

        if (finalText) {
          writeOpenAiDeltaChunk(res, modelId, finalText);
        }

        writeOpenAiDoneChunk(res, modelId);

        return res.end();
      }

      const abortController = new AbortController();
      const abortInference = () => abortController.abort();
      req.once("aborted", abortInference);
      res.once("close", abortInference);

      const result = await service
        .runChatCompletion({
          modelId,
          messages,
          tools,
          maxCompletionTokens,
          verbose,
          abortSignal: abortController.signal,
        })
        .finally(() => {
          req.off("aborted", abortInference);
          res.off("close", abortInference);
        });

      if (abortController.signal.aborted || res.writableEnded) {
        return;
      }

      const created = Math.floor(Date.now() / 1000);
      const usage = {
        prompt_tokens: result.promptTokens,
        completion_tokens: result.completionTokens,
        total_tokens: result.promptTokens + result.completionTokens,
      };

      const toolCall = parseLocalModelToolCall(result.text || "");
      const message = toolCall
        ? {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: `call_${Date.now()}_${Math.random()}`,
                type: "function",
                function: {
                  name: toolCall.name,
                  arguments: JSON.stringify(toolCall.input || {}),
                },
              },
            ],
          }
        : {
            role: "assistant",
            content: result.text || "(no response)",
          };

      res.json({
        id: `chatcmpl-transformers-${Date.now()}`,
        object: "chat.completion",
        created,
        model: modelId,
        choices: [
          {
            index: 0,
            message,
            finish_reason: toolCall ? "tool_calls" : "stop",
          },
        ],
        usage,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = /timed out after \d+ms/i.test(message)
        ? 504
        : message.includes("Cannot find package") &&
            message.includes("@huggingface/transformers")
          ? 501
          : 500;
      if (verbose) {
        console.error("Transformers.js proxy error:", message);
      }

      sendStreamingProxyError(res, {
        status,
        publicMessage:
          status === 501
            ? "Transformers.js runtime is not installed on the server. Install @huggingface/transformers to enable this provider."
            : `Transformers.js invocation failed: ${message}`,
        streamMessage: message,
      });
    }
  });
}
