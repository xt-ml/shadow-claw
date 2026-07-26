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
      providerConfig: { baseUrl: "http://api/chat/completions" } as any,
    });
    expect(getTransformersStatusUrl(state1)).toBe("http://api/status");

    const state2 = makeState({
      providerConfig: { baseUrl: "http://other" } as any,
    });
    expect(getTransformersStatusUrl(state2)).toBe(
      "http://localhost:8888/transformers-js-proxy/status",
    );
  });
});
