import { jest } from "@jest/globals";

import { CONFIG_KEYS, getModelMaxTokens } from "../../../config/config.js";

import {
  setContextCompressionEnabled,
  setGitProxyUrl,
  setMaxIterations,
  setMaxTokens,
  setProxyUrl,
  setRateLimitAutoAdapt,
  setRateLimitCallsPerMinute,
  setReasoningEffort,
  setStreamingEnabled,
  setTaskServerUrl,
  setUseProxy,
  setVMBashFullInternetAccess,
  setVMBashTimeout,
} from "./settings.js";

import type { OrchestratorState } from "../orchestrator-state.js";

// Minimal mock that satisfies the setConfig dependency.
function mockSetConfig() {
  const calls: Array<{ key: string; value: string }> = [];

  return {
    calls,
    mockFn: jest.fn(async (_db: any, key: string, value: string) => {
      calls.push({ key, value });
    }),
  };
}

// A bare-bones state object with only the fields each test needs.
function makeState(overrides: Partial<OrchestratorState> = {}) {
  return {
    contextCompressionEnabled: false,
    gitProxyUrl: "/git-proxy",
    maxIterations: 25,
    maxTokens: 4096,
    model: "test-model",
    proxyUrl: "/proxy",
    rateLimitAutoAdapt: true,
    rateLimitCallsPerMinute: 0,
    reasoningEffort: "none",
    streamingEnabled: true,
    taskServerUrl: "/schedule",
    useProxy: false,
    vmBashFullInternetAccess: false,
    ...overrides,
  } as unknown as OrchestratorState;
}

