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

  it("should fetch model info from Copilot Proxy format", async () => {
    const mockData: any = {
      models: [
        {
          id: "copilot/gpt-4o",
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
        id: "copilot",
        modelsUrl: "http://localhost:8888/copilot-proxy/azure-openai/models",
        headers: {},
      } as any);

      expect(modelRegistry.getModelInfo("copilot/gpt-4o")).toEqual({
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
});
