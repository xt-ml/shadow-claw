/**
 * @jest-environment node
 */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { CONFIG_KEYS } from "../../../config/config.js";
import type { ShadowClawDatabase } from "../../../db/db.js";
import type { Orchestrator } from "../orchestrator.js";

const mockFetchModelInfo = jest
  .fn<() => Promise<void>>()
  .mockResolvedValue(undefined);
const mockGetConfig =
  jest.fn<
    (db: ShadowClawDatabase, key: string) => Promise<string | undefined>
  >();

const mockApplyLlamafileHeaders = jest.fn<(o: Orchestrator) => void>();
const mockApplyMeshLlmHeaders = jest.fn<(o: Orchestrator) => void>();
const mockGetApiKeyForHeaders = jest
  .fn<(o: Orchestrator) => Promise<string | null>>()
  .mockResolvedValue("key");
const mockGetProviderRuntimeHeaders = jest
  .fn<(o: Orchestrator, prov: string) => Record<string, string>>()
  .mockReturnValue({});

jest.unstable_mockModule("./operations/provider.js", () => ({
  applyLlamafileHeaders: mockApplyLlamafileHeaders,
  applyMeshLlmHeaders: mockApplyMeshLlmHeaders,
  getApiKeyForHeaders: mockGetApiKeyForHeaders,
  getApiKeyForRequest: jest.fn(),
  getProviderRuntimeHeaders: mockGetProviderRuntimeHeaders,
}));

jest.unstable_mockModule("./enqueue.js", () => ({
  enqueue: jest.fn(),
}));

jest.unstable_mockModule("./operations/channel.js", () => ({
  applyAllChannelRunningStates: jest.fn(),
  applyChannelRunningState: jest.fn(),
  clearPeerJsTypingState: jest.fn(),
  getChannelByType: jest.fn(),
  getChannelEnabled: jest.fn(),
  getChannelEnabledConfigKey: jest.fn(),
  getChannelTypeForGroup: jest.fn(),
  loadChannelEnabled: jest.fn(),
  setChannelEnabled: jest.fn(),
  shouldRunChannel: jest.fn(),
  submitMessage: jest.fn(),
}));

jest.unstable_mockModule("./operations/task.js", () => ({
  deleteTaskFromServer: jest.fn(),
  runTaskAsScheduled: jest.fn(),
  shouldStartLocalScheduler: jest.fn(),
  syncTaskToServer: jest.fn(),
  warnIfNoPushSubscription: jest.fn(),
}));

jest.unstable_mockModule("./operations/room.js", () => ({
  handleRoomInvite: jest.fn(),
}));

jest.unstable_mockModule("./handleWorkerMessage.js", () => ({
  handleWorkerMessage: jest.fn(),
}));

jest.unstable_mockModule("./loadChannelConfigurations.js", () => ({
  loadChannelConfigurations: jest.fn(),
}));

jest.unstable_mockModule("./setupPushTaskListener.js", () => ({
  setupPushTaskListener: jest.fn(),
}));

jest.unstable_mockModule("./syncProxyConfigToServiceWorker.js", () => ({
  syncProxyConfigToServiceWorker: jest.fn(),
}));

jest.unstable_mockModule("../../../subsystems/mcp/webmcp.js", () => ({
  setWebMcpMode: jest.fn(),
}));

jest.unstable_mockModule("../../../db/getConfig.js", () => ({
  getConfig: mockGetConfig,
}));

jest.unstable_mockModule(
  "../../../subsystems/providers/model-registry.js",
  () => ({
    modelRegistry: {
      fetchModelInfo: mockFetchModelInfo,
    },
  }),
);

const { initProviderAndModel } = await import("./initTasks.js");

describe("initTasks in node environment", () => {
  let mockDb: ShadowClawDatabase;
  let mockOrchestrator: {
    provider: string;
    model: string;
    maxTokens: number;
    maxIterations: number;
    providerConfig: { defaultModel: string };
    loadApiKeyForProvider: jest.Mock;
    bedrockRegionFallback?: string;
    bedrockProfileFallback?: string;
    bedrockAuthMode?: string;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = {} as unknown as ShadowClawDatabase;
    mockOrchestrator = {
      provider: "openrouter",
      model: "openai/gpt-4o",
      maxTokens: 2048,
      maxIterations: 10,
      providerConfig: { defaultModel: "openai/gpt-4o" },
      loadApiKeyForProvider: jest
        .fn<() => Promise<void>>()
        .mockResolvedValue(undefined),
    };
    mockGetConfig.mockImplementation(async (_db, key) => {
      if (key === CONFIG_KEYS.PROVIDER) return "openrouter";
      return undefined;
    });
  });

  it("should trigger scheduleFetch in node environment where window and document are undefined", async () => {
    jest.useFakeTimers();
    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");

    await initProviderAndModel(
      mockOrchestrator as unknown as Orchestrator,
      mockDb,
    );
    jest.advanceTimersByTime(2500);
    await Promise.resolve();
    expect(mockFetchModelInfo).toHaveBeenCalled();
    jest.useRealTimers();
  });
});