describe("settings (functional utilities)", () => {
  describe("setContextCompressionEnabled", () => {
    it("normalizes truthy values and persists to db", async () => {
      const state = makeState();
      const { calls, mockFn } = mockSetConfig();
      const db = {} as any;

      await setContextCompressionEnabled(state, db, true, mockFn);

      expect(state.contextCompressionEnabled).toBe(true);
      expect(calls).toEqual([
        { key: CONFIG_KEYS.CONTEXT_COMPRESSION_ENABLED, value: "true" },
      ]);
    });

    it("normalizes falsy values", async () => {
      const state = makeState({ contextCompressionEnabled: true });
      const { mockFn } = mockSetConfig();

      await setContextCompressionEnabled(state, {} as any, 0 as any, mockFn);

      expect(state.contextCompressionEnabled).toBe(false);
    });
  });

  describe("setGitProxyUrl", () => {
    it("defaults to /git-proxy when empty", async () => {
      const state = makeState();
      const { calls, mockFn } = mockSetConfig();

      await setGitProxyUrl(state, {} as any, "", mockFn);

      expect(state.gitProxyUrl).toBe("/git-proxy");
      expect(calls[0].value).toBe("/git-proxy");
    });

    it("stores the provided url", async () => {
      const state = makeState();
      const { calls, mockFn } = mockSetConfig();

      await setGitProxyUrl(state, {} as any, "/custom-git", mockFn);

      expect(state.gitProxyUrl).toBe("/custom-git");
      expect(calls[0].value).toBe("/custom-git");
    });
  });

  describe("setMaxIterations", () => {
    it("stores value on state and in db", async () => {
      const state = makeState();
      const { calls, mockFn } = mockSetConfig();

      await setMaxIterations(state, {} as any, 50, mockFn);

      expect(state.maxIterations).toBe(50);
      expect(calls[0]).toEqual({
        key: CONFIG_KEYS.MAX_ITERATIONS,
        value: "50",
      });
    });
  });

  describe("setMaxTokens", () => {
    it("clamps to model maximum", async () => {
      const state = makeState({ model: "test-model" });
      const { mockFn } = mockSetConfig();
      const modelMax = getModelMaxTokens("test-model");

      await setMaxTokens(state, {} as any, 999999, mockFn);

      expect(state.maxTokens).toBeLessThanOrEqual(modelMax);
      expect(state.maxTokens).toBeGreaterThanOrEqual(1);
    });

    it("clamps below 1 to 1", async () => {
      const state = makeState();
      const { mockFn } = mockSetConfig();

      await setMaxTokens(state, {} as any, -10, mockFn);

      expect(state.maxTokens).toBe(1);
    });
  });

  describe("setProxyUrl", () => {
    it("defaults to /proxy when empty", async () => {
      const state = makeState();
      const { calls, mockFn } = mockSetConfig();

      await setProxyUrl(state, {} as any, "", mockFn);

      expect(state.proxyUrl).toBe("/proxy");
      expect(calls[0].value).toBe("/proxy");
    });
  });

  describe("setRateLimitAutoAdapt", () => {
    it("normalizes and persists boolean", async () => {
      const state = makeState({ rateLimitAutoAdapt: true });
      const { calls, mockFn } = mockSetConfig();

      await setRateLimitAutoAdapt(state, {} as any, false, mockFn);

      expect(state.rateLimitAutoAdapt).toBe(false);
      expect(calls[0].value).toBe("false");
    });
  });

  describe("setRateLimitCallsPerMinute", () => {
    it("normalizes to a non-negative integer", async () => {
      const state = makeState();
      const { calls, mockFn } = mockSetConfig();

      await setRateLimitCallsPerMinute(state, {} as any, 3.7, mockFn);

      expect(state.rateLimitCallsPerMinute).toBe(3);
      expect(calls[0].value).toBe("3");
    });

    it("normalizes NaN to 0", async () => {
      const state = makeState();
      const { mockFn } = mockSetConfig();

      await setRateLimitCallsPerMinute(state, {} as any, NaN, mockFn);

      expect(state.rateLimitCallsPerMinute).toBe(0);
    });

    it("normalizes negative to 0", async () => {
      const state = makeState();
      const { mockFn } = mockSetConfig();

      await setRateLimitCallsPerMinute(state, {} as any, -5, mockFn);

      expect(state.rateLimitCallsPerMinute).toBe(0);
    });
  });

  describe("setReasoningEffort", () => {
    it("normalizes and lowercases effort string", async () => {
      const state = makeState();
      const { calls, mockFn } = mockSetConfig();

      await setReasoningEffort(state, {} as any, "  HIGH  ", mockFn);

      expect(state.reasoningEffort).toBe("high");
      expect(calls[0].value).toBe("high");
    });

    it("defaults to 'none' for empty input", async () => {
      const state = makeState();
      const { mockFn } = mockSetConfig();

      await setReasoningEffort(state, {} as any, "", mockFn);

      expect(state.reasoningEffort).toBe("none");
    });

    it("defaults to 'none' for non-string input", async () => {
      const state = makeState();
      const { mockFn } = mockSetConfig();

      await setReasoningEffort(state, {} as any, 42 as any, mockFn);

      expect(state.reasoningEffort).toBe("none");
    });
  });

  describe("setStreamingEnabled", () => {
    it("normalizes truthy and persists", async () => {
      const state = makeState({ streamingEnabled: false });
      const { calls, mockFn } = mockSetConfig();

      await setStreamingEnabled(state, {} as any, true, mockFn);

      expect(state.streamingEnabled).toBe(true);
      expect(calls[0].value).toBe("true");
    });
  });

  describe("setTaskServerUrl", () => {
    it("defaults to /schedule when empty", async () => {
      const state = makeState();
      const { calls, mockFn } = mockSetConfig();

      await setTaskServerUrl(state, {} as any, "", mockFn);

      expect(state.taskServerUrl).toBe("/schedule");
      expect(calls[0].value).toBe("/schedule");
    });
  });

  describe("setUseProxy", () => {
    it("normalizes and persists boolean", async () => {
      const state = makeState();
      const { calls, mockFn } = mockSetConfig();

      await setUseProxy(state, {} as any, true, mockFn);

      expect(state.useProxy).toBe(true);
      expect(calls[0].value).toBe("true");
    });
  });

  describe("setVMBashFullInternetAccess", () => {
    it("normalizes and persists boolean", async () => {
      const state = makeState();
      const { calls, mockFn } = mockSetConfig();

      await setVMBashFullInternetAccess(state, {} as any, true, mockFn);

      expect(state.vmBashFullInternetAccess).toBe(true);
      expect(calls[0].value).toBe("true");
    });
  });

  describe("setVMBashTimeout", () => {
    it("clamps to [1, 1800]", async () => {
      const { calls, mockFn } = mockSetConfig();
      const state = makeState();

      await setVMBashTimeout(state, {} as any, 0, mockFn);
      expect(calls[0].value).toBe("1");

      await setVMBashTimeout(state, {} as any, 99999, mockFn);
      expect(calls[1].value).toBe("1800");

      await setVMBashTimeout(state, {} as any, 120, mockFn);
      expect(calls[2].value).toBe("120");
    });

    it("floors fractional seconds", async () => {
      const state = makeState();
      const { calls, mockFn } = mockSetConfig();

      await setVMBashTimeout(state, {} as any, 45.9, mockFn);

      expect(calls[0].value).toBe("45");
    });
  });
});
