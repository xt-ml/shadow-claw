/**
 * Native AI Task Executor
 * Provides a unified, environment-agnostic execution engine for Built-in AI tasks
 * (summarize, write, rewrite, proofread, detect-language, translate, semantic-embedder).
 * Works across both the browser orchestrator and headless CLI environments.
 */

import {
  CONFIG_KEYS,
  getProvider,
  ProviderConfig,
} from "../../config/config.js";
import { isHeadlessMode } from "../../config/headless.js";
import { buildHeaders, formatRequest, parseResponse } from "./providers.js";
import {
  detectLanguage,
  embedText,
  ensureBuiltinAiPolyfills,
  proofreadText,
  rewriteText,
  summarizeText,
  translateText,
  writeText,
} from "./builtin-ai-tasks.js";

export interface ExecuteNativeAiTaskOptions {
  taskType: string;
  input: Record<string, any>;
  groupId?: string;
  providerId?: string;
  model?: string;
  apiKey?: string;
  maxTokens?: number;
  headers?: Record<string, string>;
  db?: any;
  toolsBackendPref?: "active_provider" | "local" | string;
  onProgress?: (progress: any) => void;
}

export function buildTaskPrompt(
  taskType: string,
  input: Record<string, any>,
): string {
  if (taskType === "translate") {
    return `Translate the following text from ${input.sourceLanguage || "auto"} to ${input.targetLanguage}. Provide ONLY the raw translated text without commentary or quotation marks:\n\n${input.text}`;
  }
  if (taskType === "summarize") {
    return `Summarize the following text (type: ${input.type || "tldr"}, format: ${input.format || "plain-text"}, length: ${input.length || "medium"}). Provide ONLY the summary:\n\n${input.text}`;
  }
  if (taskType === "write") {
    return `Draft content for the following request (context: ${input.context || "none"}):\n\n${input.prompt}`;
  }
  if (taskType === "rewrite") {
    return `Rewrite the following text (tone: ${input.tone || "standard"}, length: ${input.length || "as-is"}):\n\n${input.text}`;
  }
  if (taskType === "proofread") {
    return `Proofread and correct grammar, spelling, and style in the following text. Provide ONLY the corrected text:\n\n${input.text}`;
  }
  if (taskType === "detect-language") {
    return `Detect the language of the following text. Return ONLY a JSON array of objects with "detectedLanguage" (BCP 47 code) and "confidence" (0.0 - 1.0), e.g. [{"detectedLanguage":"en","confidence":0.99}]:\n\n${input.text}`;
  }
  if (taskType === "semantic-embedder") {
    return `Provide a concise semantic description/representation for the following content:\n\n${JSON.stringify(input.text)}`;
  }
  throw new Error(`Unknown native AI task type: ${taskType}`);
}

async function resolveToolsBackendPref(
  options: ExecuteNativeAiTaskOptions,
): Promise<string> {
  if (options.toolsBackendPref) {
    return options.toolsBackendPref;
  }
  if (options.db) {
    try {
      const { getConfig } = await import("../../db/getConfig.js");
      const pref = await getConfig(
        options.db,
        CONFIG_KEYS.BUILTIN_AI_TOOLS_BACKEND,
      );
      if (pref) return pref;
    } catch {}
  }
  return "active_provider";
}

async function resolveApiKey(
  _provider: ProviderConfig,
  providerId: string,
  options: ExecuteNativeAiTaskOptions,
): Promise<string> {
  if (options.apiKey) {
    return options.apiKey;
  }

  // Check process.env
  if (typeof process !== "undefined" && process.env) {
    const genericKey = process.env.SHADOW_CLAW_API_KEY;
    if (genericKey) return genericKey;

    switch (providerId) {
      case "openrouter":
        if (process.env.OPENROUTER_API_KEY)
          return process.env.OPENROUTER_API_KEY;
        break;
      case "huggingface":
        if (process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN) {
          return process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN || "";
        }
        break;
      case "gemini_proxy":
        if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
        break;
    }

    const envName = `${providerId.toUpperCase()}_API_KEY`;
    if (process.env[envName]) return process.env[envName]!;
  }

  // Check database
  if (options.db) {
    try {
      const { getConfig } = await import("../../db/getConfig.js");
      const key =
        (await getConfig(options.db, `api_key:${providerId}`)) ||
        (await getConfig(options.db, "apiKey"));
      if (key) return key;
    } catch {}
  }

  return "";
}

/**
 * Execute a native AI task via configured tools backend (active provider or local).
 */
