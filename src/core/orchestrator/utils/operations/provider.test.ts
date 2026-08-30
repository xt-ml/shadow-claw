import { jest } from "@jest/globals";

import {
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
  setProvider,
  pollTransformersProgress,
  startTransformersProgressPolling,
  stopTransformersProgressPolling,
  cancelLlamafileRequest,
} from "./provider.js";

import type { OrchestratorState } from "../../orchestrator-state.js";

function makeState(overrides: Partial<OrchestratorState> = {}) {
  return {
    reasoningEffort: "none",
    provider: "openrouter",
    providerConfig: {
      id: "openrouter",
      baseUrl: "http://api/chat/completions",
    } as any,
    llamafileMode: "server",
    llamafileHost: "127.0.0.1",
    llamafilePort: 8080,
    llamafileOffline: false,
    meshLlmHost: "https://public.meshllm.cloud",
    bedrockAuthMode: "provider_chain",
    bedrockProfileFallback: "default",
    bedrockRegionFallback: "us-east-1",
    transformersProgressPollers: new Map(),
    ...overrides,
  } as unknown as OrchestratorState;
}

describe("provider operations", () => {
  it("getApiKeyForHeaders and getApiKeyForRequest return correct values", async () => {
    const orchestratorWithKey: any = {
      getApiKey: jest.fn().mockResolvedValue("sk-secret-123" as never),
    };
    expect(await getApiKeyForHeaders(orchestratorWithKey)).toBe(
      "sk-secret-123",
    );
    expect(await getApiKeyForRequest(orchestratorWithKey)).toBe(
      "sk-secret-123",
    );

    const orchestratorNoKey: any = {
      getApiKey: jest.fn().mockResolvedValue(null as never),
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

  it("getAvailableProviders returns non-empty list of providers", () => {
    const providers = getAvailableProviders();
    expect(providers.length).toBeGreaterThan(0);
    expect(providers.some((p) => p.id === "openrouter")).toBe(true);
  });

  it("getReasoningConfig returns effort or undefined", () => {
    const state1 = makeState({ reasoningEffort: "high" });
    expect(getReasoningConfig(state1)).toEqual({ effort: "high" });

    const state2 = makeState({ reasoningEffort: "none" });
    expect(getReasoningConfig(state2)).toBeUndefined();

    const state3 = makeState({ reasoningEffort: "" as any });
    expect(getReasoningConfig(state3)).toBeUndefined();
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

    // Other provider
    expect(getProviderRuntimeHeaders(state, "openrouter")).toEqual({});
  });

  it("applyLlamafileHeaders and applyMeshLlmHeaders update providerConfig headers", () => {
    const llamaState = makeState({
      providerConfig: { id: "llamafile", headers: {} } as any,
    });
    applyLlamafileHeaders(llamaState);
    expect(llamaState.providerConfig?.headers?.["x-llamafile-mode"]).toBe(
      "server",
    );

    const meshState = makeState({
      providerConfig: { id: "mesh-llm", headers: {} } as any,
      meshLlmHost: "https://mesh.custom.io",
    });
    applyMeshLlmHeaders(meshState);
    expect(meshState.providerConfig?.headers?.["x-mesh-llm-host"]).toBe(
      "https://mesh.custom.io",
    );

    // Non-matching providerConfig does not throw
    const otherState = makeState({
      providerConfig: { id: "anthropic" } as any,
    });
    applyLlamafileHeaders(otherState);
    applyMeshLlmHeaders(otherState);
  });

  it("getTransformersStatusUrl computes status URL correctly", () => {
    const state1 = makeState({
      providerConfig: {
        id: "transformers_js_local",
        baseUrl: "http://api/chat/completions",
      } as any,
    });
    expect(getTransformersStatusUrl(state1)).toBe("http://api/status");

    const inFlightMap = new Map();
    inFlightMap.set("group-1", {
      providerId: "transformers_js_local",
      providerConfig: {
        id: "transformers_js_local",
        baseUrl: "http://custom-host/chat/completions",
      } as any,
    });
    const state2 = makeState({
      inFlightEffectiveProviderByGroup: inFlightMap,
    });
    expect(getTransformersStatusUrl(state2, "group-1")).toBe(
      "http://custom-host/status",
    );
  });

  it("async setters update state and call setConfig", async () => {
    const state = makeState();
    const mockSetConfig = jest.fn().mockResolvedValue(undefined as never);

    await setAssistantName(
      state,
      {} as any,
      "NewAssistant",
      mockSetConfig as any,
    );
    expect(state.assistantName).toBe("NewAssistant");
    expect(mockSetConfig).toHaveBeenCalledWith(
      {},
      "assistant_name",
      "NewAssistant",
    );

    await setBedrockSettings(
      state,
      {} as any,
      { authMode: "sso", profile: "prof1", region: "us-west-2" },
      mockSetConfig as any,
    );
    expect(state.bedrockRegionFallback).toBe("us-west-2");
    expect(state.bedrockProfileFallback).toBe("prof1");
    expect(state.bedrockAuthMode).toBe("sso");

    await setLlamafileSettings(
      state,
      {} as any,
      { host: "192.168.1.1", mode: "cli", offline: true, port: 9999 },
      mockSetConfig as any,
    );
    expect(state.llamafileMode).toBe("cli");
    expect(state.llamafileHost).toBe("192.168.1.1");
    expect(state.llamafilePort).toBe(9999);
    expect(state.llamafileOffline).toBe(true);

    await setMeshLlmSettings(
      state,
      {} as any,
      { host: "https://mesh.new.host" },
      mockSetConfig as any,
    );
    expect(state.meshLlmHost).toBe("https://mesh.new.host");

    await setModel(state, {} as any, "openrouter/free", mockSetConfig as any);
    expect(state.model).toBe("openrouter/free");

    await setPeerjsMyAlias(state, {} as any, "my-alias", mockSetConfig as any);
    expect(state.peerjsMyAlias).toBe("my-alias");

    await setPeerjsPeerAliases(
      state,
      {} as any,
      { peer1: "Alias 1" },
      mockSetConfig as any,
    );
    expect(state.peerjsPeerAliases).toEqual({ peer1: "Alias 1" });
  });

  it("setProvider switches provider, loads key, and updates config", async () => {
    const state = makeState();
    const mockSetConfig = jest.fn().mockResolvedValue(undefined as never);
    const mockLoadKey = jest.fn().mockResolvedValue(undefined as never);
    const mockGetKey = jest.fn().mockResolvedValue("key123" as never);

    await setProvider(
      state,
      {} as any,
      "openrouter",
      {
        loadApiKeyForProvider: mockLoadKey as any,
        getApiKeyForHeaders: mockGetKey as any,
      },
      mockSetConfig as any,
    );

    expect(state.provider).toBe("openrouter");
    expect(mockLoadKey).toHaveBeenCalledWith({}, "openrouter");
    expect(mockSetConfig).toHaveBeenCalledWith({}, "provider", "openrouter");
  });

  it("polls transformers progress and emits events", async () => {
    const state = makeState();
    const mockEvents: any = { emit: jest.fn() };
    const mockStopPolling = jest.fn();

    (globalThis as any).fetch = (jest.fn() as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        progress: 75,
        message: "Downloading weights...",
        status: "running",
      }),
    });

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

    // When status is 'done', stops polling
    (globalThis as any).fetch = (jest.fn() as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        progress: 100,
        status: "done",
      }),
    });

    await pollTransformersProgress(
      state,
      mockEvents,
      "group-p",
      mockStopPolling,
    );
    expect(mockStopPolling).toHaveBeenCalledWith("group-p");
  });

  it("starts and stops transformers progress polling", () => {
    jest.useFakeTimers();
    const state = makeState();
    const mockEvents: any = { emit: jest.fn() };

    startTransformersProgressPolling(state, mockEvents, "group-timer");
    expect(state.transformersProgressPollers.has("group-timer")).toBe(true);

    stopTransformersProgressPolling(state, "group-timer");
    expect(state.transformersProgressPollers.has("group-timer")).toBe(false);
    jest.useRealTimers();
  });

  it("cancels llamafile request via fetch", async () => {
    (globalThis as any).fetch = (jest.fn() as any).mockResolvedValue({
      ok: true,
    });

    await cancelLlamafileRequest("req-cancel-1");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/cancel"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ requestId: "req-cancel-1" }),
      }),
    );
  });
});
