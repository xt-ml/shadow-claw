/**
 * Ollama proxy routes.
 *
 * Handles:
 *   - GET  /ollama-proxy/models              (list local Ollama models)
 *   - POST /ollama-proxy/chat/completions    (chat, with streaming + tools fallback)
 */

import { env } from "node:process";

import { withRetry, isRetryableHttpError } from "../../worker/withRetry.js";

import {
  getFirstHeaderValue,
  fetchWithTimeout,
  parsePositiveInteger,
  parseNonNegativeInteger,
  requestHasTools,
  stripToolsFromRequest,
  ollamaDoesNotSupportTools,
} from "../utils/proxy-helpers.js";

import type { Express } from "express";

const DEFAULT_USER_AGENT =
  process.env.SHADOWCLAW_USER_AGENT || "ShadowClaw/1.0";

export function registerOllamaRoutes(
  app: Express,
  options: { verbose?: boolean } = {},
): void {
  const verbose = options.verbose ?? false;

  // ---- Ollama: list models ----
  app.get("/ollama-proxy/models", async (_req, res) => {
    try {
      const ollamaHost = env.OLLAMA_HOST || "http://localhost:11434";
      const targetUrl = `${ollamaHost}/api/tags`;
      const ollamaModelsTimeoutMs = parsePositiveInteger(
        env.OLLAMA_MODELS_TIMEOUT_MS,
        10_000,
      );
      const ollamaModelsRetries = parseNonNegativeInteger(
        env.OLLAMA_MODELS_MAX_RETRIES,
        1,
      );

      if (verbose) {
        console.log(`[Proxy] Fetching Ollama models from: ${targetUrl}`);
      }

      const response = await withRetry(
        () =>
          fetchWithTimeout(
            targetUrl,
            {
              method: "GET",
              headers: {
                Accept: "application/json",
                "User-Agent": DEFAULT_USER_AGENT,
              },
            },
            ollamaModelsTimeoutMs,
          ),
        {
          maxRetries: ollamaModelsRetries,
          shouldRetry: isRetryableHttpError,
          onRetry: (attempt, max, delay, error) => {
            if (verbose) {
              console.log(
                `[Proxy] Retry ${attempt}/${max} after ${delay}ms due to: ${error.message || error}`,
              );
            }
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          `Ollama models endpoint returned ${response.status}: ${response.statusText}`,
        );
      }

      const data = await response.json();
      // For each model, call /api/show to get context_length and other metadata
      const models: any[] = [];
      for (const m of data.models || []) {
        const id = m.name || m.model;
        let context_length = 0;
        let max_output = null;
        let supports_tools: boolean | null = null;
        try {
          const showResp = await fetch(`${ollamaHost}/api/show`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Agent": DEFAULT_USER_AGENT,
            },
            body: JSON.stringify({ name: id }),
          });
          if (showResp.ok) {
            const showData = await showResp.json();
            context_length = showData.context_length || 0;
            max_output = showData.max_output || null;
            const capabilities = showData.capabilities;
            if (Array.isArray(capabilities)) {
              supports_tools = capabilities.some((entry: any) =>
                String(entry || "")
                  .toLowerCase()
                  .includes("tool"),
              );
            } else if (typeof showData.supports_tools === "boolean") {
              supports_tools = showData.supports_tools;
            } else if (typeof showData.supportsTools === "boolean") {
              supports_tools = showData.supportsTools;
            }
          }
        } catch (e) {
          // ignore, fallback to 0
        }

        models.push({ id, context_length, max_output, supports_tools });
      }

      res.json({ data: models });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Ollama models discovery error:", message);
      res.status(502).json({
        error: `Failed to list Ollama models: ${message}. Make sure Ollama is running on ${env.OLLAMA_HOST || "http://localhost:11434"}.`,
      });
    }
  });

  // ---- Ollama: chat completions (with streaming support) ----
  app.post("/ollama-proxy/chat/completions", async (req, res) => {
    try {
      const ollamaHost = env.OLLAMA_HOST || "http://localhost:11434";
      const targetUrl = `${ollamaHost}/v1/chat/completions`;
      const ollamaRequestTimeoutMs = parsePositiveInteger(
        env.OLLAMA_REQUEST_TIMEOUT_MS,
        120_000,
      );
      const ollamaChatRetries = parseNonNegativeInteger(
        env.OLLAMA_CHAT_MAX_RETRIES,
        0,
      );

      const body = req.body;
      const hasLlamafileHint =
        !!getFirstHeaderValue(req.headers["x-llamafile-mode"]) ||
        !!getFirstHeaderValue(req.headers["x-llamafile-host"]) ||
        !!getFirstHeaderValue(req.headers["x-llamafile-port"]);

      if (hasLlamafileHint) {
        return res.status(409).json({
          error:
            "Request appears to be for Llamafile but was sent to /ollama-proxy/chat/completions. Verify selected provider and backend route wiring.",
        });
      }

      if (!body || typeof body !== "object") {
        return res.status(400).json({ error: "Missing request body" });
      }

      if (typeof body.model !== "string" || !body.model) {
        return res.status(400).json({
          error: "Missing or invalid 'model' parameter.",
        });
      }

      if (verbose) {
        console.log(`[Proxy] Ollama request for model: ${body.model}`);
      }

      const wantsStreaming = body.stream === true;
      const invokeOllama = async (requestBody: Record<string, any>) =>
        withRetry(
          () =>
            fetchWithTimeout(
              targetUrl,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "User-Agent": DEFAULT_USER_AGENT,
                },
                body: JSON.stringify(requestBody),
              },
              ollamaRequestTimeoutMs,
            ),
          {
            maxRetries: ollamaChatRetries,
            shouldRetry: isRetryableHttpError,
            onRetry: (attempt, max, delay, error) => {
              if (verbose) {
                console.log(
                  `[Proxy] Ollama retry ${attempt}/${max} after ${delay}ms due to: ${error.message || error}`,
                );
              }
            },
          },
        );

      const tryOnceWithoutTools =
        requestHasTools(body) &&
        typeof body.model === "string" &&
        body.model.length > 0;

      if (wantsStreaming) {
        // ---- Streaming path with optional tools fallback ----
        let upstream = await invokeOllama(body);

        if (!upstream.ok) {
          const errBody = await upstream.text();
          if (tryOnceWithoutTools && ollamaDoesNotSupportTools(errBody)) {
            if (verbose) {
              console.warn(
                `[Proxy] Ollama model ${body.model} rejected tools; retrying without tools`,
              );
            }

            upstream = await invokeOllama(stripToolsFromRequest(body));
          } else {
            res.status(upstream.status);
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.json({ error: errBody });

            return;
          }
        }

        if (!upstream.ok) {
          const retryErr = await upstream.text();
          res.status(upstream.status);
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.json({ error: retryErr });

          return;
        }

        res.status(200);
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.flushHeaders();

        if (!upstream.body) {
          res.end();

          return;
        }

        const reader = upstream.body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }

            res.write(Buffer.from(value));
          }
        } finally {
          reader.releaseLock();
        }

        res.end();
      } else {
        // ---- Non-streaming path with optional tools fallback ----
        let upstream = await invokeOllama(body);

        if (!upstream.ok) {
          const errBody = await upstream.text();
          if (tryOnceWithoutTools && ollamaDoesNotSupportTools(errBody)) {
            if (verbose) {
              console.warn(
                `[Proxy] Ollama model ${body.model} rejected tools; retrying without tools`,
              );
            }

            upstream = await invokeOllama(stripToolsFromRequest(body));
          } else {
            res.status(upstream.status);
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.json({ error: errBody });

            return;
          }
        }

        res.status(upstream.status);
        upstream.headers.forEach((value, key) => {
          const lower = key.toLowerCase();
          if (
            lower === "content-encoding" ||
            lower === "transfer-encoding" ||
            lower === "content-length" ||
            lower === "connection"
          ) {
            return;
          }

          res.setHeader(key, value);
        });
        res.setHeader("Access-Control-Allow-Origin", "*");
        const buf = Buffer.from(await upstream.arrayBuffer());
        res.send(buf);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Ollama invoke error:", message);

      if (!res.headersSent) {
        res.status(502).json({
          error: `Ollama invocation failed: ${message}. Make sure Ollama is running on ${env.OLLAMA_HOST || "http://localhost:11434"}.`,
        });
      } else {
        // If we were already streaming, write an SSE error event and close
        res.write(
          `data: ${JSON.stringify({ type: "error", error: { type: "server_error", message } })}\n\n`,
        );
        res.end();
      }
    }
  });
}
