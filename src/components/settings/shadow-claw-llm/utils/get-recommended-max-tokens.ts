import {
  DEFAULT_PROMPT_API_FALLBACK_MODEL,
  getModelMaxTokens,
} from "../../../../config/config.js";
import { modelRegistry } from "../../../../subsystems/providers/model-registry.js";
import { isPromptApiSupported } from "../../../../subsystems/providers/prompt-api-provider.js";

export type BrowserNavigator = Navigator & {
  deviceMemory?: number;
};

/**
 * Known native context windows for ONNX community / browser-native models.
 * These are the model's *native* context size (not an API-enforced cap).
 */
const BROWSER_MODEL_CONTEXT_WINDOWS: Array<{
  pattern: string;
  contextWindow: number;
}> = [
  // Gemma 3 1B (GQA / standard) — 128K native context
  { pattern: "gemma-3-1b-it-ONNX-GQA", contextWindow: 128_000 },
  { pattern: "gemma-3-1b-it-ONNX", contextWindow: 128_000 },
  // Qwen3 0.6B — 131K native context (from tokenizer_config.json model_max_length)
  { pattern: "Qwen3-0.6B-ONNX", contextWindow: 131_072 },
  // Qwen3.5 ONNX variants
  { pattern: "Qwen3.5", contextWindow: 32_768 },
  // Llama 3.2 1B/3B — 128K native context
  { pattern: "Llama-3.2", contextWindow: 128_000 },
  // Phi-3.5 / Phi-4 mini — 128K native context
  { pattern: "Phi-4", contextWindow: 128_000 },
  { pattern: "Phi-3.5", contextWindow: 128_000 },
  // SmolLM2/SmolLM3 — 8K context
  { pattern: "SmolLM", contextWindow: 8_192 },
  // DeepSeek-R1 Distill — 128K native context
  { pattern: "DeepSeek-R1", contextWindow: 128_000 },
  // LFM2 1.2B
  { pattern: "LFM2", contextWindow: 32_768 },
  // GPT-OSS 20B
  { pattern: "gpt-oss", contextWindow: 32_768 },
  // Gemma 4 ONNX variants
  { pattern: "gemma-4", contextWindow: 128_000 },
  // Chrome Gemini Nano — hard API cap
  { pattern: "browser-built-in", contextWindow: 4_096 },
];

function getBrowserModelContextWindow(modelId: string): number | null {
  const dynamicInfo = modelRegistry.getModelInfo(modelId);
  if (
    dynamicInfo &&
    typeof dynamicInfo.contextWindow === "number" &&
    dynamicInfo.contextWindow > 0
  ) {
    return dynamicInfo.contextWindow;
  }

  for (const { pattern, contextWindow } of BROWSER_MODEL_CONTEXT_WINDOWS) {
    if (modelId.includes(pattern)) {
      return contextWindow;
    }
  }

  return null;
}

export function getRecommendedMaxTokens(
  providerId: string,
  modelId: string,
  fallbackModelId?: string,
): {
  recommended: number;
  detail: string;
} {
  let effectiveModel = modelId;
  if (
    providerId === "prompt_api" &&
    (modelId === "browser-built-in" || !modelId)
  ) {
    if (fallbackModelId) {
      effectiveModel = fallbackModelId;
    } else if (!isPromptApiSupported()) {
      effectiveModel = DEFAULT_PROMPT_API_FALLBACK_MODEL;
    }
  }

  const modelCeiling = getModelMaxTokens(effectiveModel);
  const browserNavigator: BrowserNavigator | null =
    typeof navigator === "undefined" ? null : (navigator as BrowserNavigator);
  const deviceMemory =
    typeof browserNavigator?.deviceMemory === "number"
      ? browserNavigator.deviceMemory
      : null;
  const cpuThreads =
    typeof browserNavigator?.hardwareConcurrency === "number"
      ? browserNavigator.hardwareConcurrency
      : null;

  const isBrowserLocal =
    providerId === "prompt_api" ||
    providerId === "transformers_js_browser" ||
    providerId === "litert_lm_browser";

  // For browser-local providers, factor in device hardware and model context
  if (isBrowserLocal || providerId === "ollama") {
    const knownContext = getBrowserModelContextWindow(effectiveModel);
    let recommended = modelCeiling;

    // Hardware-aware scaling
    if (deviceMemory !== null) {
      if (deviceMemory >= 32) {
        recommended = Math.min(recommended, 16384);
      } else if (deviceMemory >= 16) {
        recommended = Math.min(recommended, 8192);
      } else if (deviceMemory >= 8) {
        recommended = Math.min(recommended, 4096);
      } else {
        recommended = Math.min(recommended, 2048);
      }
    }

    if (cpuThreads !== null) {
      if (cpuThreads <= 4) {
        recommended = Math.min(recommended, 2048);
      } else if (cpuThreads >= 16) {
        recommended = Math.min(modelCeiling, Math.max(recommended, 8192));
      } else if (cpuThreads >= 8) {
        recommended = Math.min(modelCeiling, Math.max(recommended, 4096));
      }
    }

    if (/thinking|reasoning/i.test(effectiveModel)) {
      recommended = Math.min(recommended, 4096);
    }

    recommended = Math.max(512, Math.min(recommended, modelCeiling));

    const hints: string[] = [];
    if (knownContext !== null) {
      hints.push(`native context: ${knownContext.toLocaleString()} tokens`);
    }

    if (deviceMemory !== null) {
      hints.push(`${deviceMemory} GB browser-reported memory`);
    }

    if (cpuThreads !== null) {
      hints.push(`${cpuThreads} CPU threads`);
    }

    if (/thinking|reasoning/i.test(effectiveModel)) {
      hints.push("reasoning model");
    }

    return {
      recommended,
      detail:
        hints.length > 0
          ? `Recommended for this device: ${recommended.toLocaleString()} tokens (${hints.join(", ")}). Model ceiling: ${modelCeiling.toLocaleString()}.`
          : `Recommended for local inference: ${recommended.toLocaleString()} tokens. Model ceiling: ${modelCeiling.toLocaleString()}.`,
    };
  }

  // Cloud providers: use the model ceiling directly
  return {
    recommended: modelCeiling,
    detail: `Model-aware ceiling: ${modelCeiling.toLocaleString()} tokens.`,
  };
}
