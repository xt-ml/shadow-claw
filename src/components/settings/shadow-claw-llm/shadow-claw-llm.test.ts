import { jest } from "@jest/globals";

const PROVIDERS: any = {
  "provider-a": {
    id: "provider-a",
    name: "Provider A",
    defaultModel: "model-a",
    models: [
      { id: "model-a", supports_tools: true, context_length: 8192 },
      { id: "model-b", supports_tools: false, context_length: 8192 },
    ],
    requiresApiKey: true,
  },
  "provider-b": {
    id: "provider-b",
    name: "Provider B",
    defaultModel: "model-c",
    requiresApiKey: false,
  },
  llamafile: {
    id: "llamafile",
    name: "Llamafile",
    defaultModel: "",
    modelsUrl: "http://localhost:8888/llamafile-proxy/models",
    requiresApiKey: false,
    headers: {},
  },
  transformers_js_browser: {
    id: "transformers_js_browser",
    name: "Transformers.js (Browser - No Proxy - Experimental)",
    defaultModel: "Xenova/distilgpt2",
    models: ["Xenova/distilgpt2"],
    requiresApiKey: false,
  },
};

jest.unstable_mockModule("../../../config/config.js", () => ({
  ASSISTANT_NAME: "example",
  CONFIG_KEYS: {
    PROVIDER: "provider",
    API_KEY: "api_key",
    MODEL: "model",
    MAX_TOKENS: "max_tokens",
    ASSISTANT_NAME: "assistant_name",
    STREAMING_ENABLED: "streaming_enabled",
    MAX_ITERATIONS: "max_iterations",
    RATE_LIMIT_CALLS_PER_MINUTE: "rate_limit_calls_per_minute",
    RATE_LIMIT_AUTO_ADAPT: "rate_limit_auto_adapt",
    REASONING_EFFORT: "reasoning_effort",
    USE_PROXY: "use_proxy",
    CONTEXT_COMPRESSION: "context_compression",
    SUBAGENT_MAX_PARALLEL: "subagent_max_parallel",
    SUBAGENT_WORKSPACE_MODE: "subagent_workspace_mode",
    PROMPT_API_BACKEND: "prompt_api_backend",
    PROMPT_API_DTYPE_STRATEGY: "prompt_api_dtype_strategy",
    PROMPT_API_FALLBACK_MODEL: "prompt_api_fallback_model",
    TRANSFORMERS_JS_BACKEND: "transformers_js_backend",
    TRANSFORMERS_JS_DTYPE_STRATEGY: "transformers_js_dtype_strategy",
  },
  DEFAULT_MAX_ITERATIONS: 50,
  DEFAULT_CONTROL_PLANE_ENABLED: false,
  DEFAULT_CONTROL_PLANE_TRANSPORT: "http",
  DEFAULT_SUBAGENT_MAX_PARALLEL: 5,
  DEFAULT_SUBAGENT_WORKSPACE_MODE: "automatic",
  DEFAULT_PROMPT_API_FALLBACK_MODEL: "onnx-community/Qwen3-0.6B-ONNX",
  DEFAULT_GROUP_ID: "br:main",
  OPFS_ROOT: "shadowclaw",
  PROVIDERS,
  buildTriggerPattern: jest.fn().mockReturnValue(new RegExp("")),
  getModelMaxTokens: jest.fn((modelId: string) =>
    (modelId || "").includes("thinking") ? 4096 : 8192,
  ),
  getAvailableProviders: () => Object.values(PROVIDERS),
  getProvider: (id: string) => (PROVIDERS as any)[id],
  GENERAL_ACCOUNT_PROVIDER_CAPABILITIES: [],
  OAUTH_PROVIDER_DEFINITIONS: {},
  PROVIDER_AUTH_CAPABILITIES: {},
  getGeneralAccountProviderCapabilities: jest.fn(),
  getProviderTokenAuthScheme: jest.fn(),
  DEFAULT_DEV_HOST: "http://localhost:8888",
  DEFAULT_DEV_PORT: 8888,
  BASH_DEFAULT_TIMEOUT_SEC: 60,
  BASH_MAX_TIMEOUT_SEC: 300,
  DEFAULT_VM_NETWORK_RELAY_URL: "",
  FETCH_MAX_RESPONSE: 50 * 1024 * 1024,
  getProviderApiKeyConfigKey: jest.fn(),
}));

jest.unstable_mockModule("../../../db/set-config.js", () => ({
  setConfig: jest.fn<any>().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../../../db/get-config.js", () => ({
  getConfig: jest.fn<any>().mockResolvedValue(undefined),
}));

const mockSetProvider = jest.fn(async () => {});
const mockSetBedrockSettings = jest.fn(async () => {});
const mockSetMaxTokens = jest.fn(async () => {});
const mockSetRateLimitCallsPerMinute = jest.fn(async () => {});
const mockSetRateLimitAutoAdapt = jest.fn(async () => {});
const mockSetReasoningEffort = jest.fn(async () => {});
const mockSetMaxIterations = jest.fn(async () => {});
const mockSetLlamafileSettings = jest.fn(async () => {});
const mockSetContextCompressionEnabled = jest.fn(async () => {});
const mockSetStreamingEnabled = jest.fn(async () => {});
const mockSetModel = jest.fn(async () => {});

jest.unstable_mockModule(
  "../../../core/orchestrator/utils/operations/provider.js",
  () => ({
    getAvailableProviders: jest.fn(() =>
      Object.entries(PROVIDERS).map(([id, p]: [string, any]) => ({
        ...p,
        id,
        name: p.name,
        models: p.models,
        modelsUrl: p.modelsUrl,
        headers: p.headers,
        requiresApiKey: p.requiresApiKey,
      })),
    ),
    getBedrockSettings: jest.fn().mockReturnValue({
      authMode: "iam_keys",
      profile: "",
      region: "us-east-1",
    }),
    getLlamafileSettings: jest.fn().mockReturnValue({
      host: "http://127.0.0.1:8080",
    }),
    getMeshLlmSettings: jest.fn().mockReturnValue({
      host: "http://localhost:11434",
    }),
    getReasoningConfig: jest.fn().mockReturnValue(undefined),
    applyLlamafileHeaders: jest.fn(),
    applyMeshLlmHeaders: jest.fn(),
    getTransformersStatusUrl: jest.fn(),
    getProviderRuntimeHeaders: jest.fn().mockReturnValue({}),
    setProvider: mockSetProvider,
    setBedrockSettings: mockSetBedrockSettings,
    setLlamafileSettings: mockSetLlamafileSettings,
    setMeshLlmSettings: jest.fn(async () => {}),
    setModel: mockSetModel,
    setAssistantName: jest.fn(async () => {}),
    setPeerjsMyAlias: jest.fn(async () => {}),
    setPeerjsPeerAliases: jest.fn(async () => {}),
    autoActivateProfile: jest.fn(async () => {}),
    stopTransformersProgressPolling: jest.fn(),
    getApiKeyForHeaders: jest.fn<any>().mockResolvedValue(""),
    getApiKeyForRequest: jest.fn<any>().mockResolvedValue(""),
  }),
);

jest.unstable_mockModule(
  "../../../core/orchestrator/utils/settings.js",
  () => ({
    setMaxTokens: mockSetMaxTokens,
    setRateLimitCallsPerMinute: mockSetRateLimitCallsPerMinute,
    setRateLimitAutoAdapt: mockSetRateLimitAutoAdapt,
    setReasoningEffort: mockSetReasoningEffort,
    setGitProxyUrl: jest.fn(async () => {}),
    setProxyUrl: jest.fn(async () => {}),
    setVmInternetAccess: jest.fn(async () => {}),
    setStreamingEnabled: mockSetStreamingEnabled,
    setUseProxy: jest.fn(async () => {}),
    setVMBashFullInternetAccess: jest.fn(async () => {}),
    setContextCompressionEnabled: mockSetContextCompressionEnabled,
    setMaxIterations: mockSetMaxIterations,
  }),
);

jest.unstable_mockModule("../../../ui/toast.js", () => ({
  showError: jest.fn(),
  showSuccess: jest.fn(),
  showWarning: jest.fn(),
  showInfo: jest.fn(),
  showToast: jest.fn(),
}));

jest.unstable_mockModule("../../../db/db.js", () => ({
  getDb: jest.fn<any>().mockResolvedValue({
    transaction: jest.fn(() => ({
      objectStore: jest.fn(() => ({
        get: jest.fn(() => ({
          onsuccess: null,
          onerror: null,
        })),
        put: jest.fn(() => ({
          onsuccess: null,
          onerror: null,
        })),
      })),
    })),
  }),
}));

const { orchestratorStore } = await import("../../../stores/orchestrator.js");
const { ShadowClawLlm } = await import("./shadow-claw-llm.js");
const { showSuccess, showWarning, showError } =
  await import("../../../ui/toast.js");
const { getConfig } = await import("../../../db/get-config.js");
const { setConfig } = await import("../../../db/set-config.js");

function createOrchestratorStub(overrides = {}) {
  const base = {
    setApiKey: jest.fn<any>().mockResolvedValue(undefined),
    setProvider: jest.fn<any>().mockResolvedValue(undefined),
    setModel: jest.fn<any>().mockResolvedValue(undefined),
    setAssistantName: jest.fn<any>().mockResolvedValue(undefined),
    setMaxTokens: jest.fn<any>().mockResolvedValue(undefined),
    setMaxIterations: jest.fn<any>().mockResolvedValue(undefined),
    setRateLimitCallsPerMinute: jest.fn<any>().mockResolvedValue(undefined),
    setRateLimitAutoAdapt: jest.fn<any>().mockResolvedValue(undefined),
    setReasoningEffort: jest.fn<any>().mockResolvedValue(undefined),
    setStreamingEnabled: jest.fn<any>().mockResolvedValue(undefined),
    setUseProxy: jest.fn<any>().mockResolvedValue(undefined),
    setBedrockSettings: jest.fn<any>().mockResolvedValue(undefined),
    setCompressionEnabled: jest.fn<any>().mockResolvedValue(undefined),
    getAvailableProviders: jest
      .fn<any>()
      .mockReturnValue(Object.values(PROVIDERS)),
    getProvider: jest.fn<any>().mockReturnValue("provider-a"),
    getModel: jest.fn<any>().mockReturnValue("model-a"),
    getAssistantName: jest.fn<any>().mockReturnValue("Claw"),
    getMaxTokens: jest.fn<any>().mockReturnValue(4096),
    getMaxIterations: jest.fn<any>().mockReturnValue(50),
    getRateLimitCallsPerMinute: jest.fn<any>().mockReturnValue(0),
    getRateLimitAutoAdapt: jest.fn<any>().mockReturnValue(true),
    getReasoningEffort: jest.fn<any>().mockReturnValue("none"),
    getStreamingEnabled: jest.fn<any>().mockReturnValue(true),
    getApiKeyForRequest: jest.fn<any>().mockResolvedValue(""),
    getApiKeyForHeaders: jest.fn<any>().mockResolvedValue(""),
    loadApiKeyForProvider: jest.fn<any>().mockResolvedValue(undefined),

    getUseProxy: jest.fn<any>().mockReturnValue(false),
    getCompressionEnabled: jest.fn<any>().mockReturnValue(false),
    getContextCompressionEnabled: jest.fn<any>().mockReturnValue(false),
    getBedrockSettings: jest
      .fn<any>()
      .mockReturnValue({ region: "", profile: "" }),
    getProxyUrl: jest.fn<any>().mockReturnValue(""),
    ...overrides,
  };

  const propertyMapping: Record<string, string> = {
    provider: "getProvider",
    model: "getModel",
    assistantName: "getAssistantName",
    maxTokens: "getMaxTokens",
    maxIterations: "getMaxIterations",
    rateLimitCallsPerMinute: "getRateLimitCallsPerMinute",
    rateLimitAutoAdapt: "getRateLimitAutoAdapt",
    reasoningEffort: "getReasoningEffort",
    streamingEnabled: "getStreamingEnabled",
    contextCompressionEnabled: "getContextCompressionEnabled",
  };

  for (const [prop, methodName] of Object.entries(propertyMapping)) {
    if (!(prop in base)) {
      Object.defineProperty(base, prop, {
        get() {
          return (this as any)[methodName]();
        },
        set(val: any) {
          (this as any)[methodName].mockReturnValue(val);
        },
        configurable: true,
      });
    }
  }

  return base;
}

