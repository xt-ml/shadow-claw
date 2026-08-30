import { jest } from "@jest/globals";
import { modelRegistry } from "./model-registry.js";

describe("ModelRegistry", () => {
  beforeEach(() => {
    modelRegistry.models.clear();
  });

  it("should register and get model info", () => {
    modelRegistry.registerModelInfo("test-model", {
      contextWindow: 12345,
      maxOutput: 500,
    });

    const info = modelRegistry.getModelInfo("test-model");
    expect(info).toEqual({
      contextWindow: 12345,
      maxOutput: 500,
    });
  });

  it("should return null for unknown model", () => {
    const info = modelRegistry.getModelInfo("unknown");
    expect(info).toBeNull();
  });

  it("should fetch model info from OpenRouter format", async () => {
    const mockData: any = {
      data: [
        {
          id: "openrouter/free",
          context_length: 200000,
          per_request_limits: { completion_tokens: 4096 },
        },
        {
          id: "anthropic/claude-3-sonnet",
          context_length: 200000,
          top_provider: { max_completion_tokens: 8192 },
        },
      ],
    };

    const originalFetch = (globalThis as any).fetch;

    (globalThis as any).fetch = async () => ({
      ok: true,
      json: async () => mockData,
    });

    try {
      await modelRegistry.fetchModelInfo({
        id: "openrouter",
        modelsUrl: "https://openrouter.ai/api/v1/models",
        headers: {},
      } as any);

      expect(modelRegistry.getModelInfo("openrouter/free")).toEqual({
        contextWindow: 200000,
        maxOutput: 4096,
        routesByRequestFeatures: true,
      });

      expect(modelRegistry.getModelInfo("anthropic/claude-3-sonnet")).toEqual({
        contextWindow: 200000,
        maxOutput: 8192,
      });
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  });

  it("should fetch model info from models array payload format", async () => {
    const mockData: any = {
      models: [
        {
          id: "custom/test-model",
          context_window: 8000,
          max_completion_tokens: 4096,
        },
      ],
    };

    const originalFetch = (globalThis as any).fetch;

    (globalThis as any).fetch = async () => ({
      ok: true,
      json: async () => mockData,
    });

    try {
      await modelRegistry.fetchModelInfo({
        id: "custom_provider",
        modelsUrl: "http://localhost:8888/custom-proxy/models",
        headers: {},
      } as any);

      expect(modelRegistry.getModelInfo("custom/test-model")).toEqual({
        contextWindow: 8000,
        maxOutput: 4096,
      });
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  });

  it("should parse supports_tools metadata when provided", async () => {
    const mockData: any = {
      data: [
        {
          id: "deepseek-r1:1.5b",
          context_length: 65536,
          supports_tools: false,
        },
      ],
    };

    const originalFetch = (globalThis as any).fetch;

    (globalThis as any).fetch = async () => ({
      ok: true,
      json: async () => mockData,
    });

    try {
      await modelRegistry.fetchModelInfo({
        id: "ollama",
        modelsUrl: "http://localhost:8888/ollama-proxy/models",
        headers: {},
      } as any);

      expect(modelRegistry.getModelInfo("deepseek-r1:1.5b")).toEqual({
        contextWindow: 65536,
        maxOutput: null,
        supportsTools: false,
      });
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  });

  it("should parse input modalities from architecture metadata when provided", async () => {
    const mockData: any = {
      data: [
        {
          id: "openai/gpt-4.1",
          context_length: 128000,
          architecture: {
            input_modalities: ["text", "image"],
            output_modalities: ["text"],
          },
        },
      ],
    };

    const originalFetch = (globalThis as any).fetch;

    (globalThis as any).fetch = async () => ({
      ok: true,
      json: async () => mockData,
    });

    try {
      await modelRegistry.fetchModelInfo({
        id: "openrouter",
        modelsUrl: "https://openrouter.ai/api/v1/models",
        headers: {},
      } as any);

      expect(modelRegistry.getModelInfo("openai/gpt-4.1")).toEqual({
        contextWindow: 128000,
        maxOutput: null,
        inputModalities: ["text", "image"],
        outputModalities: ["text"],
        supportsAudioInput: false,
        supportsImageInput: true,
        supportsVideoInput: false,
      });
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  });

  it("should parse OpenRouter reasoning metadata when provided", async () => {
    const mockData: any = {
      data: [
        {
          id: "anthropic/claude-sonnet-5",
          context_length: 1000000,
          reasoning: {
            default_effort: "medium",
            default_enabled: true,
            mandatory: false,
            supported_efforts: ["high", "medium", "low", "minimal"],
            supports_max_tokens: true,
          },
        },
      ],
    };

    const originalFetch = (globalThis as any).fetch;

    (globalThis as any).fetch = async () => ({
      ok: true,
      json: async () => mockData,
    });

    try {
      await modelRegistry.fetchModelInfo({
        id: "openrouter",
        modelsUrl: "https://openrouter.ai/api/v1/models",
        headers: {},
      } as any);

      expect(modelRegistry.getModelInfo("anthropic/claude-sonnet-5")).toEqual({
        contextWindow: 1000000,
        maxOutput: null,
        reasoning: {
          defaultEffort: "medium",
          defaultEnabled: true,
          mandatory: false,
          supportedEfforts: ["high", "medium", "low", "minimal"],
          supportsMaxTokens: true,
        },
      });
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  });

  it("should mark openrouter/free as routing by request features", async () => {
    const mockData: any = {
      data: [
        {
          id: "openrouter/free",
          context_length: 200000,
        },
      ],
    };

    const originalFetch = (globalThis as any).fetch;

    (globalThis as any).fetch = async () => ({
      ok: true,
      json: async () => mockData,
    });

    try {
      await modelRegistry.fetchModelInfo({
        id: "openrouter",
        modelsUrl: "https://openrouter.ai/api/v1/models",
        headers: {},
      } as any);

      expect(modelRegistry.getModelInfo("openrouter/free")).toEqual({
        contextWindow: 200000,
        maxOutput: null,
        routesByRequestFeatures: true,
      });
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  });

  it("should clear registered models", () => {
    modelRegistry.registerModelInfo("model-to-clear", {
      contextWindow: 4096,
      maxOutput: 1024,
    });
    expect(modelRegistry.getModelInfo("model-to-clear")).not.toBeNull();
    modelRegistry.clear();
    expect(modelRegistry.getModelInfo("model-to-clear")).toBeNull();
  });

  it("should do nothing when provider has no modelsUrl", async () => {
    await expect(
      modelRegistry.fetchModelInfo({ id: "no-url" } as any),
    ).resolves.toBeUndefined();
  });

  it("should handle apiKeyHeader, apiKeyHeaderFormat, headers, and extraHeaders", async () => {
    const originalFetch = (globalThis as any).fetch;
    let sentHeaders: any = null;

    (globalThis as any).fetch = async (_url: string, opts: any) => {
      sentHeaders = opts.headers;
      return {
        ok: true,
        json: async () => ({
          data: [{ id: "test-auth-model", context_length: 16000 }],
        }),
      };
    };

    try {
      await modelRegistry.fetchModelInfo(
        {
          id: "hf-provider",
          modelsUrl: "https://api.hf.co/models",
          headers: { "X-Custom": "CustomVal" },
          apiKeyHeader: "Authorization",
          apiKeyHeaderFormat: "Bearer {key}",
        } as any,
        "secret-key",
        { "X-Extra": "ExtraVal" },
      );

      expect(sentHeaders.get("Authorization")).toBe("Bearer secret-key");
      expect(sentHeaders.get("X-Custom")).toBe("CustomVal");
      expect(sentHeaders.get("X-Extra")).toBe("ExtraVal");
      expect(modelRegistry.getModelInfo("test-auth-model")).toEqual({
        contextWindow: 16000,
        maxOutput: null,
      });
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  });

  it("should handle error when fetch response is not ok", async () => {
    const originalFetch = (globalThis as any).fetch;
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    (globalThis as any).fetch = async () => ({
      ok: false,
      status: 403,
      statusText: "Forbidden",
    });

    try {
      await modelRegistry.fetchModelInfo({
        id: "fail-provider",
        modelsUrl: "https://fail.com/models",
      } as any);

      expect(consoleSpy).toHaveBeenCalledWith(
        "[ModelRegistry] Error fetching models for fail-provider:",
        expect.any(Error),
      );
      expect(modelRegistry.loading).toBe(false);
    } finally {
      (globalThis as any).fetch = originalFetch;
      consoleSpy.mockRestore();
    }
  });

  it("should parse text->image architecture modality string", async () => {
    const originalFetch = (globalThis as any).fetch;
    (globalThis as any).fetch = async () => ({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "vision-model",
            context_length: 32000,
            architecture: {
              modality: "text+image->text",
            },
          },
        ],
      }),
    });

    try {
      await modelRegistry.fetchModelInfo({
        id: "vision-provider",
        modelsUrl: "https://vision.com/models",
      } as any);

      expect(
        modelRegistry.getModelInfo("vision-model")?.supportsImageInput,
      ).toBe(true);
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  });
});
