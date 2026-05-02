import { ProviderConfig } from "./config.js";

export interface ModelMetadata {
  contextWindow: number;
  maxOutput: number | null;
  supportsTools?: boolean;
  inputModalities?: string[];
  outputModalities?: string[];
  supportsImageInput?: boolean;
  supportsAudioInput?: boolean;
  supportsVideoInput?: boolean;
  supportsDocumentInput?: boolean;
  routesByRequestFeatures?: boolean;
}

/**
 * Registry for dynamic model metadata (context window, output limits)
 * fetched from provider APIs.
 *
 * All model IDs are stored and looked up in lowercase so that a model
 * selected as "moonshotai/Kimi-K2-Thinking" still matches the registry
 * entry stored under "moonshotai/kimi-k2-thinking" (as returned by the
 * OpenRouter API).
 */
class ModelRegistry {
  models: Map<string, ModelMetadata> = new Map();
  loading: boolean = false;

  /**
   * Fetch model info from a provider's modelsUrl and populate the registry.
   * Handles OpenRouter and any OpenAI-compatible provider that returns
   * {data: [{id, context_length, top_provider: {max_completion_tokens}}]}
   * as well as HuggingFace Router's identical response shape.
   */
  async fetchModelInfo(provider: ProviderConfig, apiKey?: string) {
    if (!provider.modelsUrl) {
      return;
    }

    this.loading = true;
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Forward the API key so authenticated endpoints (e.g. HuggingFace)
      // return the full model list rather than a 401.
      if (apiKey && provider.apiKeyHeader) {
        const fmt = provider.apiKeyHeaderFormat;
        headers[provider.apiKeyHeader] = fmt
          ? fmt.replace("{key}", apiKey)
          : apiKey;
      }

      const response = await fetch(provider.modelsUrl, { headers });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // OpenRouter / HuggingFace Router / any OpenAI-compatible /v1/models
      // All return {data: [{id, context_length, top_provider?:{max_completion_tokens}}]}
      const items: any[] = Array.isArray(data.data)
        ? data.data
        : Array.isArray(data.models)
          ? data.models
          : [];

      for (const model of items) {
        if (!model.id) {
          continue;
        }

        let contextLength = model.context_length ?? model.context_window ?? 0;
        let maxOutput =
          model.max_completion_tokens ||
          model.per_request_limits?.completion_tokens ||
          model.top_provider?.max_completion_tokens ||
          null;
        const supportsTools =
          typeof model.supports_tools === "boolean"
            ? model.supports_tools
            : typeof model.supportsTools === "boolean"
              ? model.supportsTools
              : undefined;
        const inputModalities = this.extractModalities(model, "input");
        const outputModalities = this.extractModalities(model, "output");
        const supportsImageInput = this.modalitiesInclude(
          inputModalities,
          "image",
          "vision",
        );
        const supportsAudioInput = this.modalitiesInclude(
          inputModalities,
          "audio",
          "voice",
          "hearing",
        );
        const supportsVideoInput = this.modalitiesInclude(
          inputModalities,
          "video",
        );
        const routesByRequestFeatures =
          model.id === "openrouter/free" ||
          this.supportedParametersInclude(
            model,
            "image",
            "vision",
            "audio",
            "tool",
            "structured",
          );

        // HuggingFace Router structure nests info inside `providers` array
        if (
          !contextLength &&
          Array.isArray(model.providers) &&
          model.providers.length > 0
        ) {
          contextLength = model.providers[0]?.context_length || 0;
        }

        this.registerModelInfo(model.id, {
          contextWindow: contextLength,
          maxOutput,
          ...(supportsTools !== undefined && { supportsTools }),
          ...(inputModalities.length > 0 && { inputModalities }),
          ...(outputModalities.length > 0 && { outputModalities }),
          ...(supportsImageInput !== undefined && { supportsImageInput }),
          ...(supportsAudioInput !== undefined && { supportsAudioInput }),
          ...(supportsVideoInput !== undefined && { supportsVideoInput }),
          ...(routesByRequestFeatures && { routesByRequestFeatures }),
        });
      }

      if (items.length > 0) {
        console.log(
          `[ModelRegistry] Registered ${items.length} models for provider "${provider.id}"`,
        );
      }
    } catch (err) {
      console.error(
        `[ModelRegistry] Error fetching models for ${provider.id}:`,
        err,
      );
    } finally {
      this.loading = false;
    }
  }

  /**
   * Manually register model info. Keys are normalized to lowercase.
   */
  registerModelInfo(modelId: string, info: ModelMetadata) {
    this.models.set(modelId.toLowerCase(), info);
  }

  private extractModalities(
    model: any,
    direction: "input" | "output",
  ): string[] {
    const direct =
      direction === "input"
        ? model.input_modalities || model.inputModalities
        : model.output_modalities || model.outputModalities;

    const architecture = model.architecture || {};
    const architectureValue =
      direction === "input"
        ? architecture.input_modalities || architecture.inputModalities
        : architecture.output_modalities || architecture.outputModalities;

    const modalityString =
      typeof architecture.modality === "string" ? architecture.modality : "";
    const parsedFromModalityString = this.parseArchitectureModality(
      modalityString,
      direction,
    );

    const merged = [
      ...this.normalizeStringArray(direct),
      ...this.normalizeStringArray(architectureValue),
      ...parsedFromModalityString,
    ];

    return Array.from(new Set(merged));
  }

  private parseArchitectureModality(
    modality: string,
    direction: "input" | "output",
  ): string[] {
    if (!modality) {
      return [];
    }

    const [input = "", output = ""] = modality
      .toLowerCase()
      .split("->")
      .map((part) => part.trim());
    const segment = direction === "input" ? input : output;

    return segment
      .split(/[+,/\s]+/)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  private normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.toLowerCase());
  }

  private modalitiesInclude(
    modalities: string[],
    ...needles: string[]
  ): boolean | undefined {
    if (modalities.length === 0) {
      return undefined;
    }

    return needles.some((needle) =>
      modalities.some((modality) => modality.includes(needle)),
    );
  }

  private supportedParametersInclude(
    model: any,
    ...needles: string[]
  ): boolean {
    const parameters = this.normalizeStringArray(
      model.supported_parameters || model.supportedParameters,
    );

    return needles.some((needle) =>
      parameters.some((parameter) => parameter.includes(needle)),
    );
  }

  /**
   * Get metadata for a model ID. Lookup is case-insensitive.
   */
  getModelInfo(modelId: string): ModelMetadata | null {
    return this.models.get(modelId.toLowerCase()) ?? null;
  }
}

export const modelRegistry = new ModelRegistry();
