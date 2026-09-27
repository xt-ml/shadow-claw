import { describe, expect, it, jest } from "@jest/globals";

import type { OrchestratorState } from "../../orchestrator-state.js";
import type { ShadowClawDatabase } from "../../../../db/db.js";
import type { EventBus } from "../EventBus.js";
import type { ProviderConfig } from "../../../../config/config.js";

const mockGetConfig = jest.fn<(...args: unknown[]) => Promise<unknown>>();
jest.unstable_mockModule("../../../../db/getConfig.js", () => ({
  getConfig: mockGetConfig,
}));

const mockDefaultSetConfig = jest
  .fn<(...args: unknown[]) => Promise<void>>()
  .mockResolvedValue(undefined);
jest.unstable_mockModule("../../../../db/setConfig.js", () => ({
  setConfig: mockDefaultSetConfig,
}));

const mockFetchModelInfo = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockGetModelInfo = jest
  .fn<(...args: unknown[]) => unknown>()
  .mockReturnValue(undefined);
jest.unstable_mockModule(
  "../../../../subsystems/providers/model-registry.js",
  () => ({
    modelRegistry: {
      fetchModelInfo: mockFetchModelInfo,
      getModelInfo: mockGetModelInfo,
    },
  }),
);

const mockIsPromptApiSupported = jest.fn<() => boolean>();
jest.unstable_mockModule(
  "../../../../subsystems/providers/prompt-api-provider.js",
  () => ({
    isPromptApiSupported: mockIsPromptApiSupported,
  }),
);

const mockToolsStore = {
  activeProfileId: "default" as string | null,
  enabledToolNames: new Set<string>(["tool1"]),
  findProfilesForProvider: jest
    .fn<(...args: unknown[]) => unknown[]>()
    .mockReturnValue([]),
  activateProfile: jest
    .fn<(...args: unknown[]) => Promise<void>>()
    .mockResolvedValue(undefined),
};
jest.unstable_mockModule("../../../../stores/tools.js", () => ({
  toolsStore: mockToolsStore,
}));
const { PROVIDERS } = await import("../../../../config/config.js");

function makeProviderConfig(
  overrides: Partial<ProviderConfig> = {},
): ProviderConfig {
  return {
    id: "test-provider",
    name: "Test Provider",
    baseUrl: "http://api/chat/completions",
    format: "openai",
    requiresApiKey: false,
    apiKeyHeader: "Authorization",
    headers: {},
    supportsStreaming: true,
    defaultModel: "model-1",
    ...overrides,
  };
}

PROVIDERS.test_empty_models = makeProviderConfig({
  id: "test_empty_models",
  name: "Test Empty Models",
  baseUrl: "http://api/chat/completions",
  requiresApiKey: true,
  supportsStreaming: false,
  defaultModel: "fallback-default-model",
  models: [],
});

const {
  getApiKeyForHeaders,
  getApiKeyForRequest,
  getLlamafileSettings,
  getMeshLlmSettings,
  getBedrockSettings,
  getAvailableProviders,
  getReasoningConfig,
  getProviderRuntimeHeaders,
  applyLlamafileHeaders,
  applyMeshLlmHeaders,
  getTransformersStatusUrl,
  setAssistantName,
  setBedrockSettings,
  setLlamafileSettings,
  setMeshLlmSettings,
  setModel,
  setPeerjsMyAlias,
  setPeerjsPeerAliases,
  autoActivateProfile,
  setProvider,
  pollTransformersProgress,
  startTransformersProgressPolling,
  stopTransformersProgressPolling,
  cancelLlamafileRequest,
} = await import("./provider.js");

