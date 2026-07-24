import { env } from "node:process";

import {
  handleProxyRequest,
  handleStreamingProxyRequest,
} from "../utils/proxy-helpers.js";

import type { Express } from "express";

export function registerMeshLlmRoutes(
  app: Express,
  options: { verbose?: boolean } = {},
): void {
  const verbose = options.verbose ?? false;

  const handleMeshLlmChatCompletions = async (req: any, res: any) => {
    const headerHost = Array.isArray(req.headers["x-mesh-llm-host"])
      ? req.headers["x-mesh-llm-host"][0]
      : req.headers["x-mesh-llm-host"];
    const meshHost =
      headerHost || env.MESH_LLM_HOST || "https://public.meshllm.cloud";
    const targetUrl = `${meshHost}/v1/chat/completions`;

    const requestBody =
      req.body && typeof req.body === "object" ? { ...req.body } : {};

    if (verbose) {
      console.log(`[Proxy] Mesh LLM request for model: ${requestBody.model}`);
    }

    const incomingHeaders = { ...req.headers };
    delete incomingHeaders.host;
    delete incomingHeaders.origin;
    delete incomingHeaders.referer;

    // If the client requested streaming, pipe the SSE stream from upstream
    if (requestBody.stream === true) {
      await handleStreamingProxyRequest(req, res, {
        targetUrl,
        headers: incomingHeaders,
        body: JSON.stringify(requestBody),
        verbose,
      });
    } else {
      await handleProxyRequest(req, res, {
        targetUrl,
        method: "POST",
        headers: incomingHeaders,
        body: JSON.stringify(requestBody),
        verbose,
      });
    }
  };

  app.post("/mesh-llm-proxy/chat/completions", handleMeshLlmChatCompletions);

  const handleMeshLlmCatalog = async (req: any, res: any) => {
    try {
      if (verbose) {
        console.log("[Proxy] Fetching Mesh LLM catalog...");
      }

      const headerHost = Array.isArray(req.headers["x-mesh-llm-host"])
        ? req.headers["x-mesh-llm-host"][0]
        : req.headers["x-mesh-llm-host"];
      const meshHost =
        headerHost || env.MESH_LLM_HOST || "https://public.meshllm.cloud";
      const resp = await fetch(`${meshHost}/v1/models`, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!resp.ok) {
        const errBody = await resp.text();
        console.error(`Mesh LLM API error (${resp.status}):`, errBody);

        throw new Error(
          `Mesh LLM API error (${resp.status}): ${resp.statusText}`,
        );
      }

      const modelsData = await resp.json();

      // Mesh LLM stores context info in metadata.context_length / metadata.native_context_length.
      // Normalise to the standard top-level context_length field so the model
      // registry and UI token-limit heuristics can pick it up.
      if (Array.isArray(modelsData?.data)) {
        modelsData.data = modelsData.data.map((m: any) => {
          // Mesh LLM stores context info in metadata.context_length.
          // Lift it to the standard top-level field so the model registry picks it up.
          const contextLength =
            typeof m?.metadata?.context_length === "number"
              ? m.metadata.context_length
              : undefined;

          return {
            ...m,
            ...(contextLength !== undefined && {
              context_length: contextLength,
            }),
          };
        });
      }

      res.json(modelsData);
    } catch (err) {
      console.error("Mesh LLM models discovery error:", err);
      // Provide a fallback model in case fetching fails
      res.json({
        models: [
          {
            id: "mesh",
            name: "mesh",
            context_length: 8000,
            max_completion_tokens: 4096,
          },
        ],
      });
    }
  };

  app.get("/mesh-llm-proxy/models", handleMeshLlmCatalog);
}
