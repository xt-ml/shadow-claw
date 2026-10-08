/**
 * Canonical model catalog and static fallback definitions for frontier LLM models.
 *
 * Provides a single authoritative source of truth for baseline model metadata
 * across Anthropic, OpenAI, Google Gemini, and other frontier model families.
 */

export interface CanonicalModelDefinition {
  id: string;
  pattern?: RegExp | string;
  provider: "anthropic" | "openai" | "google" | "meta" | "other";
  contextWindow: number;
  maxOutput: number;
  supportsImages: boolean;
  supportsDocuments: boolean;
  supportsAudio?: boolean;
  supportsVideo?: boolean;
  supportsThinking?: boolean;
  supportsPromptCaching?: boolean;
}

export const STATIC_MODEL_CATALOG: CanonicalModelDefinition[] = [
  // ── Anthropic Claude Frontier Models ───────────────────────────────────
  {
    id: "claude-fable-5",
    provider: "anthropic",
    contextWindow: 1_000_000,
    maxOutput: 128_000,
    supportsImages: true,
    supportsDocuments: true,
    supportsThinking: true,
    supportsPromptCaching: true,
  },
  {
    id: "claude-fable-5.1",
    provider: "anthropic",
    contextWindow: 1_000_000,
    maxOutput: 128_000,
    supportsImages: true,
    supportsDocuments: true,
    supportsThinking: true,
    supportsPromptCaching: true,
  },
  {
    id: "claude-fable",
    provider: "anthropic",
    contextWindow: 1_000_000,
    maxOutput: 128_000,
    supportsImages: true,
    supportsDocuments: true,
    supportsThinking: true,
    supportsPromptCaching: true,
  },
  {
    id: "claude-sonnet-5",
    provider: "anthropic",
    contextWindow: 1_000_000,
    maxOutput: 128_000,
    supportsImages: true,
    supportsDocuments: true,
    supportsThinking: true,
    supportsPromptCaching: true,
  },
  {
    id: "claude-opus-5",
    provider: "anthropic",
    contextWindow: 1_000_000,
    maxOutput: 128_000,
    supportsImages: true,
    supportsDocuments: true,
    supportsThinking: true,
    supportsPromptCaching: true,
  },
  {
    id: "claude-opus-4.8",
    provider: "anthropic",
    contextWindow: 1_000_000,
    maxOutput: 128_000,
    supportsImages: true,
    supportsDocuments: true,
    supportsThinking: true,
    supportsPromptCaching: true,
  },
  {
    id: "claude-haiku-5",
    provider: "anthropic",
    contextWindow: 1_000_000,
    maxOutput: 128_000,
    supportsImages: true,
    supportsDocuments: true,
    supportsPromptCaching: true,
  },
  {
    id: "claude-mythos-5",
    provider: "anthropic",
    contextWindow: 1_000_000,
    maxOutput: 128_000,
    supportsImages: true,
    supportsDocuments: true,
    supportsThinking: true,
    supportsPromptCaching: true,
  },
  {
    id: "claude-mythos",
    provider: "anthropic",
    contextWindow: 1_000_000,
    maxOutput: 128_000,
    supportsImages: true,
    supportsDocuments: true,
    supportsThinking: true,
    supportsPromptCaching: true,
  },

  // ── OpenAI GPT-6 / Astra / Sol / Luna & GPT-5 ─────────────────────────
  {
    id: "gpt-6-astra",
    provider: "openai",
    contextWindow: 1_050_000,
    maxOutput: 128_000,
    supportsImages: true,
    supportsDocuments: true,
    supportsAudio: true,
    supportsVideo: true,
    supportsThinking: false,
    supportsPromptCaching: false,
  },
  {
    id: "gpt-6-sol",
    provider: "openai",
    contextWindow: 1_050_000,
    maxOutput: 128_000,
    supportsImages: true,
    supportsDocuments: true,
    supportsThinking: false,
    supportsPromptCaching: false,
  },
  {
    id: "gpt-6-luna",
    provider: "openai",
    contextWindow: 1_000_000,
    maxOutput: 64_000,
    supportsImages: true,
    supportsDocuments: true,
    supportsThinking: false,
    supportsPromptCaching: false,
  },
  {
    id: "gpt-6",
    provider: "openai",
    contextWindow: 1_050_000,
    maxOutput: 128_000,
    supportsImages: true,
    supportsDocuments: true,
    supportsThinking: false,
    supportsPromptCaching: false,
  },
  {
    id: "astra",
    provider: "openai",
    contextWindow: 1_050_000,
    maxOutput: 128_000,
    supportsImages: true,
    supportsDocuments: true,
    supportsAudio: true,
    supportsVideo: true,
    supportsThinking: false,
    supportsPromptCaching: false,
  },
  {
    id: "gpt-5",
    provider: "openai",
    contextWindow: 400_000,
    maxOutput: 128_000,
    supportsImages: true,
    supportsDocuments: true,
    supportsThinking: false,
    supportsPromptCaching: false,
  },

  // ── Google Gemini 3.x & 2.5 ───────────────────────────────────────────
  {
    id: "gemini-3.5-pro",
    provider: "google",
    contextWindow: 2_097_152,
    maxOutput: 65_536,
    supportsImages: true,
    supportsDocuments: true,
    supportsAudio: true,
    supportsVideo: true,
    supportsThinking: false,
    supportsPromptCaching: false,
  },
  {
    id: "gemini-3.5-flash",
    provider: "google",
    contextWindow: 1_048_576,
    maxOutput: 65_536,
    supportsImages: true,
    supportsDocuments: true,
    supportsAudio: true,
    supportsVideo: true,
    supportsThinking: false,
    supportsPromptCaching: false,
  },
  {
    id: "gemini-3.8-flash",
    provider: "google",
    contextWindow: 1_048_576,
    maxOutput: 65_536,
    supportsImages: true,
    supportsDocuments: true,
    supportsAudio: true,
    supportsVideo: true,
    supportsThinking: false,
    supportsPromptCaching: false,
  },
  {
    id: "gemini-2.5-pro",
    provider: "google",
    contextWindow: 1_048_576,
    maxOutput: 65_536,
    supportsImages: true,
    supportsDocuments: true,
    supportsAudio: true,
    supportsVideo: true,
    supportsThinking: false,
    supportsPromptCaching: false,
  },
  {
    id: "gemini-2.5-flash",
    provider: "google",
    contextWindow: 1_048_576,
    maxOutput: 65_536,
    supportsImages: true,
    supportsDocuments: true,
    supportsAudio: true,
    supportsVideo: true,
    supportsThinking: false,
    supportsPromptCaching: false,
  },
];

let defaultRegistry:
  { registerModelInfo: (id: string, info: any) => void } | undefined;

/**
 * Configure the default model registry target for seeding.
 */
export function setDefaultModelRegistry(registry: {
  registerModelInfo: (id: string, info: any) => void;
}): void {
  defaultRegistry = registry;
}

/**
 * Seed model registry with static fallback definitions from STATIC_MODEL_CATALOG.
 */
export function seedStaticModelCatalog(targetRegistry?: {
  registerModelInfo: (id: string, info: any) => void;
}): void {
  const registry = targetRegistry || defaultRegistry;
  if (!registry) {
    return;
  }

  for (const model of STATIC_MODEL_CATALOG) {
    registry.registerModelInfo(model.id, {
      contextWindow: model.contextWindow,
      maxOutput: model.maxOutput,
      supportsImageInput: model.supportsImages,
      supportsDocumentInput: model.supportsDocuments,
      ...(model.supportsAudio !== undefined && {
        supportsAudioInput: model.supportsAudio,
      }),
      ...(model.supportsVideo !== undefined && {
        supportsVideoInput: model.supportsVideo,
      }),
      ...(model.supportsPromptCaching !== undefined && {
        supportsPromptCaching: model.supportsPromptCaching,
      }),
    });
  }
}