function makeState(
  overrides: Partial<OrchestratorState> = {},
): OrchestratorState {
  return {
    assistantName: "Assistant",
    triggerPattern: new RegExp(""),
    reasoningEffort: "none",
    provider: "openrouter",
    model: "test-model",
    maxTokens: 8192,
    providerConfig: makeProviderConfig({
      id: "openrouter",
      name: "OpenRouter",
      baseUrl: "http://api/chat/completions",
      requiresApiKey: true,
      defaultModel: "test-model",
    }),
    llamafileMode: "server",
    llamafileHost: "127.0.0.1",
    llamafilePort: 8080,
    llamafileOffline: false,
    meshLlmHost: "https://public.meshllm.cloud",
    bedrockAuthMode: "provider_chain",
    bedrockProfileFallback: "default",
    bedrockRegionFallback: "us-east-1",
    peerjsMyAlias: "me",
    peerjsPeerAliases: {},
    transformersProgressPollers: new Map<string, number>(),
    ...overrides,
  } as unknown as OrchestratorState;
}

describe("provider operations", () => {
  const mockDb = {} as unknown as ShadowClawDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockToolsStore.activeProfileId = "default";
    mockToolsStore.enabledToolNames = new Set(["tool1"]);
    mockToolsStore.findProfilesForProvider.mockReturnValue([]);
    mockToolsStore.activateProfile.mockResolvedValue(undefined);
  });

  it("getApiKeyForHeaders and getApiKeyForRequest return correct values", async () => {
    const orchestratorWithKey = {
      getApiKey: jest
        .fn<() => Promise<string | null>>()
        .mockResolvedValue("sk-secret-123"),
    };
    expect(await getApiKeyForHeaders(orchestratorWithKey)).toBe(
      "sk-secret-123",
    );
    expect(await getApiKeyForRequest(orchestratorWithKey)).toBe(
      "sk-secret-123",
    );

    const orchestratorNoKey = {
      getApiKey: jest
        .fn<() => Promise<string | null>>()
        .mockResolvedValue(null),
    };
    expect(await getApiKeyForHeaders(orchestratorNoKey)).toBeUndefined();
    expect(await getApiKeyForRequest(orchestratorNoKey)).toBe("");
  });

  it("retrieves llamafile, meshllm, and bedrock settings", () => {
    const state = makeState();
    expect(getLlamafileSettings(state)).toEqual({
      mode: "server",
      host: "127.0.0.1",
      port: 8080,
      offline: false,
    });

    expect(getMeshLlmSettings(state)).toEqual({
      host: "https://public.meshllm.cloud",
    });

    expect(getBedrockSettings(state)).toEqual({
      authMode: "provider_chain",
      profile: "default",
      region: "us-east-1",
    });
  });

  it("getAvailableProviders returns non-empty list of providers and handles empty models array", () => {
    const providers = getAvailableProviders();
    expect(providers.length).toBeGreaterThan(0);
    expect(providers.some((p) => p.id === "openrouter")).toBe(true);

    const emptyModelsProvider = providers.find(
      (p) => p.id === "test_empty_models",
    );
    expect(emptyModelsProvider).toBeDefined();
    expect(emptyModelsProvider?.models).toEqual(["fallback-default-model"]);
  });

  it("getReasoningConfig returns effort or undefined for various effort inputs", () => {
    expect(getReasoningConfig(makeState({ reasoningEffort: "high" }))).toEqual({
      effort: "high",
    });
    expect(
      getReasoningConfig(makeState({ reasoningEffort: "none" })),
    ).toBeUndefined();
    expect(
      getReasoningConfig(makeState({ reasoningEffort: "" })),
    ).toBeUndefined();
    expect(
      getReasoningConfig({
        reasoningEffort: 123 as unknown as string,
      } as unknown as OrchestratorState),
    ).toBeUndefined();
  });

  it("getProviderRuntimeHeaders returns correct headers for llamafile and bedrock", () => {
    const state = makeState();

    // Llamafile without overrides
    const llamaHeaders = getProviderRuntimeHeaders(state, "llamafile", "req-1");
    expect(llamaHeaders["x-llamafile-mode"]).toBe("server");
    expect(llamaHeaders["x-llamafile-host"]).toBe("127.0.0.1");
    expect(llamaHeaders["x-shadowclaw-request-id"]).toBe("req-1");

    // Llamafile with overrides
    const llamaOverrideHeaders = getProviderRuntimeHeaders(
      state,
      "llamafile",
      "",
      {
        llamafile: { mode: "cli", host: "10.0.0.1", port: 9000, offline: true },
      },
    );
    expect(llamaOverrideHeaders["x-llamafile-mode"]).toBe("cli");
    expect(llamaOverrideHeaders["x-llamafile-host"]).toBe("10.0.0.1");
    expect(llamaOverrideHeaders["x-llamafile-port"]).toBe("9000");
    expect(llamaOverrideHeaders["x-llamafile-offline"]).toBe("true");

    // Llamafile with invalid mode fallback
    const llamaInvalidMode = getProviderRuntimeHeaders(state, "llamafile", "", {
      llamafile: { mode: "invalid" as unknown as "server" },
    });
    expect(llamaInvalidMode["x-llamafile-mode"]).toBe("server");

    // Bedrock without overrides
    const bedrockHeaders = getProviderRuntimeHeaders(state, "bedrock_proxy");
    expect(bedrockHeaders["x-bedrock-region"]).toBe("us-east-1");
    expect(bedrockHeaders["x-bedrock-profile"]).toBe("default");
    expect(bedrockHeaders["x-bedrock-auth-mode"]).toBe("provider_chain");

    // Bedrock with overrides
    const bedrockOverrideHeaders = getProviderRuntimeHeaders(
      state,
      "bedrock_proxy",
      "",
      {
        bedrock_proxy: {
          region: "eu-west-1",
          profile: "custom",
          authMode: "sso",
        },
      },
    );
    expect(bedrockOverrideHeaders["x-bedrock-region"]).toBe("eu-west-1");
    expect(bedrockOverrideHeaders["x-bedrock-profile"]).toBe("custom");
    expect(bedrockOverrideHeaders["x-bedrock-auth-mode"]).toBe("sso");

    // Bedrock without region or profile
    const emptyBedrockState = makeState({
      bedrockRegionFallback: "",
      bedrockProfileFallback: "",
      bedrockAuthMode: "sso",
    });
    const emptyBedrockHeaders = getProviderRuntimeHeaders(
      emptyBedrockState,
      "bedrock_proxy",
    );
    expect(emptyBedrockHeaders["x-bedrock-region"]).toBeUndefined();
    expect(emptyBedrockHeaders["x-bedrock-profile"]).toBeUndefined();
    expect(emptyBedrockHeaders["x-bedrock-auth-mode"]).toBe("sso");

    // Other provider
    expect(getProviderRuntimeHeaders(state, "openrouter")).toEqual({});
  });

  it("applyLlamafileHeaders and applyMeshLlmHeaders update providerConfig headers", () => {
    const llamaState = makeState({
      providerConfig: makeProviderConfig({
        id: "llamafile",
        name: "Llamafile",
        baseUrl: "http://127.0.0.1:8080/v1",
        defaultModel: "llamafile",
      }),
      llamafileOffline: true,
    });
    applyLlamafileHeaders(llamaState);
    expect(llamaState.providerConfig?.headers?.["x-llamafile-mode"]).toBe(
      "server",
    );
    expect(llamaState.providerConfig?.headers?.["x-llamafile-offline"]).toBe(
      "true",
    );

    const llamaNoHeadersState = makeState({
      providerConfig: makeProviderConfig({
        id: "llamafile",
        name: "Llamafile",
        baseUrl: "http://127.0.0.1:8080/v1",
        defaultModel: "llamafile",
        headers: undefined,
      }),
      llamafileOffline: false,
    });
    applyLlamafileHeaders(llamaNoHeadersState);
    expect(
      llamaNoHeadersState.providerConfig?.headers?.["x-llamafile-offline"],
    ).toBe("false");

    const meshState = makeState({
      providerConfig: makeProviderConfig({
        id: "mesh-llm",
        name: "MeshLLM",
        baseUrl: "https://mesh.cloud/v1",
        defaultModel: "mesh",
      }),
      meshLlmHost: "https://mesh.custom.io",
    });
    applyMeshLlmHeaders(meshState);
    expect(meshState.providerConfig?.headers?.["x-mesh-llm-host"]).toBe(
      "https://mesh.custom.io",
    );

    const meshNoHeaders = makeState({
      providerConfig: makeProviderConfig({
        id: "mesh-llm",
        name: "MeshLLM",
        baseUrl: "https://mesh.cloud/v1",
        defaultModel: "mesh",
        headers: undefined,
      }),
      meshLlmHost: "https://mesh.noheaders.io",
    });
    applyMeshLlmHeaders(meshNoHeaders);
    expect(meshNoHeaders.providerConfig?.headers?.["x-mesh-llm-host"]).toBe(
      "https://mesh.noheaders.io",
    );

    const otherState = makeState({
      providerConfig: makeProviderConfig({
        id: "anthropic",
        name: "Anthropic",
        baseUrl: "https://api.anthropic.com/v1",
        format: "anthropic",
        requiresApiKey: true,
        defaultModel: "claude",
      }),
    });
    applyLlamafileHeaders(otherState);
    applyMeshLlmHeaders(otherState);
  });

  it("getTransformersStatusUrl computes status URL correctly across fallbacks", () => {
    const state1 = makeState({
      providerConfig: makeProviderConfig({
        id: "transformers_js_local",
        name: "Local",
        baseUrl: "http://api/chat/completions",
        defaultModel: "model",
      }),
    });
    expect(getTransformersStatusUrl(state1)).toBe("http://api/status");

    const inFlightMap = new Map();
    inFlightMap.set("group-1", {
      providerId: "transformers_js_local",
      providerConfig: makeProviderConfig({
        id: "transformers_js_local",
        baseUrl: "http://custom-host/chat/completions",
      }),
    });
    const state2 = makeState({
      inFlightEffectiveProviderByGroup: inFlightMap,
    });
    expect(getTransformersStatusUrl(state2, "group-1")).toBe(
      "http://custom-host/status",
    );

    // In flight without /chat/completions falls through
    inFlightMap.set("group-2", {
      providerId: "transformers_js_local",
      providerConfig: makeProviderConfig({
        id: "transformers_js_local",
        baseUrl: "http://custom-host/other",
      }),
    });
    expect(getTransformersStatusUrl(state2, "group-2")).toBe(
      "http://localhost:8888/transformers-js-proxy/status",
    );

    expect(getTransformersStatusUrl(state2, "group-missing")).toBe(
      "http://localhost:8888/transformers-js-proxy/status",
    );

    inFlightMap.set("group-openrouter", {
      providerId: "openrouter",
      providerConfig: makeProviderConfig({
        id: "openrouter",
        baseUrl: "https://openrouter.ai/api/v1/chat/completions",
      }),
    });
    expect(getTransformersStatusUrl(state2, "group-openrouter")).toBe(
      "http://localhost:8888/transformers-js-proxy/status",
    );

    inFlightMap.set("group-no-base", {
      providerId: "transformers_js_local",
      providerConfig: makeProviderConfig({
        id: "transformers_js_local",
        baseUrl: "",
      }),
    });
    expect(getTransformersStatusUrl(state2, "group-no-base")).toBe(
      "http://localhost:8888/transformers-js-proxy/status",
    );

    // ProviderConfig with empty id
    const stateEmptyId = makeState({
      providerConfig: makeProviderConfig({
        id: "",
        baseUrl: "http://anonymous/chat/completions",
      }),
    });
    expect(getTransformersStatusUrl(stateEmptyId)).toBe(
      "http://anonymous/status",
    );

    // ProviderConfig with empty baseUrl
    const stateEmptyBase = makeState({
      providerConfig: makeProviderConfig({
        id: "transformers_js_local",
        baseUrl: "",
      }),
    });
    expect(getTransformersStatusUrl(stateEmptyBase)).toBe(
      "http://localhost:8888/transformers-js-proxy/status",
    );

    // Fallback when providerConfig has no /chat/completions
    const stateNoChat = makeState({
      providerConfig: makeProviderConfig({
        id: "other",
        name: "Other",
        baseUrl: "http://api/other",
        defaultModel: "model",
      }),
    });
    const origLocalBaseUrl = PROVIDERS.transformers_js_local.baseUrl;
    PROVIDERS.transformers_js_local.baseUrl = "http://localhost:8888/other";
    expect(getTransformersStatusUrl(stateNoChat)).toBe(
      "http://localhost:8888/transformers-js-proxy/status",
    );
    PROVIDERS.transformers_js_local.baseUrl = "";
    expect(getTransformersStatusUrl(stateNoChat)).toBe(
      "http://localhost:8888/transformers-js-proxy/status",
    );
    PROVIDERS.transformers_js_local.baseUrl = origLocalBaseUrl;
  });

  it("async setters update state and call setConfig", async () => {
    const state = makeState();
    const mockSetConfig = jest
      .fn<(...args: unknown[]) => Promise<void>>()
      .mockResolvedValue(undefined);

    await setAssistantName(state, mockDb, "NewAssistant", mockSetConfig);
    expect(state.assistantName).toBe("NewAssistant");
    expect(mockSetConfig).toHaveBeenCalledWith(
      mockDb,
      "assistant_name",
      "NewAssistant",
    );

    await setBedrockSettings(
      state,
      mockDb,
      { authMode: "sso", profile: "prof1", region: "us-west-2" },
      mockSetConfig,
    );
    expect(state.bedrockRegionFallback).toBe("us-west-2");
    expect(state.bedrockProfileFallback).toBe("prof1");
    expect(state.bedrockAuthMode).toBe("sso");

    // Bedrock with non-sso authMode and non-string region/profile
    await setBedrockSettings(
      state,
      mockDb,
      {
        authMode: "other",
        profile: null as unknown as string,
        region: null as unknown as string,
      },
      mockSetConfig,
    );
    expect(state.bedrockAuthMode).toBe("provider_chain");
    expect(state.bedrockRegionFallback).toBe("");
    expect(state.bedrockProfileFallback).toBe("");

    await setLlamafileSettings(
      state,
      mockDb,
      { host: "192.168.1.1", mode: "cli", offline: true, port: 9999 },
      mockSetConfig,
    );
    expect(state.llamafileMode).toBe("cli");
    expect(state.llamafileHost).toBe("192.168.1.1");
    expect(state.llamafilePort).toBe(9999);
    expect(state.llamafileOffline).toBe(true);

    await setMeshLlmSettings(
      state,
      mockDb,
      { host: "https://mesh.new.host" },
      mockSetConfig,
    );
    expect(state.meshLlmHost).toBe("https://mesh.new.host");

    await setModel(state, mockDb, "openrouter/free", mockSetConfig);
    expect(state.model).toBe("openrouter/free");

    await setPeerjsMyAlias(state, mockDb, "my-alias", mockSetConfig);
    expect(state.peerjsMyAlias).toBe("my-alias");

    await setPeerjsPeerAliases(
      state,
      mockDb,
      { peer1: "Alias 1" },
      mockSetConfig,
    );
    expect(state.peerjsPeerAliases).toEqual({ peer1: "Alias 1" });
  });

  it("setModel resolves fallback model when Prompt API is unsupported", async () => {
    const state = makeState({
      provider: "prompt_api",
      model: "browser-built-in",
    });
    const mockSetConfig = jest
      .fn<(...args: unknown[]) => Promise<void>>()
      .mockResolvedValue(undefined);
    mockIsPromptApiSupported.mockReturnValue(false);

    // With configured fallback
    mockGetConfig.mockResolvedValueOnce("custom-qwen-model");
    await setModel(state, mockDb, "browser-built-in", mockSetConfig);
    expect(state.model).toBe("browser-built-in");

    // With no configured fallback
    mockGetConfig.mockResolvedValueOnce("");
    await setModel(state, mockDb, "", mockSetConfig);
    expect(state.model).toBe("");
  });

  it("autoActivateProfile activates exact, provider-only, or returns early", async () => {
    const state = makeState({ provider: "test-provider", model: "test-model" });

    // Returns early when no tools enabled and no active profile
    mockToolsStore.activeProfileId = null;
    mockToolsStore.enabledToolNames = new Set();
    await autoActivateProfile(state, mockDb);
    expect(mockToolsStore.findProfilesForProvider).not.toHaveBeenCalled();

    // Returns early when candidates is empty
    mockToolsStore.activeProfileId = "prof-1";
    mockToolsStore.enabledToolNames = new Set(["tool-1"]);
    mockToolsStore.findProfilesForProvider.mockReturnValue([]);
    await autoActivateProfile(state, mockDb);
    expect(mockToolsStore.activateProfile).not.toHaveBeenCalled();

    // Activates exact match
    mockToolsStore.findProfilesForProvider.mockReturnValue([
      { id: "exact-prof", providerId: "test-provider", model: "test-model" },
    ]);
    await autoActivateProfile(state, mockDb);
    expect(mockToolsStore.activateProfile).toHaveBeenCalledWith(
      mockDb,
      "exact-prof",
    );

    // Activates provider-only match when exact match is absent
    mockToolsStore.activateProfile.mockClear();
    mockToolsStore.findProfilesForProvider.mockReturnValue([
      { id: "prov-prof", providerId: "test-provider", model: undefined },
    ]);
    await autoActivateProfile(state, mockDb);
    expect(mockToolsStore.activateProfile).toHaveBeenCalledWith(
      mockDb,
      "prov-prof",
    );

    // No matching candidate
    mockToolsStore.activateProfile.mockClear();
    mockToolsStore.findProfilesForProvider.mockReturnValue([
      { id: "other-prof", providerId: "other-provider", model: "other-model" },
    ]);
    await autoActivateProfile(state, mockDb);
    expect(mockToolsStore.activateProfile).not.toHaveBeenCalled();
  });

  it("setProvider switches provider, loads key, and updates config", async () => {
    const state = makeState();
    const mockSetConfig = jest
      .fn<(...args: unknown[]) => Promise<void>>()
      .mockResolvedValue(undefined);
    const mockLoadKey = jest
      .fn<(...args: unknown[]) => Promise<void>>()
      .mockResolvedValue(undefined);
    const mockGetKey = jest
      .fn<() => Promise<string | undefined>>()
      .mockResolvedValue("key123");

    // Throws on unknown provider
    await expect(
      setProvider(
        state,
        mockDb,
        "non-existent-provider",
        {
          loadApiKeyForProvider: mockLoadKey,
          getApiKeyForHeaders: mockGetKey,
        },
        mockSetConfig,
      ),
    ).rejects.toThrow("Unknown provider: non-existent-provider");

    // Switches to openrouter
    await setProvider(
      state,
      mockDb,
      "openrouter",
      {
        loadApiKeyForProvider: mockLoadKey,
        getApiKeyForHeaders: mockGetKey,
      },
      mockSetConfig,
    );

    expect(state.provider).toBe("openrouter");
    expect(mockLoadKey).toHaveBeenCalledWith(mockDb, "openrouter");
    expect(mockSetConfig).toHaveBeenCalledWith(
      mockDb,
      "provider",
      "openrouter",
    );

    // Switches to prompt_api when unsupported
    mockIsPromptApiSupported.mockReturnValue(false);
    mockGetConfig.mockResolvedValueOnce("custom-prompt-fallback");
    await setProvider(
      state,
      mockDb,
      "prompt_api",
      {
        loadApiKeyForProvider: mockLoadKey,
        getApiKeyForHeaders: mockGetKey,
      },
      mockSetConfig,
    );
    expect(state.provider).toBe("prompt_api");

    // Switches to prompt_api when supported
    mockIsPromptApiSupported.mockReturnValue(true);
    await setProvider(
      state,
      mockDb,
      "prompt_api",
      {
        loadApiKeyForProvider: mockLoadKey,
        getApiKeyForHeaders: mockGetKey,
      },
      mockSetConfig,
    );
    expect(state.provider).toBe("prompt_api");

    // Switches to prompt_api when unsupported but model is not browser-built-in
    mockIsPromptApiSupported.mockReturnValue(false);
    PROVIDERS.prompt_api.defaultModel = "custom-prompt-model";
    await setProvider(
      state,
      mockDb,
      "prompt_api",
      {
        loadApiKeyForProvider: mockLoadKey,
        getApiKeyForHeaders: mockGetKey,
      },
      mockSetConfig,
    );
    PROVIDERS.prompt_api.defaultModel = "browser-built-in";
  });

  it("async setters work with default setConfig implementation", async () => {
    const state = makeState();
    await setAssistantName(state, mockDb, "DefaultAssistant");
    expect(state.assistantName).toBe("DefaultAssistant");
    expect(mockDefaultSetConfig).toHaveBeenCalledWith(
      mockDb,
      "assistant_name",
      "DefaultAssistant",
    );

    await setBedrockSettings(state, mockDb, {
      authMode: "sso",
      profile: "p",
      region: "r",
    });
    expect(state.bedrockRegionFallback).toBe("r");

    await setLlamafileSettings(state, mockDb, {
      host: "1.2.3.4",
      mode: "server",
      offline: false,
      port: 8080,
    });
    expect(state.llamafileHost).toBe("1.2.3.4");

    await setMeshLlmSettings(state, mockDb, { host: "https://mesh.default" });
    expect(state.meshLlmHost).toBe("https://mesh.default");

    await setModel(state, mockDb, "openrouter/free");
    expect(state.model).toBe("openrouter/free");

    await setPeerjsMyAlias(state, mockDb, "alias-default");
    expect(state.peerjsMyAlias).toBe("alias-default");

    await setPeerjsPeerAliases(state, mockDb, { p: "alias" });
    expect(state.peerjsPeerAliases).toEqual({ p: "alias" });

    mockIsPromptApiSupported.mockReturnValue(false);
    mockGetConfig.mockResolvedValueOnce("");
    const mockLoadKey = jest
      .fn<(...args: unknown[]) => Promise<void>>()
      .mockResolvedValue(undefined);
    const mockGetKey = jest
      .fn<() => Promise<string | undefined>>()
      .mockResolvedValue("");
    await setProvider(state, mockDb, "prompt_api", {
      loadApiKeyForProvider: mockLoadKey,
      getApiKeyForHeaders: mockGetKey,
    });
    expect(state.provider).toBe("prompt_api");
    expect(mockDefaultSetConfig).toHaveBeenCalledWith(
      mockDb,
      "provider",
      "prompt_api",
    );
  });

  it("polls transformers progress and emits events across status branches", async () => {
    const state = makeState();
    const mockEvents = {
      emit: jest.fn<(...args: unknown[]) => unknown>(),
    } as unknown as EventBus;
    const mockStopPolling = jest.fn();

    // Progress > 1 normalizes by / 100
    global.fetch = jest
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          progress: 75,
          message: "Downloading weights...",
          status: "running",
        }),
      } as unknown as Response) as typeof global.fetch;

    await pollTransformersProgress(
      state,
      mockEvents,
      "group-p",
      mockStopPolling,
    );

    expect(mockEvents.emit).toHaveBeenCalledWith("model-download-progress", {
      groupId: "group-p",
      message: "Downloading weights...",
      progress: 0.75,
      status: "running",
    });
    expect(mockStopPolling).not.toHaveBeenCalled();

    // Progress <= 1 and status 'error'
    global.fetch = jest
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          progress: 0.4,
          status: "error",
        }),
      } as unknown as Response) as typeof global.fetch;

    await pollTransformersProgress(
      state,
      mockEvents,
      "group-p",
      mockStopPolling,
    );
    expect(mockStopPolling).toHaveBeenCalledWith("group-p");

    // Progress not finite
    mockStopPolling.mockClear();
    global.fetch = jest
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          progress: "not-a-number",
          status: "running",
        }),
      } as unknown as Response) as typeof global.fetch;

    await pollTransformersProgress(
      state,
      mockEvents,
      "group-p",
      mockStopPolling,
    );
    expect(mockEvents.emit).toHaveBeenCalledWith(
      "model-download-progress",
      expect.objectContaining({ progress: null }),
    );

    // Res not ok
    global.fetch = jest
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockResolvedValue({
        ok: false,
      } as unknown as Response) as typeof global.fetch;

    await pollTransformersProgress(
      state,
      mockEvents,
      "group-p",
      mockStopPolling,
    );

    // Fetch rejection handled cleanly
    global.fetch = jest
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockRejectedValue(new Error("Network failure")) as typeof global.fetch;

    await pollTransformersProgress(
      state,
      mockEvents,
      "group-p",
      mockStopPolling,
    );
  });

  it("starts and stops transformers progress polling with timer interval", async () => {
    jest.useFakeTimers();
    const state = makeState();
    const mockEvents = {
      emit: jest.fn<(...args: unknown[]) => unknown>(),
    } as unknown as EventBus;

    // Case 1: Initial poll finishes immediately with "done" (exercising line 595 callback)
    global.fetch = jest
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ progress: 100, status: "done" }),
      } as unknown as Response) as typeof global.fetch;

    startTransformersProgressPolling(state, mockEvents, "group-immediate");
    await Promise.resolve();
    await Promise.resolve();
    expect(state.transformersProgressPollers.has("group-immediate")).toBe(
      false,
    );

    // Case 2: Initial poll running, interval finishes with "error" (exercising line 600 callback)
    let callCount = 0;
    global.fetch = jest
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockImplementation(async () => {
        callCount++;
        return {
          ok: true,
          json: async () => ({
            progress: callCount === 1 ? 50 : 100,
            status: callCount === 1 ? "running" : "error",
          }),
        } as unknown as Response;
      }) as typeof global.fetch;

    startTransformersProgressPolling(state, mockEvents, "group-timer");
    await Promise.resolve();
    await Promise.resolve();
    expect(state.transformersProgressPollers.has("group-timer")).toBe(true);

    // Advance timer to trigger interval callback and resolve completion
    await jest.advanceTimersByTimeAsync(1000);
    expect(state.transformersProgressPollers.has("group-timer")).toBe(false);

    // Calling stop when already stopped is a no-op
    stopTransformersProgressPolling(state, "group-timer");

    jest.useRealTimers();
  });

  it("cancels llamafile request via fetch and handles failure cleanly", async () => {
    global.fetch = jest
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockResolvedValue({
        ok: true,
      } as unknown as Response) as typeof global.fetch;

    await cancelLlamafileRequest("req-cancel-1");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/cancel"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ requestId: "req-cancel-1" }),
      }),
    );

    // Fetch rejection handled cleanly
    global.fetch = jest
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockRejectedValue(new Error("Cancel failed")) as typeof global.fetch;

    await cancelLlamafileRequest("req-cancel-fail");
  });
});
