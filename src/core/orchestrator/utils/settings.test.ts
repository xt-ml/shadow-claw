import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  CONFIG_KEYS,
  DEFAULT_TASK_SERVER_URL,
} from "../../../config/config.js";
import type { ShadowClawDatabase } from "../../../db/db.js";
import type { OrchestratorState } from "../orchestrator-state.js";

const mockDefaultSetConfig =
  jest.fn<
    (_db: ShadowClawDatabase, _key: string, _value: string) => Promise<void>
  >();
const mockSyncProxyConfigToServiceWorker =
  jest.fn<(_state: OrchestratorState) => void>();

jest.unstable_mockModule("../../../db/setConfig.js", () => ({
  setConfig: mockDefaultSetConfig,
}));

jest.unstable_mockModule("./syncProxyConfigToServiceWorker.js", () => ({
  syncProxyConfigToServiceWorker: mockSyncProxyConfigToServiceWorker,
}));

const {
  setContextCompressionEnabled,
  setGitProxyUrl,
  setMaxIterations,
  setMaxTokens,
  setProxyUrl,
  setRateLimitAutoAdapt,
  setRateLimitCallsPerMinute,
  setReasoningEffort,
  setStreamingEnabled,
  setTaskServerEnabled,
  setTaskServerUrl,
  setUseProxy,
  setVMBashFullInternetAccess,
  setVMBashTimeout,
} = await import("./settings.js");

function mockCustomSetConfig() {
  const calls: Array<{ key: string; value: string }> = [];
  const mockFn = jest.fn(
    async (_db: ShadowClawDatabase, key: string, value: string) => {
      calls.push({ key, value });
    },
  );
  return { calls, mockFn };
}

function makeState(
  overrides: Partial<OrchestratorState> = {},
): OrchestratorState {
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
    taskServerEnabled: false,
    taskServerUrl: DEFAULT_TASK_SERVER_URL,
    useProxy: false,
    vmBashFullInternetAccess: false,
    ...overrides,
  } as unknown as OrchestratorState;
}

