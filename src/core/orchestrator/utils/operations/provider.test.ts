import { getReasoningConfig, getTransformersStatusUrl } from "./provider.js";

import type { OrchestratorState } from "../../orchestrator-state.js";

function makeState(overrides: Partial<OrchestratorState> = {}) {
  return {
    reasoningEffort: "none",
    providerConfig: { baseUrl: "http://api/chat/completions" } as any,
    ...overrides,
  } as unknown as OrchestratorState;
}

describe("provider configuration", () => {
  it("getReasoningConfig returns correctly", () => {
    const state1 = makeState({ reasoningEffort: "high" });
    expect(getReasoningConfig(state1)).toEqual({ effort: "high" });

    const state2 = makeState({ reasoningEffort: "none" });
    expect(getReasoningConfig(state2)).toBeUndefined();
  });

  it("getTransformersStatusUrl computes correctly", () => {
    const state1 = makeState({
      providerConfig: {
        id: "transformers_js_local",
        baseUrl: "http://api/chat/completions",
      } as any,
    });
    expect(getTransformersStatusUrl(state1)).toBe("http://api/status");

    const state2 = makeState({
      providerConfig: {
        id: "transformers_js_local",
        baseUrl: "http://other",
      } as any,
    });
    expect(getTransformersStatusUrl(state2)).toBe(
      "http://localhost:8888/transformers-js-proxy/status",
    );
  });

  it("getTransformersStatusUrl ignores remote provider like openrouter and falls back to transformers_js_local", () => {
    const state = makeState({
      providerConfig: {
        id: "openrouter",
        baseUrl: "https://openrouter.ai/api/v1/chat/completions",
      } as any,
    });
    expect(getTransformersStatusUrl(state)).toBe(
      "http://localhost:8888/transformers-js-proxy/status",
    );
  });

  it("getTransformersStatusUrl uses inFlightEffectiveProviderByGroup if present", () => {
    const inFlightMap = new Map();
    inFlightMap.set("group-123", {
      providerId: "transformers_js_local",
      providerConfig: {
        id: "transformers_js_local",
        baseUrl: "http://custom-local-host/chat/completions",
      } as any,
    });
    const state = makeState({
      providerConfig: {
        id: "openrouter",
        baseUrl: "https://openrouter.ai/api/v1/chat/completions",
      } as any,
      inFlightEffectiveProviderByGroup: inFlightMap,
    });
    expect(getTransformersStatusUrl(state, "group-123")).toBe(
      "http://custom-local-host/status",
    );
  });
});
