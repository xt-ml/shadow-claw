/**
 * GitHub Models / Azure AI Inference proxy routes.
 *
 * Handles:
 *   - POST /copilot-proxy/azure-openai/chat/completions
 *   - POST /github-models-proxy/inference/chat/completions
 *   - GET  /copilot-proxy/azure-openai/models
 *   - GET  /github-models-proxy/catalog/models
 */

import { env } from "node:process";

import {
  getFirstHeaderValue,
  extractBearerToken,
  handleProxyRequest,
  handleStreamingProxyRequest,
} from "../utils/proxy-helpers.js";

import type { Express } from "express";

const DEFAULT_USER_AGENT =
  process.env.SHADOWCLAW_USER_AGENT || "ShadowClaw/1.0";

export function registerGitHubModelsRoutes(
  app: Express,
  options: { verbose?: boolean } = {},
): void {
  const verbose = options.verbose ?? false;

  const handleGitHubModelsChatCompletions = async (req: any, res: any) => {
    const endpoint = (
      env.COPILOT_AZURE_OPENAI_ENDPOINT || "https://models.github.ai/inference"
    ).replace(/\/$/, "");

    const targetUrl = `${endpoint}/chat/completions`;

    const serverApiKey =
      env.COPILOT_AZURE_OPENAI_API_KEY || env.API_KEY || undefined;
    const defaultModel = env.COPILOT_AZURE_OPENAI_MODEL || undefined;

    const requestBody =
      req.body && typeof req.body === "object" ? { ...req.body } : {};
    if (!requestBody.model && defaultModel) {
      requestBody.model = defaultModel;
    }

    if (typeof requestBody.model !== "string" || !requestBody.model) {
      return res.status(400).json({
        error: "Missing or invalid 'model' parameter.",
      });
    }

    if (verbose) {
      console.log(
        `[Proxy] Azure OpenAI request for model: ${requestBody.model}`,
      );
    }

    const clientApiKey = getFirstHeaderValue(req.headers["api-key"]);
    const clientAuthorization = getFirstHeaderValue(req.headers.authorization);
    const resolvedApiKey =
      clientApiKey ||
      extractBearerToken(clientAuthorization) ||
      serverApiKey ||
      "";

    const incomingHeaders = { ...req.headers };
    delete incomingHeaders["api-key"];
    delete incomingHeaders.authorization;

    if (resolvedApiKey) {
      incomingHeaders["api-key"] = resolvedApiKey;
      incomingHeaders.authorization = `Bearer ${resolvedApiKey}`;
      incomingHeaders["X-GitHub-Api-Version"] = "2026-03-10";
    }

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

  app.post(
    "/copilot-proxy/azure-openai/chat/completions",
    handleGitHubModelsChatCompletions,
  );
  app.post(
    "/github-models-proxy/inference/chat/completions",
    handleGitHubModelsChatCompletions,
  );

  const handleGitHubModelsCatalog = async (req: any, res: any) => {
    try {
      const clientApiKey = getFirstHeaderValue(req.headers["api-key"]);
      const clientAuthorization = getFirstHeaderValue(
        req.headers.authorization,
      );
      const serverApiKey =
        env.COPILOT_AZURE_OPENAI_API_KEY || env.API_KEY || undefined;

      const resolvedApiKey =
        clientApiKey ||
        extractBearerToken(clientAuthorization) ||
        serverApiKey ||
        "";

      if (!resolvedApiKey) {
        return res.status(401).json({ error: "Missing API key" });
      }

      if (verbose) {
        console.log("[Proxy] Fetching GitHub Models catalog...");
      }

      // Fetch from GitHub Models discovery endpoint
      const resp = await fetch("https://models.github.ai/catalog/models", {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${resolvedApiKey}`,
          "X-GitHub-Api-Version": "2026-03-10",
          "User-Agent": DEFAULT_USER_AGENT,
        },
      });

      if (!resp.ok) {
        const errBody = await resp.text();
        console.error(`GitHub Models API error (${resp.status}):`, errBody);

        throw new Error(
          `GitHub Models API error (${resp.status}): ${resp.statusText}`,
        );
      }

      const modelsData = await resp.json();

      // Transform array of model objects to include token limits
      // GitHub Models catalog returns objects with 'id', 'name', 'limits', etc.
      let models: any[] = [];
      if (Array.isArray(modelsData)) {
        models = modelsData.map((m) => ({
          id: m.id || m.name,
          name: m.name || m.friendly_name || m.id,
          context_length: m.limits?.max_input_tokens || 8000,
          max_completion_tokens: m.limits?.max_output_tokens || 4096,
          registry: m.registry,
          supports_tools: true,
        }));
      }

      const defaultModels = [
        {
          id: "openai/gpt-4o",
          name: "GPT-4o",
          context_length: 128000,
          max_completion_tokens: 16384,
          registry: "azure-openai",
          supports_tools: true,
        },
        {
          id: "openai/gpt-4o-mini",
          name: "GPT-4o mini",
          context_length: 128000,
          max_completion_tokens: 16384,
          registry: "azure-openai",
          supports_tools: true,
        },
        {
          id: "openai/o1",
          name: "o1",
          context_length: 200000,
          max_completion_tokens: 65536,
          registry: "azure-openai",
          supports_tools: true,
        },
        {
          id: "openai/o1-mini",
          name: "o1-mini",
          context_length: 128000,
          max_completion_tokens: 65536,
          registry: "azure-openai",
          supports_tools: true,
        },
      ];

      // Only add fallback models if they were not already fetched from the API
      const fetchedIds = new Set(models.map((m) => m.id));
      const missingDefaults = defaultModels.filter(
        (m) => !fetchedIds.has(m.id),
      );

      models = [...models, ...missingDefaults];

      res.json({ models });
    } catch (err) {
      console.error("Copilot models discovery error:", err);
      // Fallback on error as well
      res.json({
        models: [
          {
            id: "openai/gpt-4o",
            name: "GPT-4o (Fallback)",
            context_length: 8000,
            max_completion_tokens: 4096,
            registry: "azure-openai",
          },
          {
            id: "openai/gpt-4o-mini",
            name: "GPT-4o mini (Fallback)",
            context_length: 8000,
            max_completion_tokens: 4096,
            registry: "azure-openai",
          },
        ],
      });
    }
  };

  // Backward-compatible legacy route + explicit GitHub Models route.
  app.get("/copilot-proxy/azure-openai/models", handleGitHubModelsCatalog);
  app.get("/github-models-proxy/catalog/models", handleGitHubModelsCatalog);
}
