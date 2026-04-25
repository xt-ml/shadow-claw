import { jest } from "@jest/globals";
import fs from "node:fs";
import path from "node:path";

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
};

jest.unstable_mockModule("../../config.js", () => ({
  CONFIG_KEYS: {
    PROVIDER: "provider",
    API_KEY: "api_key",
    MODEL: "model",
    MAX_TOKENS: "max_tokens",
    ASSISTANT_NAME: "assistant_name",
    STREAMING_ENABLED: "streaming_enabled",
    MAX_ITERATIONS: "max_iterations",
    USE_PROXY: "use_proxy",
    CONTEXT_COMPRESSION: "context_compression",
  },
  DEFAULT_MAX_ITERATIONS: 50,
  DEFAULT_GROUP_ID: "br:main",
  OPFS_ROOT: "shadowclaw",
  PROVIDERS,
  getModelMaxTokens: jest.fn((modelId: string) =>
    modelId.includes("thinking") ? 4096 : 8192,
  ),
  getAvailableProviders: () => Object.keys(PROVIDERS),
  getProvider: (id: string) => (PROVIDERS as any)[id],
}));

jest.unstable_mockModule("../../db/setConfig.js", () => ({
  setConfig: jest.fn<any>().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../../db/getConfig.js", () => ({
  getConfig: jest.fn<any>().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../../toast.js", () => ({
  showError: jest.fn(),
  showSuccess: jest.fn(),
  showWarning: jest.fn(),
  showInfo: jest.fn(),
}));

jest.unstable_mockModule("../../db/db.js", () => ({
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

// Global fetch is already mocked in jest-setup.ts

const { orchestratorStore } = await import("../../stores/orchestrator.js");
const { ShadowClawSettingsLlm } = await import("./shadow-claw-settings-llm.js");
const { showSuccess, showWarning, showError } = await import("../../toast.js");

function createOrchestratorStub(overrides = {}) {
  return {
    setModel: jest.fn<any>().mockResolvedValue(undefined),
    setAssistantName: jest.fn<any>().mockResolvedValue(undefined),
    setMaxTokens: jest.fn<any>().mockResolvedValue(undefined),
    setMaxIterations: jest.fn<any>().mockResolvedValue(undefined),
    setStreamingEnabled: jest.fn<any>().mockResolvedValue(undefined),
    setUseProxy: jest.fn<any>().mockResolvedValue(undefined),
    setCompressionEnabled: jest.fn<any>().mockResolvedValue(undefined),
    getAvailableProviders: jest
      .fn<any>()
      .mockReturnValue(Object.values(PROVIDERS)),
    getProvider: jest.fn<any>().mockReturnValue("provider-a"),
    getModel: jest.fn<any>().mockReturnValue("model-a"),
    getAssistantName: jest.fn<any>().mockReturnValue("Claw"),
    getMaxTokens: jest.fn<any>().mockReturnValue(4096),
    getMaxIterations: jest.fn<any>().mockReturnValue(50),
    getStreamingEnabled: jest.fn<any>().mockReturnValue(true),
    getApiKey: jest.fn<any>().mockReturnValue(""),
    getUseProxy: jest.fn<any>().mockReturnValue(false),
    getCompressionEnabled: jest.fn<any>().mockReturnValue(false),
    getContextCompressionEnabled: jest.fn<any>().mockReturnValue(false),
    getProxyUrl: jest.fn<any>().mockReturnValue(""),
    ...overrides,
  };
}

describe("shadow-claw-settings-llm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("registers custom element", () => {
    expect(customElements.get("shadow-claw-settings-llm")).toBe(
      ShadowClawSettingsLlm,
    );
  });

  it("renders selectors correctly", async () => {
    const orch = createOrchestratorStub();
    (orchestratorStore as any).orchestrator = orch;

    const el = new ShadowClawSettingsLlm();
    document.body.appendChild(el);
    await el.onTemplateReady;
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

    const el = new ShadowClawSettingsLlm();
    document.body.appendChild(el);
    await el.onTemplateReady;
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

  it("saves max tokens from settings", async () => {
    const orch = createOrchestratorStub();
    (orchestratorStore as any).orchestrator = orch;

    const el = new ShadowClawSettingsLlm();
    document.body.appendChild(el);
    await el.onTemplateReady;
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

    expect(orch.setMaxTokens).toHaveBeenCalledWith(expect.anything(), 2048);
    expect(showSuccess).toHaveBeenCalledWith("Max tokens saved", 3000);

    document.body.removeChild(el);
  });
});