describe("settings (functional utilities)", () => {
  const mockDb = {} as ShadowClawDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDefaultSetConfig.mockResolvedValue(undefined);
  });

  describe("setContextCompressionEnabled", () => {
    it("normalizes truthy values and persists to db with custom setConfig", async () => {
      const state = makeState();
      const { calls, mockFn } = mockCustomSetConfig();

      await setContextCompressionEnabled(state, mockDb, true, mockFn);

      expect(state.contextCompressionEnabled).toBe(true);
      expect(calls).toEqual([
        { key: CONFIG_KEYS.CONTEXT_COMPRESSION_ENABLED, value: "true" },
      ]);
    });

    it("normalizes falsy values and persists with default setConfig", async () => {
      const state = makeState({ contextCompressionEnabled: true });

      await setContextCompressionEnabled(state, mockDb, false);

      expect(state.contextCompressionEnabled).toBe(false);
      expect(mockDefaultSetConfig).toHaveBeenCalledWith(
        mockDb,
        CONFIG_KEYS.CONTEXT_COMPRESSION_ENABLED,
        "false",
      );
    });
  });

  describe("setGitProxyUrl", () => {
    it("defaults to /git-proxy when empty", async () => {
      const state = makeState();
      const { calls, mockFn } = mockCustomSetConfig();

      await setGitProxyUrl(state, mockDb, "", mockFn);

      expect(state.gitProxyUrl).toBe("/git-proxy");
      expect(calls[0].value).toBe("/git-proxy");
    });

    it("stores the provided url using default setConfig", async () => {
      const state = makeState();

      await setGitProxyUrl(state, mockDb, "/custom-git");

      expect(state.gitProxyUrl).toBe("/custom-git");
      expect(mockDefaultSetConfig).toHaveBeenCalledWith(
        mockDb,
        CONFIG_KEYS.GIT_PROXY_URL,
        "/custom-git",
      );
    });
  });

  describe("setMaxIterations", () => {
    it("stores value on state and in db with custom setConfig", async () => {
      const state = makeState();
      const { calls, mockFn } = mockCustomSetConfig();

      await setMaxIterations(state, mockDb, 50, mockFn);

      expect(state.maxIterations).toBe(50);
      expect(calls[0]).toEqual({
        key: CONFIG_KEYS.MAX_ITERATIONS,
        value: "50",
      });
    });

    it("stores value using default setConfig", async () => {
      const state = makeState();

      await setMaxIterations(state, mockDb, 10);

      expect(state.maxIterations).toBe(10);
      expect(mockDefaultSetConfig).toHaveBeenCalledWith(
        mockDb,
        CONFIG_KEYS.MAX_ITERATIONS,
        "10",
      );
    });
  });

  describe("setMaxTokens", () => {
    it("stores large values without clamping to model maximum", async () => {
      const state = makeState({ model: "test-model" });
      const { calls, mockFn } = mockCustomSetConfig();

      await setMaxTokens(state, mockDb, 999999, mockFn);

      expect(state.maxTokens).toBe(999999);
      expect(calls[0]).toEqual({
        key: CONFIG_KEYS.MAX_TOKENS,
        value: "999999",
      });
    });

    it("clamps below 1 to 1 and uses default setConfig", async () => {
      const state = makeState();

      await setMaxTokens(state, mockDb, -10);

      expect(state.maxTokens).toBe(1);
      expect(mockDefaultSetConfig).toHaveBeenCalledWith(
        mockDb,
        CONFIG_KEYS.MAX_TOKENS,
        "1",
      );
    });
  });

  describe("setProxyUrl", () => {
    it("defaults to /proxy when empty", async () => {
      const state = makeState();
      const { calls, mockFn } = mockCustomSetConfig();

      await setProxyUrl(state, mockDb, "", mockFn);

      expect(state.proxyUrl).toBe("/proxy");
      expect(calls[0].value).toBe("/proxy");
      expect(mockSyncProxyConfigToServiceWorker).toHaveBeenCalledWith(state);
    });

    it("stores the custom url and uses default setConfig", async () => {
      const state = makeState();

      await setProxyUrl(state, mockDb, "http://localhost:8080/proxy");

      expect(state.proxyUrl).toBe("http://localhost:8080/proxy");
      expect(mockDefaultSetConfig).toHaveBeenCalledWith(
        mockDb,
        CONFIG_KEYS.PROXY_URL,
        "http://localhost:8080/proxy",
      );
      expect(mockSyncProxyConfigToServiceWorker).toHaveBeenCalledWith(state);
    });
  });

  describe("setRateLimitAutoAdapt", () => {
    it("normalizes and persists boolean with custom setConfig", async () => {
      const state = makeState({ rateLimitAutoAdapt: true });
      const { calls, mockFn } = mockCustomSetConfig();

      await setRateLimitAutoAdapt(state, mockDb, false, mockFn);

      expect(state.rateLimitAutoAdapt).toBe(false);
      expect(calls[0].value).toBe("false");
    });

    it("normalizes and persists boolean with default setConfig", async () => {
      const state = makeState({ rateLimitAutoAdapt: false });

      await setRateLimitAutoAdapt(state, mockDb, true);

      expect(state.rateLimitAutoAdapt).toBe(true);
      expect(mockDefaultSetConfig).toHaveBeenCalledWith(
        mockDb,
        CONFIG_KEYS.RATE_LIMIT_AUTO_ADAPT,
        "true",
      );
    });
  });

  describe("setRateLimitCallsPerMinute", () => {
    it("normalizes to a non-negative integer", async () => {
      const state = makeState();
      const { calls, mockFn } = mockCustomSetConfig();

      await setRateLimitCallsPerMinute(state, mockDb, 3.7, mockFn);

      expect(state.rateLimitCallsPerMinute).toBe(3);
      expect(calls[0].value).toBe("3");
    });

    it("normalizes NaN to 0 and uses default setConfig", async () => {
      const state = makeState();

      await setRateLimitCallsPerMinute(state, mockDb, NaN);

      expect(state.rateLimitCallsPerMinute).toBe(0);
      expect(mockDefaultSetConfig).toHaveBeenCalledWith(
        mockDb,
        CONFIG_KEYS.RATE_LIMIT_CALLS_PER_MINUTE,
        "0",
      );
    });

    it("normalizes negative to 0", async () => {
      const state = makeState();
      const { mockFn } = mockCustomSetConfig();

      await setRateLimitCallsPerMinute(state, mockDb, -5, mockFn);

      expect(state.rateLimitCallsPerMinute).toBe(0);
    });
  });

  describe("setReasoningEffort", () => {
    it("normalizes and lowercases effort string", async () => {
      const state = makeState();
      const { calls, mockFn } = mockCustomSetConfig();

      await setReasoningEffort(state, mockDb, "  HIGH  ", mockFn);

      expect(state.reasoningEffort).toBe("high");
      expect(calls[0].value).toBe("high");
    });

    it("defaults to 'none' for empty input with default setConfig", async () => {
      const state = makeState();

      await setReasoningEffort(state, mockDb, "");

      expect(state.reasoningEffort).toBe("none");
      expect(mockDefaultSetConfig).toHaveBeenCalledWith(
        mockDb,
        CONFIG_KEYS.REASONING_EFFORT,
        "none",
      );
    });

    it("defaults to 'none' for non-string input", async () => {
      const state = makeState();
      const { mockFn } = mockCustomSetConfig();

      await setReasoningEffort(state, mockDb, 42 as unknown as string, mockFn);

      expect(state.reasoningEffort).toBe("none");
    });
  });

  describe("setStreamingEnabled", () => {
    it("normalizes truthy and persists with custom setConfig", async () => {
      const state = makeState({ streamingEnabled: false });
      const { calls, mockFn } = mockCustomSetConfig();

      await setStreamingEnabled(state, mockDb, true, mockFn);

      expect(state.streamingEnabled).toBe(true);
      expect(calls[0].value).toBe("true");
    });

    it("normalizes falsy and persists with default setConfig", async () => {
      const state = makeState({ streamingEnabled: true });

      await setStreamingEnabled(state, mockDb, false);

      expect(state.streamingEnabled).toBe(false);
      expect(mockDefaultSetConfig).toHaveBeenCalledWith(
        mockDb,
        CONFIG_KEYS.STREAMING_ENABLED,
        "false",
      );
    });
  });

  describe("setTaskServerEnabled", () => {
    it("normalizes truthy values and persists with custom setConfig", async () => {
      const state = makeState({ taskServerEnabled: false });
      const { calls, mockFn } = mockCustomSetConfig();

      await setTaskServerEnabled(state, mockDb, true, mockFn);

      expect(state.taskServerEnabled).toBe(true);
      expect(calls).toEqual([
        { key: CONFIG_KEYS.TASK_SERVER_ENABLED, value: "true" },
      ]);
    });

    it("normalizes falsy values and persists with default setConfig", async () => {
      const state = makeState({ taskServerEnabled: true });

      await setTaskServerEnabled(state, mockDb, false);

      expect(state.taskServerEnabled).toBe(false);
      expect(mockDefaultSetConfig).toHaveBeenCalledWith(
        mockDb,
        CONFIG_KEYS.TASK_SERVER_ENABLED,
        "false",
      );
    });
  });

  describe("setTaskServerUrl", () => {
    it("defaults to config default when empty with custom setConfig", async () => {
      const state = makeState();
      const { calls, mockFn } = mockCustomSetConfig();

      await setTaskServerUrl(state, mockDb, "", mockFn);

      expect(state.taskServerUrl).toBe(DEFAULT_TASK_SERVER_URL);
      expect(calls[0].value).toBe(DEFAULT_TASK_SERVER_URL);
    });

    it("persists provided url with default setConfig", async () => {
      const state = makeState();

      await setTaskServerUrl(state, mockDb, "http://tasks.lan:9999");

      expect(state.taskServerUrl).toBe("http://tasks.lan:9999");
      expect(mockDefaultSetConfig).toHaveBeenCalledWith(
        mockDb,
        CONFIG_KEYS.TASK_SERVER_URL,
        "http://tasks.lan:9999",
      );
    });
  });

  describe("setUseProxy", () => {
    it("normalizes and persists boolean with custom setConfig", async () => {
      const state = makeState();
      const { calls, mockFn } = mockCustomSetConfig();

      await setUseProxy(state, mockDb, true, mockFn);

      expect(state.useProxy).toBe(true);
      expect(calls[0].value).toBe("true");
      expect(mockSyncProxyConfigToServiceWorker).toHaveBeenCalledWith(state);
    });

    it("normalizes and persists false with default setConfig", async () => {
      const state = makeState({ useProxy: true });

      await setUseProxy(state, mockDb, false);

      expect(state.useProxy).toBe(false);
      expect(mockDefaultSetConfig).toHaveBeenCalledWith(
        mockDb,
        CONFIG_KEYS.USE_PROXY,
        "false",
      );
      expect(mockSyncProxyConfigToServiceWorker).toHaveBeenCalledWith(state);
    });
  });

  describe("setVMBashFullInternetAccess", () => {
    it("normalizes and persists boolean with custom setConfig", async () => {
      const state = makeState();
      const { calls, mockFn } = mockCustomSetConfig();

      await setVMBashFullInternetAccess(state, mockDb, true, mockFn);

      expect(state.vmBashFullInternetAccess).toBe(true);
      expect(calls[0].value).toBe("true");
    });

    it("normalizes and persists false with default setConfig", async () => {
      const state = makeState({ vmBashFullInternetAccess: true });

      await setVMBashFullInternetAccess(state, mockDb, false);

      expect(state.vmBashFullInternetAccess).toBe(false);
      expect(mockDefaultSetConfig).toHaveBeenCalledWith(
        mockDb,
        CONFIG_KEYS.VM_BASH_FULL_INTERNET_ACCESS,
        "false",
      );
    });
  });

  describe("setVMBashTimeout", () => {
    it("clamps to [1, 1800] with custom setConfig", async () => {
      const { calls, mockFn } = mockCustomSetConfig();
      const state = makeState();

      await setVMBashTimeout(state, mockDb, 0, mockFn);
      expect(calls[0].value).toBe("1");

      await setVMBashTimeout(state, mockDb, 99999, mockFn);
      expect(calls[1].value).toBe("1800");

      await setVMBashTimeout(state, mockDb, 120, mockFn);
      expect(calls[2].value).toBe("120");
    });

    it("floors fractional seconds and persists with default setConfig", async () => {
      const state = makeState();

      await setVMBashTimeout(state, mockDb, 45.9);

      expect(mockDefaultSetConfig).toHaveBeenCalledWith(
        mockDb,
        CONFIG_KEYS.VM_BASH_TIMEOUT_SEC,
        "45",
      );
    });
  });
});