describe("shadow-claw-llm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.fetch = jest.fn<any>().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
  });

  it("registers custom element", () => {
    expect(customElements.get("shadow-claw-llm")).toBe(ShadowClawLlm);
  });

  it("renders selectors correctly", async () => {
    const orch = createOrchestratorStub();
    (orchestratorStore as any).orchestrator = orch;

    const el = new ShadowClawLlm();
    document.body.appendChild(el);
    // Allow connectedCallback to proceed
    await new Promise((r) => setTimeout(r, 100));
    await el.render();

    const providerSelect = el.shadowRoot?.querySelector(
      '[data-setting="provider-select"]',
    ) as HTMLSelectElement | null;
    expect(providerSelect).not.toBeNull();
    // In our stub it should have options
    expect(providerSelect?.options.length).toBeGreaterThan(0);

    document.body.removeChild(el);
  });

  it("shows tools support icons for model options", async () => {
    const orch = createOrchestratorStub();
    (orchestratorStore as any).orchestrator = orch;

    const el = new ShadowClawLlm();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 100));
    await el.render();

    const modelSelect = el.shadowRoot?.querySelector(
      '[data-setting="model-select"]',
    ) as HTMLSelectElement | null;
    expect(modelSelect).not.toBeNull();

    const optionsText = Array.from(modelSelect?.options || []).map(
      (o) => o.textContent || "",
    );
    expect(optionsText.some((text) => text.includes("🚫🛠️"))).toBe(true);
    expect(optionsText.some((text) => text.includes(" 🛠️"))).toBe(true);

    document.body.removeChild(el);
  });

  it("renders identical top 4 models, hr divider, and alphabetized remainder for transformers_js_browser", async () => {
    const orch = createOrchestratorStub();
    orch.getProvider.mockReturnValue("transformers_js_browser");
    orch.getModel.mockReturnValue("onnx-community/Qwen3-0.6B-ONNX");
    (orchestratorStore as any).orchestrator = orch;

    const el = new ShadowClawLlm();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 100));
    await el.render();

    const modelSelect = el.shadowRoot?.querySelector(
      '[data-setting="model-select"]',
    ) as HTMLSelectElement | null;
    expect(modelSelect).not.toBeNull();

    const html = modelSelect?.innerHTML || "";
    expect(html).toContain('value="onnx-community/Qwen3-0.6B-ONNX"');
    expect(html).toContain('value="onnx-community/gemma-3-1b-it-ONNX-GQA"');
    expect(html).toContain('value="onnx-community/gemma-4-E2B-it-ONNX"');
    expect(html).toContain('value="onnx-community/gemma-4-E4B-it-ONNX"');

    const idxGemma4E4B = html.indexOf(
      'value="onnx-community/gemma-4-E4B-it-ONNX"',
    );
    const idxHr = html.indexOf("<hr>");
    const idxXenova = html.indexOf('value="Xenova/distilgpt2"');

    expect(idxHr).toBeGreaterThan(idxGemma4E4B);
    expect(idxHr).toBeLessThan(idxXenova);
    expect(html).toContain('value="__custom__"');

    document.body.removeChild(el);
  });

  it("saves max tokens from settings", async () => {
    const orch = createOrchestratorStub();
    (orchestratorStore as any).orchestrator = orch;

    const el = new ShadowClawLlm();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 100));
    await el.render();

    const input = el.shadowRoot?.querySelector(
      '[data-setting="max-tokens-input"]',
    ) as HTMLInputElement | null;
    expect(input).not.toBeNull();

    if (!input) {
      throw new Error("max tokens input not found");
    }

    input.value = "2048";
    await el.saveMaxTokens();

    expect(mockSetMaxTokens).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      2048,
    );
    expect(showSuccess).toHaveBeenCalledWith("Max tokens saved", 3000);

    document.body.removeChild(el);
  });

  it("saves bedrock fallback settings", async () => {
    const orch = createOrchestratorStub({
      getProvider: jest.fn<any>().mockReturnValue("bedrock_proxy"),
      getBedrockSettings: jest
        .fn<any>()
        .mockReturnValue({ region: "", profile: "" }),
    });
    (orchestratorStore as any).orchestrator = orch;

    const el = new ShadowClawLlm();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 100));
    await el.render();

    const regionInput = el.shadowRoot?.querySelector(
      '[data-setting="bedrock-region-input"]',
    ) as HTMLInputElement | null;
    const profileInput = el.shadowRoot?.querySelector(
      '[data-setting="bedrock-profile-input"]',
    ) as HTMLInputElement | null;

    if (!regionInput || !profileInput) {
      throw new Error("bedrock inputs not found");
    }

    regionInput.value = "us-east-1";
    profileInput.value = "default";

    await el.saveBedrockSettings();

    expect(mockSetBedrockSettings).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      {
        region: "us-east-1",
        profile: "default",
        authMode: "provider_chain",
      },
    );
    expect(showSuccess).toHaveBeenCalledWith(
      "Bedrock fallback settings saved",
      3000,
    );

    document.body.removeChild(el);
  });

  it("saves rate limit settings", async () => {
    const orch = createOrchestratorStub();
    (orchestratorStore as any).orchestrator = orch;

    const el = new ShadowClawLlm();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 100));
    await el.render();

    const callsInput = el.shadowRoot?.querySelector(
      '[data-setting="rate-limit-calls-per-minute-input"]',
    ) as HTMLInputElement | null;
    const autoToggle = el.shadowRoot?.querySelector(
      '[data-setting="rate-limit-auto-adapt-toggle"]',
    ) as HTMLInputElement | null;

    if (!callsInput || !autoToggle) {
      throw new Error("rate limit controls not found");
    }

    callsInput.value = "16";
    autoToggle.checked = true;

    await el.saveRateLimitSettings();

    expect(mockSetRateLimitCallsPerMinute).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      16,
    );
    expect(mockSetRateLimitAutoAdapt).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      true,
    );
    expect(showSuccess).toHaveBeenCalledWith("Rate limit settings saved", 3000);

    document.body.removeChild(el);
  });

  it("saves reasoning effort from settings", async () => {
    const orch = createOrchestratorStub();
    (orchestratorStore as any).orchestrator = orch;

    const el = new ShadowClawLlm();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 100));
    await el.render();

    const select = el.shadowRoot?.querySelector(
      '[data-setting="reasoning-effort-select"]',
    ) as HTMLSelectElement | null;

    if (!select) {
      throw new Error("reasoning effort select not found");
    }

    select.value = "high";
    await el.saveReasoningEffort();

    expect(mockSetReasoningEffort).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "high",
    );
    expect(showSuccess).toHaveBeenCalledWith("Reasoning effort saved", 3000);

    document.body.removeChild(el);
  });

  it("opens llamafile help dialog instead of generic toast when model discovery fails", async () => {
    const orch = createOrchestratorStub({
      getProvider: jest.fn<any>().mockReturnValue("llamafile"),
      getModel: jest.fn<any>().mockReturnValue(""),
      getLlamafileSettings: jest.fn<any>().mockReturnValue({
        mode: "cli",
        host: "127.0.0.1",
        port: 8080,
        offline: true,
      }),
    });
    (orchestratorStore as any).orchestrator = orch;

    const originalFetch = global.fetch;
    const fetchMock = jest
      .fn<any>()
      .mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/llamafile-proxy/models")) {
          return Promise.reject(new Error("ENOENT: assets/llamafile missing"));
        }

        return originalFetch(input as any, init as any);
      });
    global.fetch = fetchMock;

    const requestDialog = jest.fn<any>().mockResolvedValue(true);
    const querySpy = jest
      .spyOn(document, "querySelector")
      .mockImplementation((selector) => {
        if (selector === "shadow-claw") {
          return { requestDialog } as any;
        }

        return null;
      });

    const el = new ShadowClawLlm();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 120));
    await el.render();
    await new Promise((r) => setTimeout(r, 50));

    expect(requestDialog).toHaveBeenCalled();
    expect(showError).not.toHaveBeenCalledWith(
      "Could not reach the model server — or proxy configuration is wrong",
      5000,
    );

    global.fetch = originalFetch;
    querySpy.mockRestore();

    document.body.removeChild(el);
  });

  it("shows Transformers.js Browser settings only for transformers_js_browser provider", async () => {
    const orch = createOrchestratorStub({
      getProvider: jest.fn<any>().mockReturnValue("transformers_js_browser"),
      getModel: jest.fn<any>().mockReturnValue("Xenova/distilgpt2"),
    });
    (orchestratorStore as any).orchestrator = orch;

    const el = new ShadowClawLlm();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 100));
    await el.render();

    const section = el.shadowRoot?.querySelector(
      '[data-setting="transformers-js-settings"]',
    ) as HTMLElement | null;
    const providerSelect = el.shadowRoot?.querySelector(
      '[data-setting="provider-select"]',
    ) as HTMLSelectElement | null;

    if (!section || !providerSelect) {
      throw new Error("required settings controls not found");
    }

    expect(section.style.display).toBe("block");

    const opt = document.createElement("option");
    opt.value = "openai";
    providerSelect.appendChild(opt);

    providerSelect.value = "openai";
    await el.onProviderChange();

    expect(mockSetProvider).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "openai",
      expect.anything(),
    );
    expect(section.style.display).toBe("none");

    document.body.removeChild(el);
  });

  it("loads saved subagent workspace mode into selector", async () => {
    (getConfig as any).mockImplementation(async (_db: any, key: string) => {
      if (key === "subagent_workspace_mode") {
        return "parent";
      }

      if (key === "subagent_max_parallel") {
        return "7";
      }

      return undefined;
    });

    const orch = createOrchestratorStub();
    (orchestratorStore as any).orchestrator = orch;

    const el = new ShadowClawLlm();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 100));
    await el.render();

    const modeSelect = el.shadowRoot?.querySelector(
      '[data-setting="subagent-workspace-mode-select"]',
    ) as HTMLSelectElement | null;

    if (!modeSelect) {
      throw new Error("subagent workspace mode select not found");
    }

    expect(modeSelect.value).toBe("parent");

    document.body.removeChild(el);
  });

  it("saves subagent workspace mode", async () => {
    const orch = createOrchestratorStub();
    (orchestratorStore as any).orchestrator = orch;

    const el = new ShadowClawLlm();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 100));
    await el.render();

    const modeSelect = el.shadowRoot?.querySelector(
      '[data-setting="subagent-workspace-mode-select"]',
    ) as HTMLSelectElement | null;

    if (!modeSelect) {
      throw new Error("subagent workspace mode select not found");
    }

    modeSelect.value = "isolated";
    await (el as any).saveSubagentWorkspaceMode();

    expect(setConfig).toHaveBeenCalledWith(
      expect.anything(),
      "subagent_workspace_mode",
      "isolated",
    );
    expect(showSuccess).toHaveBeenCalledWith(
      "Subagent workspace mode saved",
      3000,
    );

    document.body.removeChild(el);
  });

  it("defaults Prompt API fallback model to Qwen3-0.6B-ONNX when not configured", async () => {
    (getConfig as any).mockImplementation(async (_db: any, key: string) => {
      if (key === "prompt_api_fallback_model") {
        return undefined;
      }
      return undefined;
    });

    const orch = createOrchestratorStub({
      getProvider: jest.fn<any>().mockReturnValue("prompt_api"),
    });
    (orchestratorStore as any).orchestrator = orch;

    const el = new ShadowClawLlm();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 100));
    await el.render();

    const fallbackSelect = el.shadowRoot?.querySelector(
      '[data-setting="prompt-api-fallback-select"]',
    ) as HTMLSelectElement | null;

    expect(fallbackSelect).not.toBeNull();
    expect(fallbackSelect?.value).toBe("onnx-community/Qwen3-0.6B-ONNX");

    document.body.removeChild(el);
  });

  it("loads configured Prompt API fallback model when set in DB", async () => {
    (getConfig as any).mockImplementation(async (_db: any, key: string) => {
      if (key === "prompt_api_fallback_model") {
        return "onnx-community/gemma-3-1b-it-ONNX-GQA";
      }
      return undefined;
    });

    const orch = createOrchestratorStub({
      getProvider: jest.fn<any>().mockReturnValue("prompt_api"),
    });
    (orchestratorStore as any).orchestrator = orch;

    const el = new ShadowClawLlm();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 100));
    await el.render();

    const fallbackSelect = el.shadowRoot?.querySelector(
      '[data-setting="prompt-api-fallback-select"]',
    ) as HTMLSelectElement | null;

    expect(fallbackSelect).not.toBeNull();
    expect(fallbackSelect?.value).toBe("onnx-community/gemma-3-1b-it-ONNX-GQA");

    document.body.removeChild(el);
  });

  it("loads configured Gemma 4 E2B Prompt API fallback model when set in DB", async () => {
    (getConfig as any).mockImplementation(async (_db: any, key: string) => {
      if (key === "prompt_api_fallback_model") {
        return "onnx-community/gemma-4-E2B-it-ONNX";
      }
      return undefined;
    });

    const orch = createOrchestratorStub({
      getProvider: jest.fn<any>().mockReturnValue("prompt_api"),
    });
    (orchestratorStore as any).orchestrator = orch;

    const el = new ShadowClawLlm();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 100));
    await el.render();

    const fallbackSelect = el.shadowRoot?.querySelector(
      '[data-setting="prompt-api-fallback-select"]',
    ) as HTMLSelectElement | null;

    expect(fallbackSelect).not.toBeNull();
    expect(fallbackSelect?.value).toBe("onnx-community/gemma-4-E2B-it-ONNX");

    document.body.removeChild(el);
  });

  it("loads configured Gemma 4 E4B Prompt API fallback model when set in DB", async () => {
    (getConfig as any).mockImplementation(async (_db: any, key: string) => {
      if (key === "prompt_api_fallback_model") {
        return "onnx-community/gemma-4-E4B-it-ONNX";
      }
      return undefined;
    });

    const orch = createOrchestratorStub({
      getProvider: jest.fn<any>().mockReturnValue("prompt_api"),
    });
    (orchestratorStore as any).orchestrator = orch;

    const el = new ShadowClawLlm();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 100));
    await el.render();

    const fallbackSelect = el.shadowRoot?.querySelector(
      '[data-setting="prompt-api-fallback-select"]',
    ) as HTMLSelectElement | null;

    expect(fallbackSelect).not.toBeNull();
    expect(fallbackSelect?.value).toBe("onnx-community/gemma-4-E4B-it-ONNX");

    document.body.removeChild(el);
  });

  it("loads configured Prompt API device and dtype settings and saves them on saveModel", async () => {
    (getConfig as any).mockImplementation(async (_db: any, key: string) => {
      if (key === "prompt_api_backend") {
        return "webgpu";
      }
      if (key === "prompt_api_dtype_strategy") {
        return "q4f16";
      }
      return undefined;
    });

    const orch = createOrchestratorStub({
      getProvider: jest.fn<any>().mockReturnValue("prompt_api"),
      getModel: jest.fn<any>().mockReturnValue("browser-built-in"),
    });
    (orchestratorStore as any).orchestrator = orch;

    const el = new ShadowClawLlm();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 100));
    await el.render();

    const deviceSelect = el.shadowRoot?.querySelector(
      '[data-setting="prompt-api-device-select"]',
    ) as HTMLSelectElement | null;
    const dtypeSelect = el.shadowRoot?.querySelector(
      '[data-setting="prompt-api-dtype-select"]',
    ) as HTMLSelectElement | null;

    expect(deviceSelect).not.toBeNull();
    expect(dtypeSelect).not.toBeNull();
    expect(deviceSelect?.value).toBe("webgpu");
    expect(dtypeSelect?.value).toBe("q4f16");

    deviceSelect!.value = "wasm";
    dtypeSelect!.value = "q4";

    await el.saveModel();

    expect(setConfig).toHaveBeenCalledWith(
      expect.anything(),
      "prompt_api_backend",
      "wasm",
    );
    expect(setConfig).toHaveBeenCalledWith(
      expect.anything(),
      "prompt_api_dtype_strategy",
      "q4",
    );

    document.body.removeChild(el);
  });

  it("updates max tokens recommendation when fallback model is changed", async () => {
    (getConfig as any).mockImplementation(async (_db: any, key: string) => {
      if (key === "prompt_api_fallback_model") {
        return "onnx-community/Qwen3-0.6B-ONNX";
      }
      return undefined;
    });

    const orch = createOrchestratorStub({
      getProvider: jest.fn<any>().mockReturnValue("prompt_api"),
      getModel: jest.fn<any>().mockReturnValue("browser-built-in"),
      getMaxTokens: jest.fn<any>().mockReturnValue(8192),
    });
    (orchestratorStore as any).orchestrator = orch;

    const el = new ShadowClawLlm();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 100));
    await el.render();

    const helper = el.shadowRoot?.querySelector(
      '[data-setting="max-tokens-helper"]',
    ) as HTMLElement | null;

    expect(helper).not.toBeNull();
    expect(helper?.textContent).toContain("131,072 tokens");

    document.body.removeChild(el);
  });

  it("renders and saves Transformers.js browser inference settings", async () => {
    (getConfig as any).mockImplementation(async (_db: any, key: string) => {
      if (key === "transformers_js_backend") {
        return "webgpu";
      }
      if (key === "transformers_js_dtype_strategy") {
        return "q4f16";
      }
      return undefined;
    });

    const orch = createOrchestratorStub({
      getProvider: jest.fn<any>().mockReturnValue("transformers_js_browser"),
      getModel: jest
        .fn<any>()
        .mockReturnValue("onnx-community/Qwen3-0.6B-ONNX"),
    });
    (orchestratorStore as any).orchestrator = orch;

    const el = new ShadowClawLlm();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 100));
    await el.render();

    const deviceSelect = el.shadowRoot?.querySelector(
      '[data-setting="transformers-js-device-select"]',
    ) as HTMLSelectElement | null;
    const dtypeSelect = el.shadowRoot?.querySelector(
      '[data-setting="transformers-js-dtype-select"]',
    ) as HTMLSelectElement | null;

    expect(deviceSelect).not.toBeNull();
    expect(dtypeSelect).not.toBeNull();
    expect(deviceSelect?.value).toBe("webgpu");
    expect(dtypeSelect?.value).toBe("q4f16");

    deviceSelect!.value = "wasm";
    dtypeSelect!.value = "q4";

    await el.saveTransformersJsSettings();

    expect(setConfig).toHaveBeenCalledWith(
      expect.anything(),
      "transformers_js_backend",
      "wasm",
    );
    expect(setConfig).toHaveBeenCalledWith(
      expect.anything(),
      "transformers_js_dtype_strategy",
      "q4",
    );

    document.body.removeChild(el);
  });

  it("saves subagent max parallel, workspace mode, and reasoning effort", async () => {
    const el = new ShadowClawLlm() as any;
    el.db = {};
    el.orchestrator = createOrchestratorStub();
    document.body.appendChild(el);
    await el.render();

    const maxParallelInput = el.shadowRoot?.querySelector(
      '[data-setting="subagent-max-parallel-input"]',
    ) as HTMLInputElement | null;
    if (maxParallelInput) {
      maxParallelInput.value = "8";
    }
    await el.saveSubagentMaxParallel();
    expect(setConfig).toHaveBeenCalledWith(
      expect.anything(),
      "subagent_max_parallel",
      "8",
    );

    const wsModeSelect = el.shadowRoot?.querySelector(
      '[data-setting="subagent-workspace-mode-select"]',
    ) as HTMLSelectElement | null;
    if (wsModeSelect) {
      wsModeSelect.value = "isolated";
    }
    await el.saveSubagentWorkspaceMode();
    expect(setConfig).toHaveBeenCalledWith(
      expect.anything(),
      "subagent_workspace_mode",
      "isolated",
    );

    const reasoningSelect = el.shadowRoot?.querySelector(
      '[data-setting="reasoning-effort-select"]',
    ) as HTMLSelectElement | null;
    if (reasoningSelect) {
      reasoningSelect.value = "high";
    }
    await el.saveReasoningEffort();
    expect(mockSetReasoningEffort).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "high",
    );

    document.body.removeChild(el);
  });

  it("saves max iterations and context compression settings", async () => {
    const el = new ShadowClawLlm() as any;
    el.db = {};
    const orch = createOrchestratorStub();
    (orchestratorStore as any).orchestrator = orch;
    document.body.appendChild(el);
    await el.render();

    const maxIterInput = el.shadowRoot?.querySelector(
      '[data-setting="max-iterations-input"]',
    ) as HTMLInputElement | null;
    if (maxIterInput) {
      maxIterInput.value = "100";
    }
    await el.saveMaxIterations();
    expect(mockSetMaxIterations).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      100,
    );

    await el.onContextCompressionToggle(true);
    expect(mockSetContextCompressionEnabled).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      true,
    );

    document.body.removeChild(el);
  });

  it("saves rate limit settings and applies recommended max tokens", async () => {
    const el = new ShadowClawLlm() as any;
    el.db = {};
    const orch = createOrchestratorStub();
    (orchestratorStore as any).orchestrator = orch;
    document.body.appendChild(el);
    await el.render();

    const rateInput = el.shadowRoot?.querySelector(
      '[data-setting="rate-limit-calls-per-minute-input"]',
    ) as HTMLInputElement | null;
    const adaptInput = el.shadowRoot?.querySelector(
      '[data-setting="rate-limit-auto-adapt-toggle"]',
    ) as HTMLInputElement | null;

    if (rateInput) rateInput.value = "30";
    if (adaptInput) adaptInput.checked = true;

    await el.saveRateLimitSettings();
    expect(mockSetRateLimitCallsPerMinute).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      30,
    );
    expect(mockSetRateLimitAutoAdapt).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      true,
    );

    const maxTokensInput = el.shadowRoot?.querySelector(
      '[data-setting="max-tokens-input"]',
    ) as HTMLInputElement | null;
    await el.applyRecommendedMaxTokens();
    expect(maxTokensInput?.value).toBeTruthy();

    document.body.removeChild(el);
  });

  it("saves bedrock and llamafile settings", async () => {
    const el = new ShadowClawLlm() as any;
    el.db = {};
    const orch = createOrchestratorStub();
    (orchestratorStore as any).orchestrator = orch;
    document.body.appendChild(el);
    await el.render();

    const regionInput = el.shadowRoot?.querySelector(
      '[data-setting="bedrock-region-input"]',
    ) as HTMLInputElement | null;
    const profileInput = el.shadowRoot?.querySelector(
      '[data-setting="bedrock-profile-input"]',
    ) as HTMLInputElement | null;

    if (regionInput) regionInput.value = "us-west-2";
    if (profileInput) profileInput.value = "default";

    await el.saveBedrockSettings();
    expect(mockSetBedrockSettings).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ region: "us-west-2", profile: "default" }),
    );

    const modeInput = el.shadowRoot?.querySelector(
      '[data-setting="llamafile-mode-select"]',
    ) as HTMLSelectElement | null;
    const hostInput = el.shadowRoot?.querySelector(
      '[data-setting="llamafile-host-input"]',
    ) as HTMLInputElement | null;
    const portInput = el.shadowRoot?.querySelector(
      '[data-setting="llamafile-port-input"]',
    ) as HTMLInputElement | null;
    const offlineInput = el.shadowRoot?.querySelector(
      '[data-setting="llamafile-offline-toggle"]',
    ) as HTMLInputElement | null;

    if (modeInput) modeInput.value = "server";
    if (hostInput) hostInput.value = "http://127.0.0.1";
    if (portInput) portInput.value = "8080";
    if (offlineInput) offlineInput.checked = true;

    await el.saveLlamafileSettings();
    expect(mockSetLlamafileSettings).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        mode: "server",
        host: "http://127.0.0.1",
        port: 8080,
        offline: true,
      }),
    );

    document.body.removeChild(el);
  });

  it("handles saveReasoningEffort, saveSubagentMaxParallel, and onStreamingToggle", async () => {
    const orch = createOrchestratorStub();
    (orchestratorStore as any).orchestrator = orch;

    const el = new ShadowClawLlm() as any;
    document.body.appendChild(el);
    await el.render();

    // 1. saveReasoningEffort
    const select = el.shadowRoot?.querySelector(
      '[data-setting="reasoning-effort-select"]',
    ) as HTMLSelectElement | null;
    if (select) select.value = "high";
    await el.saveReasoningEffort();
    expect(mockSetReasoningEffort).toHaveBeenCalledWith(
      orch,
      expect.anything(),
      "high",
    );

    // 2. saveSubagentMaxParallel
    const parallelInput = el.shadowRoot?.querySelector(
      '[data-setting="subagent-max-parallel-input"]',
    ) as HTMLInputElement | null;
    if (parallelInput) parallelInput.value = "5";
    await el.saveSubagentMaxParallel();
    expect(setConfig).toHaveBeenCalledWith(
      expect.anything(),
      "subagent_max_parallel",
      "5",
    );

    // 3. onStreamingToggle
    await el.onStreamingToggle(true);
    expect(mockSetStreamingEnabled).toHaveBeenCalled();

    // 4. saveMaxIterations
    const maxIterInput = el.shadowRoot?.querySelector(
      '[data-setting="max-iterations-input"]',
    ) as HTMLInputElement | null;
    if (maxIterInput) maxIterInput.value = "42";
    await el.saveMaxIterations();
    expect(mockSetMaxIterations).toHaveBeenCalledWith(
      orch,
      expect.anything(),
      42,
    );

    // 5. saveMaxTokens
    const maxTokensInput = el.shadowRoot?.querySelector(
      '[data-setting="max-tokens-input"]',
    ) as HTMLInputElement | null;
    if (maxTokensInput) maxTokensInput.value = "2048";
    await el.saveMaxTokens();
    expect(mockSetMaxTokens).toHaveBeenCalledWith(
      orch,
      expect.anything(),
      2048,
    );

    // 6. saveSubagentWorkspaceMode
    const wsModeSelect = el.shadowRoot?.querySelector(
      '[data-setting="subagent-workspace-mode-select"]',
    ) as HTMLSelectElement | null;
    if (wsModeSelect) wsModeSelect.value = "isolated";
    await el.saveSubagentWorkspaceMode();
    expect(setConfig).toHaveBeenCalledWith(
      expect.anything(),
      "subagent_workspace_mode",
      "isolated",
    );

    // 7. saveApiKey
    const keyInput = el.shadowRoot?.querySelector(
      '[data-setting="api-key-input"]',
    ) as HTMLInputElement | null;
    const providerSelect = el.shadowRoot?.querySelector(
      '[data-setting="provider-select"]',
    ) as HTMLSelectElement | null;
    if (keyInput) keyInput.value = "sk-test-key-123";
    if (providerSelect) providerSelect.value = "provider-a";
    await el.saveApiKey();
    expect(orch.setApiKey).toHaveBeenCalledWith(
      expect.anything(),
      "sk-test-key-123",
    );

    // 8. saveBuiltinAiSettings
    await el.saveBuiltinAiSettings();
    expect(setConfig).toHaveBeenCalled();

    // 9. saveTransformersJsSettings
    await el.saveTransformersJsSettings();
    expect(setConfig).toHaveBeenCalled();

    // 10. showLlamafileHelpDialog
    el.requestAppDialog = jest.fn<any>().mockResolvedValue(undefined);
    await el.showLlamafileHelpDialog("connection refused");
    expect(el.requestAppDialog).toHaveBeenCalled();

    // 11. saveMeshLlmSettings
    const hostInput = el.shadowRoot?.querySelector(
      '[data-setting="mesh-llm-host-input"]',
    ) as HTMLInputElement | null;
    if (hostInput) hostInput.value = "http://localhost:11434";
    await el.saveMeshLlmSettings();

    // 12. updateModelSelector dynamic models
    (global.fetch as any) = jest.fn<any>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        models: [{ id: "dynamic-model-1", name: "Dynamic Model 1" }],
      }),
    });
    orch.getProvider.mockReturnValue("bedrock_proxy");
    el.updateModelSelector();
    await new Promise((resolve) => setTimeout(resolve, 50));

    document.body.removeChild(el);
  });

  it("handles dynamic model fetching for llamafile and bedrock_proxy (success and failure)", async () => {
    const el = new ShadowClawLlm();
    const orch = createOrchestratorStub() as any;
    orch.getProvider.mockReturnValue("llamafile");
    (orchestratorStore as any).orchestrator = orch;
    el.orchestrator = orch;
    el.db = {} as any;
    document.body.appendChild(el);
    await el.connectedCallback();
    await el.render();

    // Success response for llamafile
    (global.fetch as any) = jest.fn<any>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ id: "discovered-llama-1" }],
    });
    el.updateModelSelector();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(el.llamafileDiscoveredModelIds).toContain("discovered-llama-1");

    // Failure response for llamafile
    (global.fetch as any) = jest
      .fn<any>()
      .mockRejectedValue(new Error("Llamafile offline"));
    el.updateModelSelector();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(el.llamafileModelLoadError).toBe("Llamafile offline");

    // Dynamic fetch failure for provider with static fallback
    orch.getProvider.mockReturnValue("provider-a");
    (global.fetch as any) = jest
      .fn<any>()
      .mockRejectedValue(new Error("Network fail"));
    el.updateModelSelector();
    await new Promise((resolve) => setTimeout(resolve, 50));

    document.body.removeChild(el);
  });

  it("handles saveModel for llamafile with request restart", async () => {
    const el = new ShadowClawLlm();
    const orch = createOrchestratorStub() as any;
    orch.getProvider.mockReturnValue("llamafile");
    (orchestratorStore as any).orchestrator = orch;
    el.orchestrator = orch;
    el.db = {} as any;
    document.body.appendChild(el);
    await el.connectedCallback();
    await el.render();

    (orchestratorStore as any).restartCurrentRequest = jest
      .fn<any>()
      .mockResolvedValue(true);
    await el.saveModel();
    expect(showSuccess).toHaveBeenCalledWith(
      "Model saved, request restarted",
      3000,
    );

    (orchestratorStore as any).restartCurrentRequest.mockResolvedValueOnce(
      false,
    );
    await el.saveModel();
    expect(showSuccess).toHaveBeenCalledWith("Model saved", 3000);

    // Save model error
    mockSetModel.mockRejectedValueOnce(new Error("Disk full"));
    await el.saveModel();
    expect(showError).toHaveBeenCalledWith(
      "Error saving model: Disk full",
      6000,
    );

    document.body.removeChild(el);
  });

  it("handles validations for rate limits, subagent parallel, workspace mode, and reasoning effort", async () => {
    const el = new ShadowClawLlm();
    const orch = createOrchestratorStub();
    el.orchestrator = orch as any;
    el.db = {} as any;
    document.body.appendChild(el);
    await el.connectedCallback();
    await el.render();

    // Rate limit input validation
    const callsInput = el.shadowRoot?.querySelector(
      '[data-setting="rate-limit-calls-per-minute-input"]',
    ) as HTMLInputElement;
    if (callsInput) {
      callsInput.value = "-5";
      await el.saveRateLimitSettings();
      expect(showWarning).toHaveBeenCalledWith(
        "Please enter a valid non-negative calls-per-minute value",
        3000,
      );

      callsInput.value = "10";
      await el.saveRateLimitSettings();
      expect(showSuccess).toHaveBeenCalledWith(
        "Rate limit settings saved",
        3000,
      );
    }

    // Subagent max parallel validation
    const parallelInput = el.shadowRoot?.querySelector(
      '[data-setting="subagent-max-parallel-input"]',
    ) as HTMLInputElement;
    if (parallelInput) {
      parallelInput.value = "0";
      await el.saveSubagentMaxParallel();
      expect(showWarning).toHaveBeenCalledWith(
        "Please enter a valid number (1 or higher)",
        3000,
      );

      parallelInput.value = "8";
      await el.saveSubagentMaxParallel();
      expect(showSuccess).toHaveBeenCalledWith("Subagent limit saved", 3000);
    }

    // Subagent workspace mode validation
    const wsModeSelect = el.shadowRoot?.querySelector(
      '[data-setting="subagent-workspace-mode-select"]',
    ) as HTMLSelectElement;
    if (wsModeSelect) {
      wsModeSelect.value = "invalid-mode";
      await el.saveSubagentWorkspaceMode();
      expect(showWarning).toHaveBeenCalledWith(
        "Please select a valid subagent workspace mode",
        3000,
      );

      wsModeSelect.value = "parent";
      await el.saveSubagentWorkspaceMode();
      expect(showSuccess).toHaveBeenCalledWith(
        "Subagent workspace mode saved",
        3000,
      );
    }

    // Null db branches for subagents
    el.db = null;
    await el.saveSubagentMaxParallel();
    expect(showError).toHaveBeenCalledWith("Database not initialized", 3000);

    await el.saveSubagentWorkspaceMode();
    expect(showError).toHaveBeenCalledWith("Database not initialized", 3000);

    // Reasoning effort error path
    el.db = {} as any;
    mockSetReasoningEffort.mockRejectedValueOnce(new Error("Effort invalid"));
    await el.saveReasoningEffort();
    expect(showError).toHaveBeenCalledWith(
      "Error saving reasoning effort: Effort invalid",
      6000,
    );

    document.body.removeChild(el);
  });

  it("handles UI event listeners for buttons and toggles", async () => {
    const el = new ShadowClawLlm();
    const orch = createOrchestratorStub();
    el.orchestrator = orch as any;
    el.db = {} as any;
    document.body.appendChild(el);
    await el.connectedCallback();
    await el.render();

    // Click save-model
    const saveModelBtn = el.shadowRoot?.querySelector(
      '[data-action="save-model"]',
    ) as HTMLElement;
    saveModelBtn?.click();

    // Click refresh-models
    const refreshBtn = el.shadowRoot?.querySelector(
      '[data-action="refresh-models"]',
    ) as HTMLElement;
    refreshBtn?.click();

    // Click save-rate-limit-settings
    const saveRateBtn = el.shadowRoot?.querySelector(
      '[data-action="save-rate-limit-settings"]',
    ) as HTMLElement;
    saveRateBtn?.click();

    // Click save-subagent-max-parallel
    const saveParallelBtn = el.shadowRoot?.querySelector(
      '[data-action="save-subagent-max-parallel"]',
    ) as HTMLElement;
    saveParallelBtn?.click();

    // Click save-subagent-workspace-mode
    const saveWsBtn = el.shadowRoot?.querySelector(
      '[data-action="save-subagent-workspace-mode"]',
    ) as HTMLElement;
    saveWsBtn?.click();

    // Click save-reasoning-effort
    const saveReasoningBtn = el.shadowRoot?.querySelector(
      '[data-action="save-reasoning-effort"]',
    ) as HTMLElement;
    saveReasoningBtn?.click();

    // Model select change to __custom__ shows custom input
    const modelSelect = el.shadowRoot?.querySelector(
      '[data-setting="model-select"]',
    ) as HTMLSelectElement;
    const customInput = el.shadowRoot?.querySelector(
      '[data-setting="custom-model-input"]',
    ) as HTMLElement;
    if (modelSelect && customInput) {
      const optCustom = document.createElement("option");
      optCustom.value = "__custom__";
      modelSelect.appendChild(optCustom);
      modelSelect.value = "__custom__";
      modelSelect.dispatchEvent(new Event("change"));
      expect(customInput.style.display).toBe("block");

      const optModel = document.createElement("option");
      optModel.value = "model-a";
      modelSelect.appendChild(optModel);
      modelSelect.value = "model-a";
      modelSelect.dispatchEvent(new Event("change"));
      expect(customInput.style.display).toBe("none");
    }

    // Streaming toggle
    const streamingToggle = el.shadowRoot?.querySelector(
      '[data-setting="streaming-toggle"]',
    ) as HTMLInputElement;
    if (streamingToggle) {
      streamingToggle.checked = false;
      streamingToggle.dispatchEvent(new Event("change"));
    }

    // Context compression toggle
    const ctxToggle = el.shadowRoot?.querySelector(
      '[data-setting="context-compression-toggle"]',
    ) as HTMLInputElement;
    if (ctxToggle) {
      ctxToggle.checked = true;
      ctxToggle.dispatchEvent(new Event("change"));
    }

    // Prompt API fallback select change
    const fallbackSelect = el.shadowRoot?.querySelector(
      '[data-setting="prompt-api-fallback-select"]',
    ) as HTMLSelectElement;
    if (fallbackSelect) {
      fallbackSelect.value = "test-model";
      fallbackSelect.dispatchEvent(new Event("change"));
    }

    // Repeated showLlamafileHelpDialog
    el.requestAppDialog = jest.fn<any>().mockResolvedValue(undefined);
    await el.showLlamafileHelpDialog("same-reason");
    await el.showLlamafileHelpDialog("same-reason");
    expect(el.requestAppDialog).toHaveBeenCalledTimes(1);

    document.body.removeChild(el);
  });

  it("handles edge cases and error handling in saveApiKey, Bedrock, Llamafile, and BuiltinAi", async () => {
    const el = new ShadowClawLlm();
    const orch = createOrchestratorStub();
    (orchestratorStore as any).orchestrator = orch;
    el.orchestrator = orch as any;
    el.db = {} as any;
    document.body.appendChild(el);
    await el.connectedCallback();
    await el.render();

    // 1. saveApiKey without required key (provider-b)
    const providerSelect = el.shadowRoot?.querySelector(
      '[data-setting="provider-select"]',
    ) as HTMLSelectElement;
    const keyInput = el.shadowRoot?.querySelector(
      '[data-setting="api-key-input"]',
    ) as HTMLInputElement;

    providerSelect.value = "provider-b";
    await el.saveApiKey();
    expect(showSuccess).toHaveBeenCalledWith(
      "Provider saved (no API key required)",
      3000,
    );

    // saveApiKey error path for provider-b
    mockSetProvider.mockRejectedValueOnce(new Error("Set provider crash"));
    await el.saveApiKey();
    expect(showError).toHaveBeenCalledWith(
      "Error saving provider: Set provider crash",
      6000,
    );

    // saveApiKey requiring key with empty key
    providerSelect.value = "provider-a";
    keyInput.value = "   ";
    await el.saveApiKey();
    expect(showWarning).toHaveBeenCalledWith("Please enter an API key", 3000);

    // saveApiKey with null orchestrator
    el.orchestrator = null;
    await el.saveApiKey();
    expect(showError).toHaveBeenCalledWith(
      "Orchestrator not initialized",
      5000,
    );
    el.orchestrator = orch as any;

    // 2. saveBedrockSettings validation & error
    const regionInput = el.shadowRoot?.querySelector(
      '[data-setting="bedrock-region-input"]',
    ) as HTMLInputElement;
    const profileInput = el.shadowRoot?.querySelector(
      '[data-setting="bedrock-profile-input"]',
    ) as HTMLInputElement;

    if (regionInput && profileInput) {
      regionInput.value = "us-west-2";
      profileInput.value = "";
      await el.saveBedrockSettings();
      expect(showWarning).toHaveBeenCalledWith(
        expect.stringContaining("Enter both Bedrock region and profile"),
        4000,
      );

      regionInput.value = "us-west-2";
      profileInput.value = "default";
      mockSetBedrockSettings.mockRejectedValueOnce(
        new Error("Bedrock auth fail"),
      );
      await el.saveBedrockSettings();
      expect(showError).toHaveBeenCalledWith(
        "Error saving Bedrock fallback settings: Bedrock auth fail",
        6000,
      );
    }

    // 3. saveBuiltinAiSettings error
    (setConfig as any).mockRejectedValueOnce(new Error("DB locked"));
    await el.saveBuiltinAiSettings();
    expect(showError).toHaveBeenCalledWith(
      "Error saving Built-in AI settings: DB locked",
      5000,
    );

    // 4. saveLlamafileSettings validations & error
    const hostInput = el.shadowRoot?.querySelector(
      '[data-setting="llamafile-host-input"]',
    ) as HTMLInputElement;
    const portInput = el.shadowRoot?.querySelector(
      '[data-setting="llamafile-port-input"]',
    ) as HTMLInputElement;

    if (hostInput && portInput) {
      hostInput.value = "";
      await el.saveLlamafileSettings();
      expect(showWarning).toHaveBeenCalledWith("Please enter a host", 3000);

      hostInput.value = "localhost";
      portInput.value = "999999";
      await el.saveLlamafileSettings();
      expect(showWarning).toHaveBeenCalledWith(
        "Please enter a valid port (1-65535)",
        3000,
      );

      portInput.value = "8080";
      mockSetLlamafileSettings.mockRejectedValueOnce(new Error("Host down"));
      await el.saveLlamafileSettings();
      expect(showError).toHaveBeenCalledWith(
        "Error saving llamafile settings: Host down",
        6000,
      );
    }

    // 5. saveMaxIterations
    const maxIterInput = el.shadowRoot?.querySelector(
      '[data-setting="max-iterations-input"]',
    ) as HTMLInputElement;
    if (maxIterInput) {
      maxIterInput.value = "0";
      await el.saveMaxIterations();
      expect(showWarning).toHaveBeenCalledWith(
        "Please enter a valid number (1 or higher)",
        3000,
      );

      maxIterInput.value = "10";
      await el.saveMaxIterations();
      expect(mockSetMaxIterations).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        10,
      );

      mockSetMaxIterations.mockRejectedValueOnce(new Error("Save failed"));
      await el.saveMaxIterations();
      expect(showError).toHaveBeenCalledWith(
        "Error saving max iterations: Save failed",
        6000,
      );
    }

    // 6. saveMaxTokens
    const maxTokensInput = el.shadowRoot?.querySelector(
      '[data-setting="max-tokens-input"]',
    ) as HTMLInputElement;
    if (maxTokensInput) {
      maxTokensInput.value = "0";
      await el.saveMaxTokens();
      expect(showWarning).toHaveBeenCalledWith(
        "Please enter a valid number (1 or higher)",
        3000,
      );

      maxTokensInput.value = "4096";
      await el.saveMaxTokens();
      expect(mockSetMaxTokens).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        4096,
      );

      mockSetMaxTokens.mockRejectedValueOnce(new Error("Token save failed"));
      await el.saveMaxTokens();
      expect(showError).toHaveBeenCalledWith(
        "Error saving max tokens: Token save failed",
        6000,
      );
    }

    // 7. onStreamingToggle and onContextCompressionToggle
    await el.onStreamingToggle(true);
    expect(mockSetStreamingEnabled).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      true,
    );
    await el.onStreamingToggle(false);
    expect(mockSetStreamingEnabled).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      false,
    );
    mockSetStreamingEnabled.mockRejectedValueOnce(new Error("Stream err"));
    await el.onStreamingToggle(true);
    expect(showError).toHaveBeenCalledWith(
      "Error saving streaming setting: Stream err",
      6000,
    );

    await el.onContextCompressionToggle(true);
    expect(mockSetContextCompressionEnabled).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      true,
    );
    await el.onContextCompressionToggle(false);
    expect(mockSetContextCompressionEnabled).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      false,
    );
    mockSetContextCompressionEnabled.mockRejectedValueOnce(
      new Error("Compress err"),
    );
    await el.onContextCompressionToggle(true);
    expect(showError).toHaveBeenCalledWith(
      "Error saving context compression setting: Compress err",
      6000,
    );

    // 8. requestAppDialog fallback when shadow-claw element is absent
    const dialogFallback = await el.requestAppDialog({
      title: "T",
      message: "M",
    });
    expect(dialogFallback).toBe(false);

    // 9. saveTransformersJsSettings and showLlamafileHelpDialog
    await el.saveTransformersJsSettings();
    await el.showLlamafileHelpDialog("help needed");
    // Repeating should trigger cache check:
    await el.showLlamafileHelpDialog("help needed");

    // 10. saveSubagentWorkspaceMode invalid & error
    const subagentSelect = el.shadowRoot?.querySelector(
      '[data-setting="subagent-workspace-mode"], [data-setting="subagent-workspace-mode-select"]',
    ) as HTMLSelectElement;
    if (subagentSelect) {
      subagentSelect.value = "invalid-mode";
      await el.saveSubagentWorkspaceMode();
      expect(showWarning).toHaveBeenCalledWith(
        "Please select a valid subagent workspace mode",
        3000,
      );

      subagentSelect.value = "parent";
      (setConfig as any).mockRejectedValueOnce(
        new Error("Subagent save error"),
      );
      await el.saveSubagentWorkspaceMode();
      expect(showError).toHaveBeenCalledWith(
        "Error saving subagent workspace mode: Subagent save error",
        6000,
      );
    }

    // 11. saveMeshLlmSettings
    await el.saveMeshLlmSettings();

    document.body.removeChild(el);
  });

  it("handles null root, null db, and null orchestrator guards across methods", async () => {
    const el = new ShadowClawLlm() as any;
    // connectedCallback throws when shadowRoot is null
    Object.defineProperty(el, "shadowRoot", {
      get: () => null,
      configurable: true,
    });
    await expect(el.connectedCallback()).rejects.toThrow(
      "shadowRoot not found",
    );
    delete (el as any).shadowRoot;

    document.body.appendChild(el);
    await el.connectedCallback();

    // applyRecommendedMaxTokens
    el.orchestrator = null;
    el.applyRecommendedMaxTokens();
    el.orchestrator = createOrchestratorStub();
    Object.defineProperty(el, "shadowRoot", {
      get: () => null,
      configurable: true,
    });
    el.applyRecommendedMaxTokens();
    delete (el as any).shadowRoot;

    // renderBedrockSettings
    el.orchestrator = null;
    el.renderBedrockSettings();
    el.orchestrator = createOrchestratorStub();
    Object.defineProperty(el, "shadowRoot", {
      get: () => null,
      configurable: true,
    });
    el.renderBedrockSettings();
    delete (el as any).shadowRoot;

    // renderLlamafileSettings
    el.orchestrator = null;
    el.renderLlamafileSettings();
    el.orchestrator = createOrchestratorStub();
    Object.defineProperty(el, "shadowRoot", {
      get: () => null,
      configurable: true,
    });
    el.renderLlamafileSettings();
    delete (el as any).shadowRoot;

    // renderMeshLlmSettings
    el.orchestrator = null;
    el.renderMeshLlmSettings();
    el.orchestrator = createOrchestratorStub();
    Object.defineProperty(el, "shadowRoot", {
      get: () => null,
      configurable: true,
    });
    el.renderMeshLlmSettings();
    delete (el as any).shadowRoot;

    // updateBedrockSettingsVisibility & updateMeshLlmSettingsVisibility
    Object.defineProperty(el, "shadowRoot", {
      get: () => null,
      configurable: true,
    });
    el.updateBedrockSettingsVisibility();
    el.updateMeshLlmSettingsVisibility();
    delete (el as any).shadowRoot;

    // updateLlamafileModelSectionVisibility & updateLlamafileModeVisibility & updateLlamafileSettingsVisibility
    el.orchestrator = null;
    el.updateLlamafileModelSectionVisibility();
    el.updateLlamafileModeVisibility();
    el.orchestrator = createOrchestratorStub();
    Object.defineProperty(el, "shadowRoot", {
      get: () => null,
      configurable: true,
    });
    el.updateLlamafileModelSectionVisibility();
    el.updateLlamafileModeVisibility();
    el.updateLlamafileSettingsVisibility();
    delete (el as any).shadowRoot;

    // updateMaxTokensUI & updateModelProviderHelperText & updateModelSelector
    el.orchestrator = null;
    el.updateMaxTokensUI();
    el.updateModelProviderHelperText();
    el.updateModelSelector();
    el.orchestrator = createOrchestratorStub();
    Object.defineProperty(el, "shadowRoot", {
      get: () => null,
      configurable: true,
    });
    el.updateMaxTokensUI();
    el.updateModelProviderHelperText();
    el.updateModelSelector();
    delete (el as any).shadowRoot;

    // updateTransformersJsSettingsVisibility
    Object.defineProperty(el, "shadowRoot", {
      get: () => null,
      configurable: true,
    });
    el.updateTransformersJsSettingsVisibility();
    delete (el as any).shadowRoot;

    // save methods null db / orchestrator / root guards
    el.db = null;
    el.orchestrator = null;
    await el.saveApiKey();
    await el.saveBedrockSettings();
    await el.saveBuiltinAiSettings();
    await el.saveLlamafileSettings();
    await el.saveMaxIterations();
    await el.saveMaxTokens();
    await el.saveMeshLlmSettings();
    await el.saveModel();
    await el.saveRateLimitSettings();
    await el.saveReasoningEffort();
    await el.saveSubagentMaxParallel();
    await el.saveSubagentWorkspaceMode();
    await el.saveTransformersJsSettings();

    document.body.removeChild(el);
  });

  it("handles updateModelSelector model item formatting, sorting, context strings, and grouping", async () => {
    const el = new ShadowClawLlm() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    const root = el.shadowRoot!;
    const modelSelect = root.querySelector(
      '[data-setting="model-select"]',
    ) as HTMLSelectElement;

    // Test with provider having rich model objects (various contexts: >=1M, >=1k, >0, 0, pricing free/paid, displayName)
    const richModels = [
      {
        id: "mod-1m",
        name: "1M Model",
        displayName: "Mega 1M",
        context_length: 2000000,
        supports_tools: true,
        pricing: "free",
      },
      {
        id: "mod-100k",
        name: "100k Model",
        context_length: 128000,
        supports_tools: true,
        pricing: "free",
      },
      {
        id: "mod-500",
        name: "500 Tokens",
        context_length: 500,
        supports_tools: false,
        pricing: "paid",
      },
      {
        id: "mod-0",
        name: "0 Tokens",
        context_length: 0,
        supports_tools: false,
        pricing: "paid",
      },
      "string-model-id",
    ];

    PROVIDERS["rich-provider"] = {
      id: "rich-provider",
      name: "Rich Provider",
      defaultModel: "mod-1m",
      models: richModels,
      requiresApiKey: false,
    };

    el.orchestrator.provider = "rich-provider";
    el.orchestrator.model = "mod-1m";
    el.updateModelSelector();

    expect(modelSelect.innerHTML).toContain("Mega 1M - mod-1m");
    expect(modelSelect.innerHTML).toContain("(2.0M)");
    expect(modelSelect.innerHTML).toContain("(125k)");
    expect(modelSelect.innerHTML).toContain("(500)");
    expect(modelSelect.innerHTML).toContain("Free / Included");
    expect(modelSelect.innerHTML).toContain("Paid / Pro");
    expect(modelSelect.innerHTML).toContain("string-model-id");

    // Test with local provider (prompt_api) grouping
    el.orchestrator.provider = "prompt_api";
    el.orchestrator.model = "builtin-mod";
    PROVIDERS["prompt_api"] = {
      id: "prompt_api",
      name: "Prompt API",
      defaultModel: "builtin-mod",
      models: [
        {
          id: "builtin-mod",
          name: "Builtin",
          supports_tools: true,
          context_length: 4096,
        },
      ],
      requiresApiKey: false,
    };
    el.updateModelSelector();
    expect(modelSelect.innerHTML).toContain("Built-in");

    // Test with custom model fallback (when currentModel is not in list)
    el.orchestrator.model = "my-custom-unlisted-model";
    el.updateModelSelector();
    const customInput = root.querySelector(
      '[data-setting="custom-model-input"]',
    ) as HTMLInputElement;
    expect(modelSelect.value).toBe("__custom__");
    expect(customInput.value).toBe("my-custom-unlisted-model");
    expect(customInput.style.display).toBe("block");

    delete PROVIDERS["rich-provider"];
    delete PROVIDERS["prompt_api"];
    document.body.removeChild(el);
  });

  it("handles updateModelSelector dynamic modelsUrl fetch variations, headers, and fallbacks", async () => {
    const el = new ShadowClawLlm() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    const originalFetch = globalThis.fetch;

    // 1. Array response
    globalThis.fetch = jest.fn<any>().mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: "dyn-arr-1", name: "Dynamic 1" }],
    });
    el.orchestrator.provider = "llamafile";
    el.updateModelSelector();
    await new Promise((r) => setTimeout(r, 20));
    expect(el.llamafileDiscoveredModelIds).toContain("dyn-arr-1");

    // 2. data.data wrapper
    globalThis.fetch = jest.fn<any>().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ id: "dyn-data-1", name: "Data 1" }] }),
    });
    el.updateModelSelector();
    await new Promise((r) => setTimeout(r, 20));
    expect(el.llamafileDiscoveredModelIds).toContain("dyn-data-1");

    // 3. Object with arbitrary array key
    globalThis.fetch = jest.fn<any>().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{ id: "dyn-results-1", name: "Results 1" }],
      }),
    });
    el.updateModelSelector();
    await new Promise((r) => setTimeout(r, 20));
    expect(el.llamafileDiscoveredModelIds).toContain("dyn-results-1");

    // 4. Object that is itself a single model ({ id: "single-1" })
    globalThis.fetch = jest.fn<any>().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "single-1", name: "Single Model" }),
    });
    el.updateModelSelector();
    await new Promise((r) => setTimeout(r, 20));
    expect(el.llamafileDiscoveredModelIds).toContain("single-1");

    // 5. Fetch failure for llamafile
    globalThis.fetch = jest
      .fn<any>()
      .mockRejectedValueOnce(new Error("Net down"));
    el.updateModelSelector();
    await new Promise((r) => setTimeout(r, 20));
    expect(el.llamafileModelLoadError).toBe("Net down");

    // 6. Fetch failure for non-llamafile with static models fallback
    PROVIDERS["fail-fallback"] = {
      id: "fail-fallback",
      name: "Fail Fallback",
      defaultModel: "m1",
      modelsUrl: "http://localhost:9999/models",
      models: [{ id: "m1", name: "Static M1" }],
    };
    el.orchestrator.provider = "fail-fallback";
    globalThis.fetch = jest.fn<any>().mockRejectedValueOnce(new Error("Down"));
    el.updateModelSelector();
    await new Promise((r) => setTimeout(r, 20));
    const modelSelect = el.shadowRoot!.querySelector(
      '[data-setting="model-select"]',
    ) as HTMLSelectElement;
    expect(modelSelect.innerHTML).toContain("Static M1");

    // 7. Fetch failure for non-llamafile without static models fallback
    PROVIDERS["fail-no-fallback"] = {
      id: "fail-no-fallback",
      name: "Fail No Fallback",
      defaultModel: "",
      modelsUrl: "http://localhost:9999/models-none",
    };
    el.orchestrator.provider = "fail-no-fallback";
    globalThis.fetch = jest.fn<any>().mockRejectedValueOnce("String error");
    el.updateModelSelector();
    await new Promise((r) => setTimeout(r, 20));
    expect(showError).toHaveBeenCalledWith(
      expect.stringContaining("Could not reach the model server"),
      5000,
    );

    // 8. bedrock_proxy headers in modelsUrl fetch
    PROVIDERS["bedrock_proxy"] = {
      id: "bedrock_proxy",
      name: "Bedrock Proxy",
      defaultModel: "bedrock-1",
      modelsUrl: "http://localhost:9999/bedrock/models",
      apiKeyHeader: "Authorization",
      apiKeyHeaderFormat: "Bearer {key}",
    };
    el.orchestrator.provider = "bedrock_proxy";
    const { getBedrockSettings, getApiKeyForHeaders } =
      (await import("../../../core/orchestrator/utils/operations/provider.js")) as any;
    getBedrockSettings.mockReturnValueOnce({
      region: "us-west-2",
      profile: "bedrock-profile",
      authMode: "iam_role",
    });
    getApiKeyForHeaders.mockResolvedValueOnce("secret-key");
    globalThis.fetch = jest.fn<any>().mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: "bedrock-1" }],
    });
    el.updateModelSelector();
    await new Promise((r) => setTimeout(r, 20));
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:9999/bedrock/models",
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-bedrock-region": "us-west-2",
          "x-bedrock-profile": "bedrock-profile",
          "x-bedrock-auth-mode": "iam_role",
          Authorization: "Bearer secret-key",
        }),
      }),
    );

    delete PROVIDERS["fail-fallback"];
    delete PROVIDERS["fail-no-fallback"];
    delete PROVIDERS["bedrock_proxy"];
    globalThis.fetch = originalFetch;
    document.body.removeChild(el);
  });

  it("handles updateModelProviderHelperText variations for llamafile", async () => {
    const el = new ShadowClawLlm() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    const helper = el.shadowRoot!.querySelector(
      '[data-setting="model-provider-helper"]',
    ) as HTMLElement;

    el.orchestrator.provider = "llamafile";
    const { getLlamafileSettings } =
      (await import("../../../core/orchestrator/utils/operations/provider.js")) as any;

    // 1. server mode hides helper
    getLlamafileSettings.mockReturnValueOnce({ mode: "server" });
    el.updateModelProviderHelperText();
    expect(helper.hidden).toBe(true);

    // 2. cli mode with 1 model (singular)
    getLlamafileSettings.mockReturnValueOnce({ mode: "cli" });
    el.llamafileDiscoveredModelIds = ["one.llamafile"];
    el.updateModelProviderHelperText();
    expect(helper.hidden).toBe(false);
    expect(helper.textContent).toContain("Discovered 1 *.llamafile model in");

    // 3. cli mode with multiple models (plural)
    getLlamafileSettings.mockReturnValueOnce({ mode: "cli" });
    el.llamafileDiscoveredModelIds = ["one.llamafile", "two.llamafile"];
    el.updateModelProviderHelperText();
    expect(helper.textContent).toContain("Discovered 2 *.llamafile models in");

    // 4. cli mode with error
    getLlamafileSettings.mockReturnValueOnce({ mode: "cli" });
    el.llamafileDiscoveredModelIds = [];
    el.llamafileModelLoadError = "File missing";
    el.updateModelProviderHelperText();
    expect(helper.textContent).toContain(
      "Could not load llamafile models from",
    );

    // 5. cli mode with 0 models and no error
    getLlamafileSettings.mockReturnValueOnce({ mode: "cli" });
    el.llamafileDiscoveredModelIds = [];
    el.llamafileModelLoadError = null;
    el.updateModelProviderHelperText();
    expect(helper.textContent).toContain(
      "ShadowClaw looks for *.llamafile binaries in",
    );

    document.body.removeChild(el);
  });

  it("handles bindEventListeners event dispatches for select change and button clicks", async () => {
    const el = new ShadowClawLlm() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    const root = el.shadowRoot!;

    // prompt-api-fallback-select change event with target
    jest.spyOn(el, "updateMaxTokensUI").mockImplementation(() => {});
    const fallbackSelect = root.querySelector(
      '[data-setting="prompt-api-fallback-select"]',
    ) as HTMLSelectElement;
    if (fallbackSelect) {
      fallbackSelect.value = "onnx-community/Qwen3-0.6B-ONNX";
      fallbackSelect.dispatchEvent(new Event("change"));
    }

    // model-select change event toggling custom input
    const modelSelect = root.querySelector(
      '[data-setting="model-select"]',
    ) as HTMLSelectElement;
    const customInput = root.querySelector(
      '[data-setting="custom-model-input"]',
    ) as HTMLElement;
    if (modelSelect && customInput) {
      modelSelect.innerHTML =
        '<option value="__custom__">Custom</option><option value="some-other-model">Other</option>';
      modelSelect.value = "__custom__";
      modelSelect.dispatchEvent(new Event("change"));
      expect(customInput.style.display).toBe("block");

      modelSelect.value = "some-other-model";
      modelSelect.dispatchEvent(new Event("change"));
      expect(customInput.style.display).toBe("none");
    }

    // streaming and cc toggles
    const streamToggle = root.querySelector(
      '[data-setting="streaming-toggle"]',
    ) as HTMLInputElement;
    if (streamToggle) {
      streamToggle.checked = true;
      streamToggle.dispatchEvent(new Event("change"));
    }
    const ccToggle = root.querySelector(
      '[data-setting="context-compression-toggle"]',
    ) as HTMLInputElement;
    if (ccToggle) {
      ccToggle.checked = true;
      ccToggle.dispatchEvent(new Event("change"));
    }

    // Dispatch clicks on all action buttons with spied handlers
    const actionMethods: Record<string, string> = {
      "save-llm-provider": "saveApiKey",
      "save-model": "saveModel",
      "refresh-models": "updateModelSelector",
      "save-max-iterations": "saveMaxIterations",
      "save-subagent-max-parallel": "saveSubagentMaxParallel",
      "save-subagent-workspace-mode": "saveSubagentWorkspaceMode",
      "save-rate-limit-settings": "saveRateLimitSettings",
      "save-max-tokens": "saveMaxTokens",
      "save-reasoning-effort": "saveReasoningEffort",
      "apply-recommended-max-tokens": "applyRecommendedMaxTokens",
      "save-llamafile-settings": "saveLlamafileSettings",
      "save-bedrock-settings": "saveBedrockSettings",
      "save-mesh-llm-settings": "saveMeshLlmSettings",
      "save-transformers-js-settings": "saveTransformersJsSettings",
      "save-builtin-ai-settings": "saveBuiltinAiSettings",
    };
    for (const [action, method] of Object.entries(actionMethods)) {
      jest.spyOn(el, method).mockResolvedValue(undefined as any);
      root
        .querySelector(`[data-action="${action}"]`)
        ?.dispatchEvent(new Event("click"));
      expect((el as any)[method]).toHaveBeenCalled();
    }

    document.body.removeChild(el);
  });

  it("handles saveBedrockSettings region/profile validation and error handling", async () => {
    const el = new ShadowClawLlm() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    const root = el.shadowRoot!;
    const regionInput = root.querySelector(
      '[data-setting="bedrock-region-input"]',
    ) as HTMLInputElement;
    const profileInput = root.querySelector(
      '[data-setting="bedrock-profile-input"]',
    ) as HTMLInputElement;

    // 1. region without profile -> warning
    regionInput.value = "us-east-1";
    profileInput.value = "";
    await el.saveBedrockSettings();
    expect(showWarning).toHaveBeenCalledWith(
      expect.stringContaining("Enter both Bedrock region and profile"),
      4000,
    );

    // 2. profile without region -> warning
    regionInput.value = "";
    profileInput.value = "my-profile";
    await el.saveBedrockSettings();
    expect(showWarning).toHaveBeenCalledWith(
      expect.stringContaining("Enter both Bedrock region and profile"),
      4000,
    );

    // 3. both provided, orchestrator provider is bedrock_proxy
    regionInput.value = "us-east-1";
    profileInput.value = "my-profile";
    el.orchestrator.provider = "bedrock_proxy";
    const updateSpy = jest
      .spyOn(el, "updateModelSelector")
      .mockImplementation(() => {});
    await el.saveBedrockSettings();
    expect(showSuccess).toHaveBeenCalledWith(
      "Bedrock fallback settings saved",
      3000,
    );
    expect(updateSpy).toHaveBeenCalled();

    // 4. setBedrockSettings throws
    mockSetBedrockSettings.mockRejectedValueOnce(
      new Error("Bedrock auth fail"),
    );
    await el.saveBedrockSettings();
    expect(showError).toHaveBeenCalledWith(
      "Error saving Bedrock fallback settings: Bedrock auth fail",
      6000,
    );

    document.body.removeChild(el);
  });

  it("handles saveApiKey provider without key requirement, missing key, and errors", async () => {
    const el = new ShadowClawLlm() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    const root = el.shadowRoot!;
    const keyInput = root.querySelector(
      '[data-setting="api-key-input"]',
    ) as HTMLInputElement;
    const providerSelect = root.querySelector(
      '[data-setting="provider-select"]',
    ) as HTMLSelectElement;

    // 1. Provider not requiring API key (provider-b)
    providerSelect.innerHTML =
      '<option value="provider-a">A</option><option value="provider-b">B</option>';
    providerSelect.value = "provider-b";
    await el.saveApiKey();
    expect(showSuccess).toHaveBeenCalledWith(
      "Provider saved (no API key required)",
      3000,
    );

    // 2. setProvider throws for provider-b
    mockSetProvider.mockRejectedValueOnce(new Error("Provider switch error"));
    await el.saveApiKey();
    expect(showError).toHaveBeenCalledWith(
      "Error saving provider: Provider switch error",
      6000,
    );

    // 3. Provider requiring key, key empty -> warning
    providerSelect.value = "provider-a";
    keyInput.value = "";
    await el.saveApiKey();
    expect(showWarning).toHaveBeenCalledWith("Please enter an API key", 3000);

    // 4. setApiKey throws non-Error
    keyInput.value = "valid-key";
    el.orchestrator.setApiKey.mockRejectedValueOnce("Crypt error");
    await el.saveApiKey();
    expect(showError).toHaveBeenCalledWith(
      "Error saving API key: Crypt error",
      6000,
    );

    document.body.removeChild(el);
  });

  it("handles saveBuiltinAiSettings error and saveTransformersJsSettings defaults", async () => {
    const el = new ShadowClawLlm() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    // saveBuiltinAiSettings throws
    (setConfig as any).mockRejectedValueOnce(new Error("Builtin save fail"));
    await el.saveBuiltinAiSettings();
    expect(showError).toHaveBeenCalledWith(
      "Error saving Built-in AI settings: Builtin save fail",
      5000,
    );

    // saveTransformersJsSettings
    await el.saveTransformersJsSettings();
    expect(showSuccess).toHaveBeenCalledWith("Transformers.js settings saved.");

    document.body.removeChild(el);
  });

  it("handles saveLlamafileSettings validation, restartCurrentRequest, and errors", async () => {
    const el = new ShadowClawLlm() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    const root = el.shadowRoot!;
    const hostInput = root.querySelector(
      '[data-setting="llamafile-host-input"]',
    ) as HTMLInputElement;
    const portInput = root.querySelector(
      '[data-setting="llamafile-port-input"]',
    ) as HTMLInputElement;
    const modeSelect = root.querySelector(
      '[data-setting="llamafile-mode-select"]',
    ) as HTMLSelectElement;

    // 1. Missing host
    hostInput.value = "";
    portInput.value = "8080";
    await el.saveLlamafileSettings();
    expect(showWarning).toHaveBeenCalledWith("Please enter a host", 3000);

    // 2. Invalid port
    hostInput.value = "http://localhost";
    portInput.value = "-1";
    await el.saveLlamafileSettings();
    expect(showWarning).toHaveBeenCalledWith(
      "Please enter a valid port (1-65535)",
      3000,
    );

    // 3. Valid, provider is llamafile, restartCurrentRequest returns true
    portInput.value = "8080";
    modeSelect.value = "cli";
    el.orchestrator.provider = "llamafile";
    orchestratorStore.restartCurrentRequest = jest
      .fn<any>()
      .mockResolvedValue(true);
    await el.saveLlamafileSettings();
    expect(showSuccess).toHaveBeenCalledWith(
      "Llamafile settings saved, request restarted",
      3000,
    );

    // 4. restartCurrentRequest returns false
    orchestratorStore.restartCurrentRequest = jest
      .fn<any>()
      .mockResolvedValue(false);
    await el.saveLlamafileSettings();
    expect(showSuccess).toHaveBeenCalledWith("Llamafile settings saved", 3000);

    // 5. Non-llamafile provider
    el.orchestrator.provider = "provider-a";
    await el.saveLlamafileSettings();
    expect(showSuccess).toHaveBeenCalledWith("Llamafile settings saved", 3000);

    // 6. setLlamafileSettings throws
    mockSetLlamafileSettings.mockRejectedValueOnce(new Error("Llamafile fail"));
    await el.saveLlamafileSettings();
    expect(showError).toHaveBeenCalledWith(
      "Error saving llamafile settings: Llamafile fail",
      6000,
    );

    document.body.removeChild(el);
  });

  it("handles saveModel custom model, llamafile cli, prompt_api config saves, and error handling", async () => {
    const el = new ShadowClawLlm() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    const root = el.shadowRoot!;
    const modelSelect = root.querySelector(
      '[data-setting="model-select"]',
    ) as HTMLSelectElement;
    const customInput = root.querySelector(
      '[data-setting="custom-model-input"]',
    ) as HTMLInputElement;

    // 1. llamafile in cli mode without model shows help dialog
    el.orchestrator.provider = "llamafile";
    const { getLlamafileSettings } =
      (await import("../../../core/orchestrator/utils/operations/provider.js")) as any;
    getLlamafileSettings.mockReturnValueOnce({ mode: "cli" });
    modelSelect.value = "";
    const helpSpy = jest
      .spyOn(el, "showLlamafileHelpDialog")
      .mockResolvedValue(undefined as any);
    await el.saveModel();
    expect(helpSpy).toHaveBeenCalled();

    // 2. prompt_api provider saving fallback, device, and dtype
    el.orchestrator.provider = "prompt_api";
    modelSelect.innerHTML =
      '<option value="prompt-mod">prompt-mod</option><option value="__custom__">Custom</option>';
    modelSelect.value = "prompt-mod";
    await el.saveModel();
    expect(mockSetModel).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "prompt-mod",
    );
    expect(showSuccess).toHaveBeenCalledWith("Model saved", 3000);

    // 3. custom model value
    modelSelect.value = "__custom__";
    customInput.value = "my-special-custom-model";
    await el.saveModel();
    expect(mockSetModel).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "my-special-custom-model",
    );

    // 4. setModel throws
    mockSetModel.mockRejectedValueOnce(new Error("Model set error"));
    await el.saveModel();
    expect(showError).toHaveBeenCalledWith(
      "Error saving model: Model set error",
      6000,
    );

    document.body.removeChild(el);
  });

  it("handles saveRateLimitSettings, saveReasoningEffort, and saveSubagentMaxParallel branches", async () => {
    const el = new ShadowClawLlm() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    const root = el.shadowRoot!;

    // 1. saveRateLimitSettings invalid input
    const callsInput = root.querySelector(
      '[data-setting="rate-limit-calls-per-minute-input"]',
    ) as HTMLInputElement;
    callsInput.value = "-5";
    await el.saveRateLimitSettings();
    expect(showWarning).toHaveBeenCalledWith(
      "Please enter a valid non-negative calls-per-minute value",
      3000,
    );

    // 2. saveRateLimitSettings valid
    callsInput.value = "60";
    await el.saveRateLimitSettings();
    expect(showSuccess).toHaveBeenCalledWith("Rate limit settings saved", 3000);

    // 3. saveRateLimitSettings error
    mockSetRateLimitCallsPerMinute.mockRejectedValueOnce(
      new Error("Rate limit fail"),
    );
    await el.saveRateLimitSettings();
    expect(showError).toHaveBeenCalledWith(
      "Error saving rate limit settings: Rate limit fail",
      6000,
    );

    // 4. saveReasoningEffort
    const reasoningSelect = root.querySelector(
      '[data-setting="reasoning-effort-select"]',
    ) as HTMLSelectElement;
    reasoningSelect.value = "high";
    await el.saveReasoningEffort();
    expect(mockSetReasoningEffort).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "high",
    );
    expect(showSuccess).toHaveBeenCalledWith("Reasoning effort saved", 3000);

    mockSetReasoningEffort.mockRejectedValueOnce(new Error("Effort fail"));
    await el.saveReasoningEffort();
    expect(showError).toHaveBeenCalledWith(
      "Error saving reasoning effort: Effort fail",
      6000,
    );

    // 5. saveSubagentMaxParallel invalid
    const subInput = root.querySelector(
      '[data-setting="subagent-max-parallel-input"]',
    ) as HTMLInputElement;
    subInput.value = "0";
    await el.saveSubagentMaxParallel();
    expect(showWarning).toHaveBeenCalledWith(
      "Please enter a valid number (1 or higher)",
      3000,
    );

    // 6. saveSubagentMaxParallel valid
    subInput.value = "8";
    await el.saveSubagentMaxParallel();
    expect(showSuccess).toHaveBeenCalledWith("Subagent limit saved", 3000);

    // 7. saveSubagentMaxParallel error
    (setConfig as any).mockRejectedValueOnce(new Error("Subagent limit error"));
    await el.saveSubagentMaxParallel();
    expect(showError).toHaveBeenCalledWith(
      "Error saving subagent limit: Subagent limit error",
      6000,
    );

    document.body.removeChild(el);
  });

  it("handles saveSubagentWorkspaceMode validation, success, and errors", async () => {
    const el = new ShadowClawLlm() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    const root = el.shadowRoot!;
    const select = root.querySelector(
      '[data-setting="subagent-workspace-mode-select"]',
    ) as HTMLSelectElement;

    // 1. null db
    const origDb = el.db;
    el.db = null;
    await el.saveSubagentWorkspaceMode();
    expect(showError).toHaveBeenCalledWith("Database not initialized", 3000);
    el.db = origDb;

    // 2. invalid mode
    select.value = "unknown-mode";
    await el.saveSubagentWorkspaceMode();
    expect(showWarning).toHaveBeenCalledWith(
      "Please select a valid subagent workspace mode",
      3000,
    );

    // 3. valid modes: parent, isolated, automatic
    select.value = "parent";
    await el.saveSubagentWorkspaceMode();
    expect(setConfig).toHaveBeenCalledWith(
      origDb,
      "subagent_workspace_mode",
      "parent",
    );
    expect(showSuccess).toHaveBeenCalledWith(
      "Subagent workspace mode saved",
      3000,
    );

    select.value = "isolated";
    await el.saveSubagentWorkspaceMode();
    expect(setConfig).toHaveBeenCalledWith(
      origDb,
      "subagent_workspace_mode",
      "isolated",
    );

    select.value = "automatic";
    await el.saveSubagentWorkspaceMode();
    expect(setConfig).toHaveBeenCalledWith(
      origDb,
      "subagent_workspace_mode",
      "automatic",
    );

    // 4. setConfig errors (Error vs string)
    (setConfig as any).mockRejectedValueOnce(new Error("Workspace mode fail"));
    await el.saveSubagentWorkspaceMode();
    expect(showError).toHaveBeenCalledWith(
      "Error saving subagent workspace mode: Workspace mode fail",
      6000,
    );

    (setConfig as any).mockRejectedValueOnce("String mode fail");
    await el.saveSubagentWorkspaceMode();
    expect(showError).toHaveBeenCalledWith(
      "Error saving subagent workspace mode: String mode fail",
      6000,
    );

    document.body.removeChild(el);
  });

  it("handles showLlamafileHelpDialog and requestAppDialog", async () => {
    const el = new ShadowClawLlm() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    // 1. requestAppDialog without shadow-claw element in document
    const resWithout = await el.requestAppDialog({
      title: "Test",
      message: "Hello",
    });
    expect(resWithout).toBe(false);

    // 2. requestAppDialog with shadow-claw element
    const fakeShadowClaw = document.createElement("div");
    (fakeShadowClaw as any).requestDialog = jest
      .fn<any>()
      .mockResolvedValue(true);
    // Custom elements tag name
    Object.defineProperty(fakeShadowClaw, "tagName", { value: "SHADOW-CLAW" });
    const querySpy = jest
      .spyOn(document, "querySelector")
      .mockReturnValue(fakeShadowClaw as any);

    const resWith = await el.requestAppDialog({
      title: "Test",
      message: "Hello",
    });
    expect(resWith).toBe(true);

    // 3. showLlamafileHelpDialog first call opens dialog
    el.orchestrator.model = "my-test-model";
    el.lastLlamafileHelpKey = null;
    const requestSpy = jest
      .spyOn(el, "requestAppDialog")
      .mockResolvedValue(true);
    await el.showLlamafileHelpDialog("missing_file");
    expect(requestSpy).toHaveBeenCalledTimes(1);
    expect(el.lastLlamafileHelpKey).toBe("missing_file|my-test-model");

    // 4. showLlamafileHelpDialog second call with same key is deduplicated
    await el.showLlamafileHelpDialog("missing_file");
    expect(requestSpy).toHaveBeenCalledTimes(1);

    querySpy.mockRestore();
    document.body.removeChild(el);
  });

  it("handles onProviderChange switching, early return, and errors", async () => {
    const el = new ShadowClawLlm() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    const root = el.shadowRoot!;
    const providerSelect = root.querySelector(
      '[data-setting="provider-select"]',
    ) as HTMLSelectElement;

    // 1. Early return if providerId === currentProvider
    el.orchestrator.provider = "provider-a";
    providerSelect.innerHTML =
      '<option value="provider-a">Provider A</option><option value="provider-b">Provider B</option>';
    providerSelect.value = "provider-a";
    mockSetProvider.mockClear();
    await el.onProviderChange();
    expect(mockSetProvider).not.toHaveBeenCalled();

    // 2. Switching to provider-b succeeds
    providerSelect.value = "provider-b";
    await el.onProviderChange();
    expect(mockSetProvider).toHaveBeenCalledWith(
      el.orchestrator,
      el.db,
      "provider-b",
      expect.anything(),
    );
    expect(showSuccess).toHaveBeenCalledWith("Switched to Provider B", 3000);

    // 3. Switching fails with Error -> reverts providerSelect.value
    el.orchestrator.provider = "provider-a";
    providerSelect.value = "provider-b";
    mockSetProvider.mockRejectedValueOnce(new Error("Switch failed"));
    await el.onProviderChange();
    expect(showError).toHaveBeenCalledWith(
      "Error switching provider: Switch failed",
      6000,
    );
    expect(providerSelect.value).toBe("provider-a");

    // 4. Switching fails with non-Error -> reverts providerSelect.value
    providerSelect.value = "provider-b";
    mockSetProvider.mockRejectedValueOnce("String error switch");
    await el.onProviderChange();
    expect(showError).toHaveBeenCalledWith(
      "Error switching provider: String error switch",
      6000,
    );
    expect(providerSelect.value).toBe("provider-a");

    // 5. Early return when orchestrator or db is null
    el.orchestrator = null;
    await el.onProviderChange();

    document.body.removeChild(el);
  });

  it("handles onStreamingToggle and onContextCompressionToggle", async () => {
    const el = new ShadowClawLlm() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    // Streaming toggle
    await el.onStreamingToggle(true);
    expect(mockSetStreamingEnabled).toHaveBeenCalledWith(
      el.orchestrator,
      el.db,
      true,
    );
    expect(showSuccess).toHaveBeenCalledWith("Streaming enabled", 2500);

    await el.onStreamingToggle(false);
    expect(mockSetStreamingEnabled).toHaveBeenCalledWith(
      el.orchestrator,
      el.db,
      false,
    );
    expect(showSuccess).toHaveBeenCalledWith("Streaming disabled", 2500);

    mockSetStreamingEnabled.mockRejectedValueOnce(
      new Error("Streaming toggle fail"),
    );
    await el.onStreamingToggle(true);
    expect(showError).toHaveBeenCalledWith(
      "Error saving streaming setting: Streaming toggle fail",
      6000,
    );

    mockSetStreamingEnabled.mockRejectedValueOnce("String streaming fail");
    await el.onStreamingToggle(true);
    expect(showError).toHaveBeenCalledWith(
      "Error saving streaming setting: String streaming fail",
      6000,
    );

    // Context compression toggle
    await el.onContextCompressionToggle(true);
    expect(mockSetContextCompressionEnabled).toHaveBeenCalledWith(
      el.orchestrator,
      el.db,
      true,
    );
    expect(showSuccess).toHaveBeenCalledWith(
      "Context compression enabled",
      2500,
    );

    await el.onContextCompressionToggle(false);
    expect(mockSetContextCompressionEnabled).toHaveBeenCalledWith(
      el.orchestrator,
      el.db,
      false,
    );
    expect(showSuccess).toHaveBeenCalledWith(
      "Context compression disabled",
      2500,
    );

    mockSetContextCompressionEnabled.mockRejectedValueOnce(
      new Error("Compression fail"),
    );
    await el.onContextCompressionToggle(true);
    expect(showError).toHaveBeenCalledWith(
      "Error saving context compression setting: Compression fail",
      6000,
    );

    mockSetContextCompressionEnabled.mockRejectedValueOnce(
      "String compression fail",
    );
    await el.onContextCompressionToggle(true);
    expect(showError).toHaveBeenCalledWith(
      "Error saving context compression setting: String compression fail",
      6000,
    );

    // Null guards
    el.orchestrator = null;
    await el.onStreamingToggle(true);
    await el.onContextCompressionToggle(true);

    document.body.removeChild(el);
  });

  it("handles applyRecommendedMaxTokens with prompt_api and standard providers", async () => {
    const el = new ShadowClawLlm() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    const root = el.shadowRoot!;
    const input = root.querySelector(
      '[data-setting="max-tokens-input"]',
    ) as HTMLInputElement;

    // 1. prompt_api provider with fallback select
    el.orchestrator.provider = "prompt_api";
    el.orchestrator.model = "builtin-ai";
    const fallbackSelect = root.querySelector(
      '[data-setting="prompt-api-fallback-select"]',
    ) as HTMLSelectElement;
    if (fallbackSelect) {
      fallbackSelect.value = "onnx-community/Qwen3-0.6B-ONNX";
    }
    el.applyRecommendedMaxTokens();
    expect(input.value).toBeTruthy();

    // 2. prompt_api provider without fallback value
    if (fallbackSelect) {
      fallbackSelect.value = "";
    }
    el.applyRecommendedMaxTokens();
    expect(input.value).toBeTruthy();

    // 3. standard provider
    el.orchestrator.provider = "provider-a";
    el.orchestrator.model = "model-a";
    el.applyRecommendedMaxTokens();
    expect(input.value).toBeTruthy();

    // 4. null guards
    el.orchestrator = null;
    el.applyRecommendedMaxTokens();

    document.body.removeChild(el);
  });

  it("handles render configuration fallbacks for prompt_api, subagent, and rate limit", async () => {
    const el = new ShadowClawLlm() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    // Mock getConfig to return undefined/fallback values
    (getConfig as any).mockImplementation((_db: any, key: string) => {
      if (key === "subagent_max_parallel") return "not-a-number";
      if (key === "subagent_workspace_mode") return "invalid-mode";
      if (key === "compaction_engine_preference") return "";
      if (key === "builtin_ai_tools_backend") return "";
      return Promise.resolve(undefined);
    });

    el.orchestrator.rateLimitCallsPerMinute = 0;
    el.orchestrator.rateLimitAutoAdapt = false;

    await el.render();

    const root = el.shadowRoot!;
    const subInput = root.querySelector(
      '[data-setting="subagent-max-parallel-input"]',
    ) as HTMLInputElement;
    expect(subInput.value).toBe("5"); // DEFAULT_SUBAGENT_MAX_PARALLEL

    const modeSelect = root.querySelector(
      '[data-setting="subagent-workspace-mode-select"]',
    ) as HTMLSelectElement;
    expect(modeSelect.value).toBe("automatic"); // DEFAULT_SUBAGENT_WORKSPACE_MODE

    const rateAutoToggle = root.querySelector(
      '[data-setting="rate-limit-auto-adapt-toggle"]',
    ) as HTMLInputElement;
    expect(rateAutoToggle.checked).toBe(false);

    document.body.removeChild(el);
  });

  it("handles saveMeshLlmSettings with mesh-llm provider and errors", async () => {
    const el = new ShadowClawLlm() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    const root = el.shadowRoot!;
    const hostInput = root.querySelector(
      '[data-setting="mesh-llm-host-input"]',
    ) as HTMLInputElement;
    hostInput.value = "http://localhost:11434";

    // 1. When orchestrator.provider === "mesh-llm"
    el.orchestrator.provider = "mesh-llm";
    const updateSpy = jest.spyOn(el, "updateModelSelector");
    await el.saveMeshLlmSettings();
    expect(showSuccess).toHaveBeenCalledWith("Mesh LLM settings saved", 3000);
    expect(updateSpy).toHaveBeenCalled();

    // 2. Non-Error throw
    const { setMeshLlmSettings } =
      (await import("../../../core/orchestrator/utils/operations/provider.js")) as any;
    setMeshLlmSettings.mockRejectedValueOnce("Mesh fail string");
    await el.saveMeshLlmSettings();
    expect(showError).toHaveBeenCalledWith(
      "Error saving Mesh LLM settings: Mesh fail string",
      6000,
    );

    document.body.removeChild(el);
  });

  it("handles HuggingFace, OpenRouter, and parameter metadata in updateModelSelector", async () => {
    const el = new ShadowClawLlm() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    const root = el.shadowRoot!;
    const modelSelect = root.querySelector(
      '[data-setting="model-select"]',
    ) as HTMLSelectElement;

    // 1. Models with HuggingFace providers array, OpenRouter pricing, context_window, supported_parameters
    const metadataModels = [
      {
        id: "hf-free-model",
        name: "HF Free",
        providers: [
          {
            provider: "hf-inference",
            supports_tools: true,
            context_length: 32768,
          },
        ],
      },
      {
        id: "hf-zero-price-model",
        name: "HF Zero Price",
        providers: [
          {
            provider: "custom",
            pricing: { prompt: 0, completion: 0 },
            supports_tools: false,
            context_length: 8192,
          },
        ],
      },
      {
        id: "hf-paid-model",
        name: "HF Paid",
        providers: [
          {
            provider: "custom",
            pricing: { prompt: 0.05, completion: 0.1 },
            supports_tools: false,
            context_length: 8192,
          },
        ],
      },
      {
        id: "openrouter-free-model",
        name: "OR Free",
        pricing: { prompt: "0", completion: "0" },
        supported_parameters: ["tools", "temperature"],
        context_window: 16384,
      },
      {
        id: "openrouter-paid-model",
        name: "OR Paid",
        pricing: { prompt: "0.01", completion: "0.02" },
        supported_parameters: ["temperature"],
        context_window: 65536,
      },
    ];

    PROVIDERS["metadata-provider"] = {
      id: "metadata-provider",
      name: "Metadata Provider",
      defaultModel: "hf-free-model",
      models: metadataModels,
      requiresApiKey: false,
    };

    el.orchestrator.provider = "metadata-provider";
    el.orchestrator.model = "hf-free-model";
    el.updateModelSelector();

    expect(modelSelect.innerHTML).toContain("HF Free");
    expect(modelSelect.innerHTML).toContain("Free / Included");
    expect(modelSelect.innerHTML).toContain("Paid / Pro");
    expect(modelSelect.innerHTML).toContain("🛠️");
    expect(modelSelect.innerHTML).toContain("🚫🛠️");

    // 2. llamafile with empty models list and error message
    el.orchestrator.provider = "llamafile";
    el.orchestrator.model = "";
    const helpSpy = jest
      .spyOn(el, "showLlamafileHelpDialog")
      .mockResolvedValue(undefined as any);
    globalThis.fetch = jest
      .fn<any>()
      .mockRejectedValueOnce(new Error("Connection refused"));
    el.updateModelSelector();
    await new Promise((r) => setTimeout(r, 20));
    expect(helpSpy).toHaveBeenCalledWith(
      "Failed to load *.llamafile models: Connection refused",
    );

    // Without load error
    el.llamafileModelLoadError = null;
    globalThis.fetch = jest.fn<any>().mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });
    el.updateModelSelector();
    await new Promise((r) => setTimeout(r, 20));
    expect(helpSpy).toHaveBeenCalledWith(
      expect.stringContaining("No *.llamafile files were found"),
    );

    // 3. transformers_js_browser provider
    el.orchestrator.provider = "transformers_js_browser";
    el.orchestrator.model = "Xenova/distilgpt2";
    el.updateModelSelector();
    expect(modelSelect.innerHTML).toBeTruthy();

    delete PROVIDERS["metadata-provider"];
    document.body.removeChild(el);
  });

  it("handles llamafile modelsUrl headers with offline flag and custom auth format", async () => {
    const el = new ShadowClawLlm() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    PROVIDERS["llamafile"].apiKeyHeader = "X-Custom-Auth";
    PROVIDERS["llamafile"].apiKeyHeaderFormat = "Token {key}";

    el.orchestrator.provider = "llamafile";
    const { getLlamafileSettings, getApiKeyForHeaders } =
      (await import("../../../core/orchestrator/utils/operations/provider.js")) as any;
    getLlamafileSettings.mockReturnValue({
      mode: "cli",
      host: "http://127.0.0.1",
      port: 8080,
      offline: false,
    });
    getApiKeyForHeaders.mockResolvedValueOnce("my-secret-key");

    globalThis.fetch = jest.fn<any>().mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: "l-mod-1" }],
    });

    el.updateModelSelector();
    await new Promise((r) => setTimeout(r, 20));

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:8888/llamafile-proxy/models",
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-llamafile-mode": "cli",
          "x-llamafile-host": "http://127.0.0.1",
          "x-llamafile-port": "8080",
          "x-llamafile-offline": "false",
          "X-Custom-Auth": "Token my-secret-key",
        }),
      }),
    );

    delete PROVIDERS["llamafile"].apiKeyHeader;
    delete PROVIDERS["llamafile"].apiKeyHeaderFormat;
    document.body.removeChild(el);
  });

  it("handles event listeners for model-select change, streaming toggle, and context compression toggle", async () => {
    const el = new ShadowClawLlm() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    const root = el.shadowRoot!;
    const modelSelect = root.querySelector(
      '[data-setting="model-select"]',
    ) as HTMLSelectElement;
    const customInput = root.querySelector(
      '[data-setting="custom-model-input"]',
    ) as HTMLElement;
    const streamToggle = root.querySelector(
      '[data-setting="streaming-toggle"]',
    ) as HTMLInputElement;
    const compToggle = root.querySelector(
      '[data-setting="context-compression-toggle"]',
    ) as HTMLInputElement;

    // 1. model-select change to __custom__
    modelSelect.innerHTML =
      '<option value="__custom__">Custom</option><option value="model-1">Model 1</option>';
    modelSelect.value = "__custom__";
    modelSelect.dispatchEvent(new Event("change"));
    expect(customInput.style.display).toBe("block");

    // model-select change to standard
    modelSelect.value = "model-1";
    modelSelect.dispatchEvent(new Event("change"));
    expect(customInput.style.display).toBe("none");

    // 2. streaming toggle change
    const streamSpy = jest
      .spyOn(el, "onStreamingToggle")
      .mockResolvedValue(undefined as any);
    streamToggle.checked = true;
    streamToggle.dispatchEvent(new Event("change"));
    expect(streamSpy).toHaveBeenCalledWith(true);

    // 3. context compression toggle change
    const compSpy = jest
      .spyOn(el, "onContextCompressionToggle")
      .mockResolvedValue(undefined as any);
    compToggle.checked = false;
    compToggle.dispatchEvent(new Event("change"));
    expect(compSpy).toHaveBeenCalledWith(false);

    document.body.removeChild(el);
  });

  it("handles visibility functions and renderBedrockSettings with populated fields", async () => {
    const el = new ShadowClawLlm() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    const root = el.shadowRoot!;
    const { getBedrockSettings, getLlamafileSettings } =
      (await import("../../../core/orchestrator/utils/operations/provider.js")) as any;

    // 1. renderBedrockSettings with non-empty fields
    getBedrockSettings.mockReturnValueOnce({
      region: "eu-central-1",
      profile: "test-profile",
      authMode: "profile",
    });
    el.renderBedrockSettings();
    const regionInput = root.querySelector(
      '[data-setting="bedrock-region-input"]',
    ) as HTMLInputElement;
    const profileInput = root.querySelector(
      '[data-setting="bedrock-profile-input"]',
    ) as HTMLInputElement;
    const authSelect = root.querySelector(
      '[data-setting="bedrock-auth-mode-select"]',
    ) as HTMLSelectElement;
    expect(regionInput.value).toBe("eu-central-1");
    expect(profileInput.value).toBe("test-profile");
    expect(authSelect.value).toBe("profile");

    // 2. updateBedrockSettingsVisibility
    el.updateBedrockSettingsVisibility("bedrock_proxy");
    const bedrockSection = root.querySelector(
      '[data-setting="bedrock-settings"]',
    ) as HTMLElement;
    expect(bedrockSection.style.display).toBe("block");
    el.updateBedrockSettingsVisibility("other");
    expect(bedrockSection.style.display).toBe("none");

    // 3. updateMeshLlmSettingsVisibility
    el.updateMeshLlmSettingsVisibility("mesh-llm");
    const meshSection = root.querySelector(
      '[data-setting="mesh-llm-settings"]',
    ) as HTMLElement;
    expect(meshSection.style.display).toBe("block");
    el.updateMeshLlmSettingsVisibility("other");
    expect(meshSection.style.display).toBe("none");

    // 4. updateLlamafileSettingsVisibility
    el.updateLlamafileSettingsVisibility("llamafile");
    const llamafileSection = root.querySelector(
      '[data-setting="llamafile-settings"]',
    ) as HTMLElement;
    expect(llamafileSection.style.display).toBe("block");
    el.updateLlamafileSettingsVisibility("other");
    expect(llamafileSection.style.display).toBe("none");

    // 5. updateTransformersJsSettingsVisibility
    el.updateTransformersJsSettingsVisibility("transformers_js_browser");
    const tjsSection = root.querySelector(
      '[data-setting="transformers-js-settings"]',
    ) as HTMLElement;
    expect(tjsSection.style.display).toBe("block");
    el.updateTransformersJsSettingsVisibility("other");
    expect(tjsSection.style.display).toBe("none");

    // 6. updateLlamafileModeVisibility: isServerMode = true vs false
    el.orchestrator.provider = "llamafile";
    getLlamafileSettings.mockReturnValue({ mode: "server" });
    el.updateLlamafileModeVisibility();
    const serverOnly = root.querySelector(
      '[data-setting="llamafile-server-only"]',
    ) as HTMLElement;
    const cliOnly = root.querySelector(
      '[data-setting="llamafile-cli-only"]',
    ) as HTMLElement;
    expect(serverOnly.style.display).toBe("block");
    expect(cliOnly.style.display).toBe("none");

    getLlamafileSettings.mockReturnValue({ mode: "cli" });
    el.updateLlamafileModeVisibility();
    expect(serverOnly.style.display).toBe("none");
    expect(cliOnly.style.display).toBe("block");

    // 7. updateLlamafileModelSectionVisibility: server mode hides modelSection
    getLlamafileSettings.mockReturnValue({ mode: "server" });
    el.updateLlamafileModelSectionVisibility();
    const modelSection = root.querySelector(
      '[data-setting="model-settings"]',
    ) as HTMLElement;
    expect(modelSection.style.display).toBe("none");

    getLlamafileSettings.mockReturnValue({ mode: "cli" });
    el.updateLlamafileModelSectionVisibility();
    expect(modelSection.style.display).toBe("block");

    document.body.removeChild(el);
  });

  it("handles modelsUrl fetch error status, provider change race condition, and static model merging", async () => {
    const el = new ShadowClawLlm() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    // 1. fetch returns !r.ok
    PROVIDERS["err-status-provider"] = {
      id: "err-status-provider",
      name: "Error Status Provider",
      defaultModel: "",
      modelsUrl: "http://localhost:8888/models-err",
      models: [{ id: "fallback-m1", name: "Fallback M1" }],
    };
    el.orchestrator.provider = "err-status-provider";
    globalThis.fetch = jest.fn<any>().mockResolvedValueOnce({
      ok: false,
      status: 502,
    });
    el.updateModelSelector();
    await new Promise((r) => setTimeout(r, 20));
    const modelSelect = el.shadowRoot!.querySelector(
      '[data-setting="model-select"]',
    ) as HTMLSelectElement;
    expect(modelSelect.innerHTML).toContain("Fallback M1");

    // 2. provider changed while fetch was in flight
    PROVIDERS["race-provider"] = {
      id: "race-provider",
      name: "Race Provider",
      defaultModel: "",
      modelsUrl: "http://localhost:8888/models-race",
    };
    el.orchestrator.provider = "race-provider";
    globalThis.fetch = jest.fn<any>().mockImplementationOnce(async () => {
      // Simulate user switching provider before json resolves
      el.orchestrator.provider = "provider-a";
      return {
        ok: true,
        json: async () => [{ id: "race-model" }],
      };
    });
    el.updateModelSelector();
    await new Promise((r) => setTimeout(r, 20));
    // Should return early and not crash

    // 3. Static models merge with duplicate and unique items
    PROVIDERS["merge-provider"] = {
      id: "merge-provider",
      name: "Merge Provider",
      defaultModel: "static-1",
      modelsUrl: "http://localhost:8888/models-merge",
      models: [
        { id: "static-1", name: "Static 1" },
        { id: "shared-1", name: "Shared 1" },
      ],
    };
    el.orchestrator.provider = "merge-provider";
    globalThis.fetch = jest.fn<any>().mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: "shared-1", name: "Shared Dynamic" },
        { id: "dynamic-only", name: "Dynamic Only" },
      ],
    });
    el.updateModelSelector();
    await new Promise((r) => setTimeout(r, 20));
    expect(modelSelect.innerHTML).toContain("Static 1");
    expect(modelSelect.innerHTML).toContain("Dynamic Only");

    delete PROVIDERS["err-status-provider"];
    delete PROVIDERS["race-provider"];
    delete PROVIDERS["merge-provider"];
    document.body.removeChild(el);
  });

  it("handles missing element null guards across save and render methods", async () => {
    const el = new ShadowClawLlm() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    // Clear shadowRoot to simulate missing elements
    const savedRootHtml = el.shadowRoot!.innerHTML;
    el.shadowRoot!.innerHTML = "";

    // All should return early without throwing
    await el.saveLlamafileSettings();
    await el.saveMaxTokens();
    await el.saveMeshLlmSettings();
    await el.saveRateLimitSettings();
    await el.saveReasoningEffort();
    await el.saveSubagentMaxParallel();
    await el.saveSubagentWorkspaceMode();
    await el.saveApiKey();
    await el.saveBedrockSettings();
    await el.saveModel();
    await el.renderBuiltinAiSettings();
    await el.renderTransformersJsSettings();
    el.updateLlamafileModeVisibility();

    // Null db guards
    el.db = null;
    await el.renderBuiltinAiSettings();
    await el.renderTransformersJsSettings();

    el.shadowRoot!.innerHTML = savedRootHtml;
    document.body.removeChild(el);
  });
});