export async function executeNativeAiTask(
  options: ExecuteNativeAiTaskOptions,
): Promise<any> {
  const { taskType, input, onProgress } = options;
  const toolsBackendPref = await resolveToolsBackendPref(options);

  if (toolsBackendPref === "local") {
    if (taskType === "summarize") {
      return await summarizeText(input.text, { ...input, onProgress });
    }
    if (taskType === "write") {
      return await writeText(input.prompt, { ...input, onProgress });
    }
    if (taskType === "rewrite") {
      return await rewriteText(input.text, { ...input, onProgress });
    }
    if (taskType === "proofread") {
      return await proofreadText(input.text, { ...input, onProgress });
    }
    if (taskType === "detect-language") {
      return await detectLanguage(input.text, { onProgress });
    }
    if (taskType === "translate") {
      return await translateText(input.text, {
        sourceLanguage: input.sourceLanguage || "auto",
        targetLanguage: input.targetLanguage || "en",
        ...input,
        onProgress,
      });
    }
    if (taskType === "semantic-embedder") {
      return await embedText(input.text, { ...input, onProgress });
    }
    throw new Error(`Unknown native AI task: ${taskType}`);
  }

  // Active Provider Execution
  const defaultProviderId = isHeadlessMode() ? "openrouter" : "prompt_api";
  let effectiveProviderId = options.providerId;
  if (!effectiveProviderId && options.db) {
    try {
      const { getConfig } = await import("../../db/getConfig.js");
      effectiveProviderId =
        (await getConfig(options.db, CONFIG_KEYS.PROVIDER)) ||
        defaultProviderId;
    } catch {}
  }
  if (!effectiveProviderId) {
    effectiveProviderId =
      (typeof process !== "undefined" &&
        (process.env.SHADOW_CLAW_PROVIDER ||
          process.env.SHADOW_CLAW_DEFAULT_PROVIDER)) ||
      defaultProviderId;
  }

  const prompt = buildTaskPrompt(taskType, input);

  if (effectiveProviderId === "prompt_api") {
    await ensureBuiltinAiPolyfills();
    const g = globalThis as any;
    const LanguageModelApi = g.LanguageModel || g.ai?.languageModel;
    if (LanguageModelApi && typeof LanguageModelApi.create === "function") {
      let session;
      try {
        session = await LanguageModelApi.create();
      } catch (err) {
        console.warn(
          "Prompt API session creation failed in active provider task:",
          err,
        );
      }
      if (session) {
        try {
          const raw = await session.prompt(prompt);
          const textResult = String(raw || "").trim();
          if (taskType === "detect-language") {
            try {
              const parsed = JSON.parse(textResult);
              return Array.isArray(parsed) ? parsed : [parsed];
            } catch {
              return [{ detectedLanguage: "en", confidence: 0.8 }];
            }
          }
          return textResult;
        } finally {
          if (typeof session.destroy === "function") {
            session.destroy();
          }
        }
      }
    }
  }

  const provider = getProvider(effectiveProviderId);
  if (
    !provider ||
    !provider.baseUrl ||
    provider.baseUrl.startsWith("builtin://") ||
    provider.baseUrl.startsWith("local://") ||
    provider.format === "prompt_api" ||
    provider.format === "transformers_js"
  ) {
    if (taskType === "summarize") {
      return await summarizeText(input.text, input);
    }
    if (taskType === "write") {
      return await writeText(input.prompt, input);
    }
    if (taskType === "rewrite") {
      return await rewriteText(input.text, input);
    }
    if (taskType === "proofread") {
      return await proofreadText(input.text, input);
    }
    if (taskType === "detect-language") {
      return await detectLanguage(input.text);
    }
    if (taskType === "translate") {
      return await translateText(input.text, {
        sourceLanguage: input.sourceLanguage || "auto",
        targetLanguage: input.targetLanguage || "en",
        ...input,
      });
    }
    if (taskType === "semantic-embedder") {
      return await embedText(input.text, input);
    }
    throw new Error(
      `Provider ${effectiveProviderId} not found and no local fallback available`,
    );
  }

  const apiKey = await resolveApiKey(provider, effectiveProviderId, options);
  if (provider.requiresApiKey !== false && !apiKey) {
    throw new Error(
      `Provider "${provider.name || effectiveProviderId}" requires an API key for task "${taskType}". Please provide an API key or configure tools backend.`,
    );
  }

  const effectiveModel = options.model || provider.defaultModel || "default";

  const headers = {
    ...buildHeaders(provider, apiKey),
    ...(options.headers || {}),
  };

  const body = formatRequest(
    provider,
    [{ role: "user", content: prompt }],
    [],
    {
      maxTokens: options.maxTokens || 2048,
      model: effectiveModel,
      system:
        "You are a specialized text task assistant. Fulfill the user request directly and accurately without conversational filler.",
    },
  );

  const res = await fetch(provider.baseUrl, {
    body: JSON.stringify(body),
    headers,
    method: "POST",
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Active provider task API error ${res.status}: ${errText}`);
  }

  const json = await res.json();
  const parsed = parseResponse(provider, json);
  const textResult =
    parsed.content
      ?.filter((b: any) => b.type === "text")
      ?.map((b: any) => b.text)
      ?.join("")
      ?.trim() || "";

  if (taskType === "detect-language") {
    try {
      const detected = JSON.parse(textResult);
      return Array.isArray(detected) ? detected : [detected];
    } catch {
      return [{ detectedLanguage: "en", confidence: 0.8 }];
    }
  }

  return textResult;
}
