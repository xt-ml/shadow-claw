import { jest } from "@jest/globals";

const mockDeleteTask = jest.fn() as any;
const mockGetAllTasks = jest.fn() as any;
const mockGetRecentMessages = jest.fn() as any;
const mockSaveTask = jest.fn() as any;
const mockListGroupFiles = jest.fn() as any;
const mockRequestStorageAccess = jest.fn() as any;
const mockGetStorageStatus = jest.fn() as any;
const mockListGroups = jest.fn() as any;
const mockCreateGroup = jest.fn() as any;
const mockRenameGroup = jest.fn() as any;
const mockDeleteGroupMetadata = jest.fn() as any;
const mockReorderGroups = jest.fn() as any;
const mockCloneGroup = jest.fn() as any;
const mockClearGroupMessages = jest.fn() as any;
const mockCloneGroupMessages = jest.fn() as any;
const mockCloneGroupTasks = jest.fn() as any;
const mockGetConfig = jest.fn() as any;
const mockSetConfig = jest.fn() as any;
const mockReadGroupFile = jest.fn() as any;
const mockWriteGroupFile = jest.fn() as any;
const mockEnsureMainGroupMemory = jest.fn() as any;
const mockIsMainGroupMemorySuppressed = jest.fn() as any;
const mockSetMainGroupMemorySuppressed = jest.fn() as any;
const mockEnsureMainGroupIndex = jest.fn() as any;
const mockSeedStaticMainSite = jest.fn() as any;
const mockIsStaticMainSiteSeeded = jest.fn() as any;
const mockSetStaticMainSiteSeeded = jest.fn() as any;
const mockGetStaticMainManifest = jest.fn() as any;
const mockCopyGroupDirectory = jest.fn() as any;
const mockDeleteMessage = jest.fn() as any;

jest.unstable_mockModule(
  "../core/orchestrator/utils/operations/provider.js",
  () => ({
    applyLlamafileHeaders: jest.fn(),
    applyMeshLlmHeaders: jest.fn(),
    autoActivateProfile: jest.fn(),
    stopTransformersProgressPolling: jest.fn(),
    getAvailableProviders: jest.fn(),
    getProviderRuntimeHeaders: jest.fn(),
    getReasoningConfig: jest.fn(),
    getTransformersStatusUrl: jest.fn(),
    setAssistantName: jest.fn(),
    setBedrockSettings: jest.fn(),
    setLlamafileSettings: jest.fn(),
    setMeshLlmSettings: jest.fn(),
    setModel: jest.fn(),
    setPeerjsMyAlias: jest.fn(),
    setPeerjsPeerAliases: jest.fn(),
    setProvider: jest.fn(),
    getApiKeyForHeaders: jest.fn(),
    getApiKeyForRequest: jest.fn(),
    getLlamafileSettings: jest.fn(),
    getMeshLlmSettings: jest.fn(),
    getBedrockSettings: jest.fn(),
  }),
);

jest.unstable_mockModule(
  "../core/orchestrator/utils/operations/channel.js",
  () => ({
    applyAllChannelRunningStates: jest.fn(),
    applyChannelRunningState: jest.fn(),
    clearPeerJsTypingState: jest.fn(),
    getChannelByType: jest.fn(),
    getChannelEnabled: jest.fn(),
    getChannelEnabledConfigKey: jest.fn(),
    loadChannelEnabled: jest.fn(),
    setChannelEnabled: jest.fn(),
    shouldRunChannel: jest.fn(),
    getChannelTypeForGroup: jest.fn(),
  }),
);

jest.unstable_mockModule(
  "../core/orchestrator/utils/operations/provider.js",
  () => ({
    applyLlamafileHeaders: jest.fn(),
    applyMeshLlmHeaders: jest.fn(),
    autoActivateProfile: jest.fn(),
    stopTransformersProgressPolling: jest.fn(),
    getAvailableProviders: jest.fn(),
    getProviderRuntimeHeaders: jest.fn(),
    getReasoningConfig: jest.fn(),
    getTransformersStatusUrl: jest.fn(),
    setAssistantName: jest.fn(),
    setBedrockSettings: jest.fn(),
    setLlamafileSettings: jest.fn(),
    setMeshLlmSettings: jest.fn(),
    setModel: jest.fn(),
    setPeerjsMyAlias: jest.fn(),
    setPeerjsPeerAliases: jest.fn(),
    setProvider: jest.fn(),
    getApiKeyForHeaders: jest.fn(),
    getApiKeyForRequest: jest.fn(),
    getLlamafileSettings: jest.fn(),
    getMeshLlmSettings: jest.fn(),
    getBedrockSettings: jest.fn(),
  }),
);

jest.unstable_mockModule(
  "../core/orchestrator/utils/operations/channel.js",
  () => ({
    applyAllChannelRunningStates: jest.fn(),
    applyChannelRunningState: jest.fn(),
    clearPeerJsTypingState: jest.fn(),
    getChannelByType: jest.fn(),
    getChannelEnabled: jest.fn(),
    getChannelEnabledConfigKey: jest.fn(),
    loadChannelEnabled: jest.fn(),
    setChannelEnabled: jest.fn(),
    shouldRunChannel: jest.fn(),
    getChannelTypeForGroup: jest.fn(),
  }),
);

const mockSyncTerminalWorkspace = jest.fn();
const mockFlushTerminalWorkspace = jest.fn();

jest.unstable_mockModule("../core/orchestrator/utils/operations/vm.js", () => ({
  answerUserPrompt: jest.fn(),
  closeTerminalSession: jest.fn(),
  flushTerminalWorkspace: mockFlushTerminalWorkspace,
  openTerminalSession: jest.fn(),
  sendTerminalInput: jest.fn(),
  setVMBootHost: jest.fn(),
  setVMBootMode: jest.fn(),
  setVMNetworkRelayURL: jest.fn(),
  syncTerminalWorkspace: mockSyncTerminalWorkspace,
}));

jest.unstable_mockModule("../db/deleteTask.js", () => ({
  deleteTask: mockDeleteTask,
}));

jest.unstable_mockModule("../db/getAllTasks.js", () => ({
  getAllTasks: mockGetAllTasks,
}));

jest.unstable_mockModule("../db/getRecentMessages.js", () => ({
  getRecentMessages: mockGetRecentMessages,
}));

jest.unstable_mockModule("../db/saveTask.js", () => ({
  saveTask: mockSaveTask,
}));

jest.unstable_mockModule("../storage/listGroupFiles.js", () => ({
  listGroupFiles: mockListGroupFiles,
}));

jest.unstable_mockModule("../storage/requestStorageAccess.js", () => ({
  requestStorageAccess: mockRequestStorageAccess,
}));

const mockSaveGroupMetadata = jest.fn() as any;
const mockUpdateGroupToolTags = jest.fn() as any;
const mockUpdateGroupProviderRuntimeOverrides = jest.fn() as any;
const mockUpdateGroupSubagentSettings = jest.fn() as any;

jest.unstable_mockModule("../storage/storage.js", () => ({
  getOpfsRootDirName: jest.fn(() => "shadowclaw"),
  getStorageStatus: mockGetStorageStatus,
  getStorageRoot: jest.fn(),
  clearStorageRootCache: jest.fn(),
  invalidateStorageRoot: jest.fn(),
  initializeStorage: jest.fn(),
  isStaleHandleError: jest.fn(),
}));

jest.unstable_mockModule("../ui/toast.js", () => ({
  showError: jest.fn(),
  showSuccess: jest.fn(),
  showWarning: jest.fn(),
  showInfo: jest.fn(),
  showToast: jest.fn(),
}));

jest.unstable_mockModule("../db/groups.js", () => ({
  listGroups: mockListGroups,
  createGroup: mockCreateGroup,
  renameGroup: mockRenameGroup,
  deleteGroupMetadata: mockDeleteGroupMetadata,
  reorderGroups: mockReorderGroups,
  cloneGroup: mockCloneGroup,
  saveGroupMetadata: mockSaveGroupMetadata,
  getGroupMetadata: jest.fn(),
  updateGroupToolTags: mockUpdateGroupToolTags,
  updateGroupPinnedProvider: jest.fn(),
  updateGroupSubagentSettings: mockUpdateGroupSubagentSettings,
  updateGroupProviderRuntimeOverrides: mockUpdateGroupProviderRuntimeOverrides,
}));

jest.unstable_mockModule("../db/clearGroupMessages.js", () => ({
  clearGroupMessages: mockClearGroupMessages,
}));

jest.unstable_mockModule("../db/cloneGroupMessages.js", () => ({
  cloneGroupMessages: mockCloneGroupMessages,
}));

jest.unstable_mockModule("../db/cloneGroupTasks.js", () => ({
  cloneGroupTasks: mockCloneGroupTasks,
}));

jest.unstable_mockModule("../db/getConfig.js", () => ({
  getConfig: mockGetConfig,
}));

jest.unstable_mockModule("../db/setConfig.js", () => ({
  setConfig: mockSetConfig,
}));

jest.unstable_mockModule("../storage/readGroupFile.js", () => ({
  readGroupFile: mockReadGroupFile,
}));

jest.unstable_mockModule("../storage/writeGroupFile.js", () => ({
  writeGroupFile: mockWriteGroupFile,
}));

jest.unstable_mockModule("../storage/ensureMainGroupMemory.js", () => ({
  ensureMainGroupMemory: mockEnsureMainGroupMemory,
  DEFAULT_MAIN_GROUP_MEMORY_PATH: "MEMORY.md",
  isMainGroupMemorySuppressed: mockIsMainGroupMemorySuppressed,
  setMainGroupMemorySuppressed: mockSetMainGroupMemorySuppressed,
}));

jest.unstable_mockModule("../storage/ensureMainGroupIndex.js", () => ({
  ensureMainGroupIndex: mockEnsureMainGroupIndex,
  setMainGroupIndexSuppressed: jest.fn(),
}));

jest.unstable_mockModule("../storage/staticMainSite.js", () => ({
  seedStaticMainSite: mockSeedStaticMainSite,
  isStaticMainSiteSeeded: mockIsStaticMainSiteSeeded,
  setStaticMainSiteSeeded: mockSetStaticMainSiteSeeded,
  getStaticMainManifest: mockGetStaticMainManifest,
  sortSavedPageRefs: (refs: any[]) => refs,
}));

jest.unstable_mockModule("../storage/copyGroupDirectory.js", () => ({
  copyGroupDirectory: mockCopyGroupDirectory,
}));

jest.unstable_mockModule("../db/deleteMessage.js", () => ({
  deleteMessage: mockDeleteMessage,
}));

const mockReorderTasks = jest.fn() as any;
jest.unstable_mockModule("../db/reorderTasks.js", () => ({
  reorderTasks: mockReorderTasks,
}));

const { OrchestratorStore, accumulateTokenUsage } =
  await import("./orchestrator.js");
const { DEFAULT_GROUP_ID } = await import("../config/config.js");

function createEvents() {
  const handlers = new Map<string, Set<Function>>();

  return {
    on(type: any, callback: any) {
      if (!handlers.has(type)) {
        handlers.set(type, new Set());
      }

      handlers.get(type)!.add(callback);
    },
    off(type: any, callback: any) {
      handlers.get(type)?.delete(callback);
    },
    emit(type: any, payload: any) {
      const cbs = handlers.get(type);
      if (cbs) {
        for (const cb of cbs) {
          cb(payload);
        }
      }
    },
  };
}

describe("accumulateTokenUsage", () => {
  it("accumulates tokens properly", () => {
    const prev = {
      groupId: "g1",
      inputTokens: 10,
      outputTokens: 20,
      cacheReadTokens: 5,
      cacheCreationTokens: 2,
      totalTokens: 37,
      contextLimit: 100,
    };

    const next = {
      groupId: "g1",
      inputTokens: 5,
      outputTokens: 10,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      totalTokens: 15,
      contextLimit: 100,
    };

    const result = accumulateTokenUsage(prev, next);

    expect(result).toEqual({
      groupId: "g1",
      inputTokens: 15,
      outputTokens: 30,
      cacheReadTokens: 5,
      cacheCreationTokens: 2,
      totalTokens: 52,
      contextLimit: 100,
    });
  });

  it("handles null previous state", () => {
    const next = {
      groupId: "g1",
      inputTokens: 5,
      outputTokens: 10,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      totalTokens: 15,
      contextLimit: 100,
    };

    const result = accumulateTokenUsage(null, next);

    expect(result).toEqual({
      groupId: "g1",
      inputTokens: 5,
      outputTokens: 10,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      totalTokens: 15,
      contextLimit: 100,
    });
  });
});

describe("OrchestratorStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockSaveGroupMetadata as any).mockResolvedValue(undefined);
    (mockEnsureMainGroupMemory as any).mockResolvedValue(true);
    (mockEnsureMainGroupIndex as any).mockResolvedValue(true);
    (mockIsMainGroupMemorySuppressed as any).mockResolvedValue(false);
    (mockSetMainGroupMemorySuppressed as any).mockResolvedValue(undefined);
    // By default, seedStaticMainSite passes through whatever existingPages were
    // supplied (mirrors real behavior when the manifest has nothing new to add).
    // Tests with an empty pages_list get [] back → ensureDefaultPage runs.
    (mockSeedStaticMainSite as any).mockImplementation(
      (_db: any, _groupId: any, existingPages: any[] = []) =>
        Promise.resolve(existingPages),
    );
    (mockIsStaticMainSiteSeeded as any).mockResolvedValue(false);
    (mockSetStaticMainSiteSeeded as any).mockResolvedValue(undefined);
    (mockGetStaticMainManifest as any).mockResolvedValue({ pages: [] });

    // Mock fetch for server-side task sync (syncTaskToServer / deleteTaskFromServer)

    (global as any).fetch = (jest.fn() as any).mockResolvedValue({ ok: true });

    (mockGetRecentMessages as any).mockResolvedValue([
      { id: "m1", role: "assistant" },
    ]);

    (mockGetAllTasks as any).mockResolvedValue([
      {
        id: "t-default",
        groupId: DEFAULT_GROUP_ID,
        enabled: true,
        prompt: "p",
      },
      { id: "t-other", groupId: "other", enabled: true, prompt: "q" },
    ]);

    (mockGetStorageStatus as any).mockResolvedValue({
      type: "opfs",
      name: "OPFS",
    });

    (mockListGroupFiles as any).mockResolvedValue(["file.txt"]);
  });

  it("initializes from orchestrator and loads state", async () => {
    const store = new OrchestratorStore();
    const events: any = createEvents();
    const orch: any = {
      events,
      getUseProxy: () => false,
      getProxyUrl: () => "",
      getGitProxyUrl: () => "",
      getVMBashFullInternetAccess: () => false,
      getTaskServerUrl: () => "/schedule",
    };

    await store.init({} as any, orch);

    events.emit("ready");
    expect(store.ready).toBe(true);

    expect(store.messages).toEqual([{ id: "m1", role: "assistant" }]);

    expect(store.tasks).toEqual([
      {
        id: "t-default",
        groupId: DEFAULT_GROUP_ID,
        enabled: true,
        prompt: "p",
      },
    ]);

    expect(store.files).toEqual(["file.txt"]);
    expect(store.storageStatus).toEqual({ type: "opfs", name: "OPFS" });
  });

  it("adds external channel group metadata when a new groupId receives a message", async () => {
    const store = new OrchestratorStore();
    const events: any = createEvents();
    const orch: any = {
      events,
      getUseProxy: () => false,
      getProxyUrl: () => "",
      getGitProxyUrl: () => "",
      getVMBashFullInternetAccess: () => false,
      getTaskServerUrl: () => "/schedule",
    };

    mockListGroups.mockResolvedValueOnce([
      { groupId: "br:main", name: "Main", createdAt: 0 },
    ]);

    await store.init({} as any, orch);

    events.emit("message", {
      id: "tg-1",
      groupId: "tg:8352127045",
      sender: "Karl",
      content: "@example hello",
      timestamp: 1700000000000,
      channel: "telegram",
      isFromMe: false,
      isTrigger: true,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(store.groups.some((g) => g.groupId === "tg:8352127045")).toBe(true);
    expect(mockSaveGroupMetadata).toHaveBeenCalledWith(
      {} as any,
      expect.arrayContaining([
        expect.objectContaining({
          groupId: "tg:8352127045",
          name: "Telegram 8352127045",
        }),
      ]),
    );
  });

  it("reacts to orchestrator events", async () => {
    const store = new OrchestratorStore();
    const events: any = createEvents();
    const orch: any = {
      events,
      getUseProxy: () => false,
      getProxyUrl: () => "",
      getGitProxyUrl: () => "",
      getVMBashFullInternetAccess: () => false,
      getTaskServerUrl: () => "/schedule",
    };

    await store.init({} as any, orch);

    events.emit("message", { id: "m2", role: "user" });

    expect(store.messages.at(-1)).toEqual({ id: "m2", role: "user" });

    events.emit("typing", { typing: true });

    expect(store.isTyping).toBe(true);

    events.emit("tool-activity", { tool: "read_file", status: "running" });

    expect(store.toolActivity).toEqual({
      tool: "read_file",
      status: "running",
    });

    events.emit("tool-activity", { tool: "read_file", status: "done" });

    expect(store.toolActivity).toBeNull();

    events.emit("model-download-progress", {
      groupId: DEFAULT_GROUP_ID,
      status: "running",
      progress: 0.5,
      message: "Downloading Prompt API model... 50%",
    });

    expect(store.modelDownloadProgress).toEqual({
      groupId: DEFAULT_GROUP_ID,
      status: "running",
      progress: 0.5,
      message: "Downloading Prompt API model... 50%",
    });

    events.emit("model-download-progress", {
      groupId: DEFAULT_GROUP_ID,
      status: "done",
      progress: 1,
      message: "Prompt API model ready.",
    });

    expect(store.modelDownloadProgress).toBeNull();

    events.emit("thinking-log", {
      level: "info",
      label: "Starting",
      message: "a",
    });

    expect(store.activityLog).toHaveLength(1);

    events.emit("thinking-log", {
      level: "debug",
      label: "Step",
      message: "b",
    });

    expect(store.activityLog).toHaveLength(2);

    events.emit("state-change", "thinking");

    expect(store.state).toBe("thinking");

    events.emit("state-change", "idle");

    expect(store.state).toBe("idle");

    expect(store.toolActivity).toBeNull();

    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    events.emit("error", { error: "boom" });

    expect(store.error).toBe("boom");

    expect(store.state).toBe("error");
    errorSpy.mockRestore();

    events.emit("token-usage", {
      groupId: "",
      inputTokens: 3,
      outputTokens: 4,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      totalTokens: 7,
      contextLimit: 0,
    });

    expect(store.tokenUsage).toEqual({
      groupId: "",
      inputTokens: 3,
      outputTokens: 4,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      totalTokens: 7,
      contextLimit: 0,
    });

    events.emit("session-reset");

    expect(store.messages).toEqual([]);

    expect(store.activityLog).toEqual([]);

    expect(store.tokenUsage).toBeNull();

    expect(store.isTyping).toBe(false);

    expect(store.modelDownloadProgress).toBeNull();

    expect(store.state).toBe("idle");
  });

  it("handles STATE_SNAPSHOT and STATE_DELTA AGUI events", async () => {
    const store = new OrchestratorStore();
    const events: any = createEvents();
    const orch: any = {
      events,
      getUseProxy: () => false,
      getProxyUrl: () => "",
      getGitProxyUrl: () => "",
      getVMBashFullInternetAccess: () => false,
      getTaskServerUrl: () => "/schedule",
    };

    await store.init({} as any, orch);

    // Initial snapshot
    window.dispatchEvent(
      new CustomEvent("shadow-claw-agui-event", {
        detail: {
          groupId: "g1",
          event: {
            type: "STATE_SNAPSHOT",
            snapshot: { foo: "bar", count: 1 },
          },
        },
      }),
    );

    expect(store.getPeerState("g1")).toEqual({ foo: "bar", count: 1 });

    // Delta update
    window.dispatchEvent(
      new CustomEvent("shadow-claw-agui-event", {
        detail: {
          groupId: "g1",
          event: {
            type: "STATE_DELTA",
            delta: [
              { op: "replace", path: "/count", value: 2 },
              { op: "add", path: "/newField", value: true },
            ],
          },
        },
      }),
    );

    expect(store.getPeerState("g1")).toEqual({
      foo: "bar",
      count: 2,
      newField: true,
    });

    // Snapshot overwrites everything
    window.dispatchEvent(
      new CustomEvent("shadow-claw-agui-event", {
        detail: {
          groupId: "g1",
          event: {
            type: "STATE_SNAPSHOT",
            snapshot: { baz: "qux" },
          },
        },
      }),
    );

    expect(store.getPeerState("g1")).toEqual({ baz: "qux" });
  });

  it("forwards thinking-log entries to server when activity disk logging is enabled", async () => {
    const store = new OrchestratorStore();
    const events: any = createEvents();
    const orch: any = {
      events,
      getUseProxy: () => false,
      getProxyUrl: () => "",
      getGitProxyUrl: () => "",
      getVMBashFullInternetAccess: () => false,
      getTaskServerUrl: () => "/schedule",
    };

    (mockGetConfig as any).mockImplementation(async (_db: any, key: string) => {
      if (key === "activity_log_disk_logging_enabled") {
        return "true";
      }

      return undefined;
    });

    await store.init({} as any, orch);
    const fetchMock = (global as any).fetch as jest.Mock;
    fetchMock.mockClear();

    events.emit("thinking-log", {
      groupId: DEFAULT_GROUP_ID,
      level: "debug",
      label: "Tool",
      message: "read_file started",
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).toHaveBeenCalledWith(
      "/activity-log",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );

    const forwarded = JSON.parse(
      (fetchMock.mock.calls[0][1] as any).body as string,
    );
    expect(forwarded.groupId).toBe(DEFAULT_GROUP_ID);
    expect(forwarded.sessionStartedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });

  it("does not forward thinking-log entries when activity disk logging is disabled", async () => {
    const store = new OrchestratorStore();
    const events: any = createEvents();
    const orch: any = {
      events,
      getUseProxy: () => false,
      getProxyUrl: () => "",
      getGitProxyUrl: () => "",
      getVMBashFullInternetAccess: () => false,
      getTaskServerUrl: () => "/schedule",
    };

    (mockGetConfig as any).mockImplementation(async (_db: any, key: string) => {
      if (key === "activity_log_disk_logging_enabled") {
        return "false";
      }

      return undefined;
    });

    await store.init({} as any, orch);
    const fetchMock = (global as any).fetch as jest.Mock;
    fetchMock.mockClear();

    events.emit("thinking-log", {
      groupId: DEFAULT_GROUP_ID,
      level: "debug",
      label: "Tool",
      message: "read_file started",
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).not.toHaveBeenCalledWith(
      "/activity-log",
      expect.any(Object),
    );
  });

  it("does not forward empty thinking-log messages when disk logging is enabled", async () => {
    const store = new OrchestratorStore();
    const events: any = createEvents();
    const orch: any = {
      events,
      getUseProxy: () => false,
      getProxyUrl: () => "",
      getGitProxyUrl: () => "",
      getVMBashFullInternetAccess: () => false,
      getTaskServerUrl: () => "/schedule",
    };

    (mockGetConfig as any).mockImplementation(async (_db: any, key: string) => {
      if (key === "activity_log_disk_logging_enabled") {
        return "true";
      }

      return undefined;
    });

    await store.init({} as any, orch);
    const fetchMock = (global as any).fetch as jest.Mock;
    fetchMock.mockClear();

    events.emit("thinking-log", {
      groupId: DEFAULT_GROUP_ID,
      level: "tool",
      label: "Tool result",
      message: "",
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).not.toHaveBeenCalledWith(
      "/activity-log",
      expect.any(Object),
    );
  });

  it("sendMessage uses active group", () => {
    const store = new OrchestratorStore();

    store.orchestrator = { browserChat: { submit: jest.fn() } } as any;

    store.sendMessage("hello");

    expect((store.orchestrator as any).browserChat.submit).toHaveBeenCalledWith(
      "hello",
      DEFAULT_GROUP_ID,
      [],
    );
  });

  it("runTask sends prompt to the task's own groupId, not the active group", () => {
    const store: any = new OrchestratorStore();
    const submit = jest.fn();
    store.orchestrator = { browserChat: { submit } } as any;

    // Active group is different from the task's group
    store._activeGroupId.set("active-group");

    store.runTask({ id: "t1", groupId: "task-group", prompt: "do work" });

    // Must target the task's groupId, NOT the active group
    expect(submit).toHaveBeenCalledWith(
      "do work",
      "task-group",
      [],
      undefined,
      undefined,
      undefined,
    );
    expect(submit).not.toHaveBeenCalledWith(
      "do work",
      "active-group",
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });

  it("runTask with no groupId refuses to execute (prevents conversation pollution)", () => {
    const store: any = new OrchestratorStore();
    const submit = jest.fn();
    store.orchestrator = { browserChat: { submit } } as any;

    store._activeGroupId.set("active-group");

    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    // Task has no groupId - must NOT execute in active conversation
    store.runTask({ id: "t2", prompt: "fallback work" });

    expect(submit).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("runTask of type 'tools' sends tools to agent worker", () => {
    const store: any = new OrchestratorStore();
    const postMessage = jest.fn();
    store.orchestrator = { agentWorker: { postMessage } } as any;

    store.runTask({
      id: "t-tools",
      groupId: "task-group",
      type: "tools",
      tools: [{ name: "bash", input: { command: "ls" } }],
      prompt: "",
    });

    expect(postMessage).toHaveBeenCalledWith({
      type: "execute-task-tools",
      payload: {
        groupId: "task-group",
        tools: [{ name: "bash", input: { command: "ls" } }],
        isManual: false,
      },
    });
  });

  it("runTask of type 'tools' with subagent enabled sends tools with isolated subagent groupId", () => {
    const store: any = new OrchestratorStore();
    const postMessage = jest.fn();
    store.orchestrator = { agentWorker: { postMessage } } as any;

    store.runTask({
      id: "t-tools-subagent",
      groupId: "task-group",
      type: "tools",
      tools: [{ name: "bash", input: { command: "ls" } }],
      prompt: "",
      subagent: true,
    });

    expect(postMessage).toHaveBeenCalledWith({
      type: "execute-task-tools",
      payload: {
        groupId: expect.stringMatching(/^subagent:/),
        tools: [{ name: "bash", input: { command: "ls" } }],
        isManual: false,
      },
    });
  });

  describe("scheduled task conversation isolation", () => {
    beforeEach(() => {
      (mockListGroups as any).mockResolvedValue([
        { groupId: "conversation-a", name: "Conv A", createdAt: 0 },
        { groupId: "conversation-b", name: "Conv B", createdAt: 0 },
      ]);
    });

    it("state-change for a different group does not update store state", async () => {
      const store = new OrchestratorStore();
      const events: any = createEvents();
      const orch: any = {
        events,
        getUseProxy: () => false,
        getProxyUrl: () => "",
        getGitProxyUrl: () => "",
        getVMBashFullInternetAccess: () => false,
        getTaskServerUrl: () => "/schedule",
        taskServerEnabled: true,
      };

      await store.init({} as any, orch);

      store._activeGroupId.set("conversation-b");

      events.emit("state-change", {
        state: "thinking",
        groupId: "conversation-a",
      });
      expect(store.state).toBe("idle");
    });

    it("state-change for the active group DOES update store state", async () => {
      const store = new OrchestratorStore();
      const events: any = createEvents();
      const orch: any = {
        events,
        getUseProxy: () => false,
        getProxyUrl: () => "",
        getGitProxyUrl: () => "",
        getVMBashFullInternetAccess: () => false,
        getTaskServerUrl: () => "/schedule",
        taskServerEnabled: true,
      };

      await store.init({} as any, orch);

      store._activeGroupId.set("conversation-b");

      events.emit("state-change", {
        state: "thinking",
        groupId: "conversation-b",
      });

      expect(store.state).toBe("thinking");
    });

    it("runTask with empty groupId does NOT fall back to active group", () => {
      const store: any = new OrchestratorStore();
      const submit = jest.fn();
      store.orchestrator = { browserChat: { submit } } as any;

      store._activeGroupId.set("conversation-b");

      store.runTask({
        id: "t3",
        groupId: "",
        prompt: "scheduled work",
        enabled: true,
      });

      expect(submit).not.toHaveBeenCalledWith(
        "scheduled work",
        "conversation-b",
        expect.anything(),
      );
    });

    it("message event with different groupId is NOT appended to active conversation", async () => {
      const store = new OrchestratorStore();
      const events: any = createEvents();
      const orch: any = {
        events,
        getUseProxy: () => false,
        getProxyUrl: () => "",
        getGitProxyUrl: () => "",
        getVMBashFullInternetAccess: () => false,
        getTaskServerUrl: () => "/schedule",
        taskServerEnabled: true,
      };

      await store.init({} as any, orch);

      store._activeGroupId.set("conversation-b");
      const initialMessages = store.messages.length;

      events.emit("message", {
        id: "sched-1",
        groupId: "conversation-a",
        sender: "Scheduler",
        content: "[SCHEDULED TASK] do something",
        timestamp: Date.now(),
        channel: "browser",
        isFromMe: false,
        isTrigger: true,
      });

      expect(store.messages.length).toBe(initialMessages);
    });

    it("streaming-start for a different group does NOT set streaming state", async () => {
      const store = new OrchestratorStore();
      const events: any = createEvents();
      const orch: any = {
        events,
        getUseProxy: () => false,
        getProxyUrl: () => "",
        getGitProxyUrl: () => "",
        getVMBashFullInternetAccess: () => false,
        getTaskServerUrl: () => "/schedule",
        taskServerEnabled: true,
      };

      await store.init({} as any, orch);

      store._activeGroupId.set("conversation-b");

      events.emit("streaming-start", { groupId: "conversation-a" });
      events.emit("streaming-chunk", {
        groupId: "conversation-a",
        text: "the conversation text",
      });

      expect(store.streamingText).toBeNull();
    });
  });

  it("newSession calls orchestrator methods", async () => {
    const store = new OrchestratorStore();

    const newSession = (jest.fn() as any).mockResolvedValue(undefined);

    store.orchestrator = { newSession } as any;

    const loadSpy = jest
      .spyOn(store, "loadHistory")
      .mockResolvedValue(undefined);

    (await store.newSession({} as any)) as any;

    expect(newSession).toHaveBeenCalledWith({} as any, DEFAULT_GROUP_ID);

    expect(loadSpy).toHaveBeenCalled();
  });

  it("clearError resets error and state", () => {
    const store = new OrchestratorStore();
    store._error.set("x");
    store._state.set("error");

    store.clearError();

    expect(store.error).toBeNull();

    expect(store.state).toBe("idle");
  });

  it("toggleTask and deleteTask persist and reload", async () => {
    const store: any = new OrchestratorStore();
    const loadSpy = jest.spyOn(store, "loadTasks").mockResolvedValue(undefined);

    await store.toggleTask({} as any, { id: "t1", enabled: false }, true);

    expect(mockSaveTask).toHaveBeenCalledWith({} as any, {
      id: "t1",
      enabled: true,
    });

    await store.deleteTask({} as any, "t1");

    expect(mockDeleteTask).toHaveBeenCalledWith({} as any, "t1");

    expect(loadSpy).toHaveBeenCalledTimes(2);
  });

  it("reorderTasks reorders tasks, loads them, and triggers sync to server", async () => {
    const store: any = new OrchestratorStore();
    store.orchestrator = {
      taskServerEnabled: true,
      taskServerUrl: "/schedule",
    } as any;
    const loadSpy = jest.spyOn(store, "loadTasks").mockResolvedValue(undefined);
    mockReorderTasks.mockResolvedValue([
      {
        id: "t2",
        groupId: "group-a",
        schedule: "0 0 * * *",
        prompt: "task2",
        order: 0,
      },
      {
        id: "t1",
        groupId: "group-a",
        schedule: "0 0 * * *",
        prompt: "task1",
        order: 1,
      },
    ]);

    (mockGetConfig as any).mockImplementation(async (_db: any, key: string) => {
      if (key === "subscriber_id") {
        return "sub-xyz";
      }
      return undefined;
    });

    const mockFetch = (jest.fn() as any).mockResolvedValue({ ok: true } as any);
    (global as any).fetch = mockFetch;

    await store.reorderTasks({} as any, "group-a", ["t2", "t1"]);

    expect(mockReorderTasks).toHaveBeenCalledWith({} as any, "group-a", [
      "t2",
      "t1",
    ]);
    expect(loadSpy).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/tasks$/),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"id":"t2"'),
      }),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/tasks$/),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"id":"t1"'),
      }),
    );
  });

  it("deleteMessage deletes from DB, reloads history, and refreshes context usage", async () => {
    const store: any = new OrchestratorStore();
    const loadSpy = jest
      .spyOn(store, "loadHistory")
      .mockResolvedValue(undefined);
    const refreshContextUsage = jest.fn<any>().mockResolvedValue(undefined);
    store.orchestrator = { refreshContextUsage } as any;

    await store.deleteMessage({} as any, "m1");

    expect(mockDeleteMessage).toHaveBeenCalledWith({} as any, "m1");
    expect(loadSpy).toHaveBeenCalled();
    expect(refreshContextUsage).toHaveBeenCalledWith(
      {} as any,
      DEFAULT_GROUP_ID,
    );
  });

  it("queues failed delete sync for replay", async () => {
    const store: any = new OrchestratorStore();
    store.orchestrator = {
      taskServerEnabled: true,
      taskServerUrl: "/schedule",
    } as any;
    jest.spyOn(store, "loadTasks").mockResolvedValue(undefined);

    (global as any).fetch = (jest.fn() as any).mockResolvedValue({ ok: false });

    await expect(store.deleteTask({} as any, "t1")).rejects.toThrow(
      "Failed to delete scheduled task on server; task kept locally.",
    );

    expect(mockDeleteTask).not.toHaveBeenCalled();
    expect(mockSetConfig).toHaveBeenCalledWith(
      {} as any,
      "task_sync_outbox",
      expect.stringContaining('"type":"delete"'),
    );
    expect(mockSetConfig).toHaveBeenCalledWith(
      {} as any,
      "task_sync_outbox",
      expect.stringContaining('"id":"t1"'),
    );
  });

  it("allows local delete when server returns 404", async () => {
    const store: any = new OrchestratorStore();
    store.orchestrator = {
      taskServerEnabled: true,
      taskServerUrl: "/schedule",
    } as any;
    jest.spyOn(store, "loadTasks").mockResolvedValue(undefined);

    (global as any).fetch = (jest.fn() as any).mockResolvedValue({
      ok: false,
      status: 404,
    });

    await store.deleteTask({} as any, "t404");

    expect(mockDeleteTask).toHaveBeenCalledWith({} as any, "t404");
    expect(mockSetConfig).not.toHaveBeenCalledWith(
      {} as any,
      "task_sync_outbox",
      expect.stringContaining('"id":"t404"'),
    );
  });

  it("allows local delete when server returns 405", async () => {
    const store: any = new OrchestratorStore();
    store.orchestrator = {
      taskServerEnabled: true,
      taskServerUrl: "/schedule",
    } as any;
    jest.spyOn(store, "loadTasks").mockResolvedValue(undefined);

    (global as any).fetch = (jest.fn() as any).mockResolvedValue({
      ok: false,
      status: 405,
    });

    await store.deleteTask({} as any, "t405");

    expect(mockDeleteTask).toHaveBeenCalledWith({} as any, "t405");
    expect(mockSetConfig).not.toHaveBeenCalledWith(
      {} as any,
      "task_sync_outbox",
      expect.stringContaining('"id":"t405"'),
    );
  });

  it("replays queued task sync operations during init", async () => {
    const store = new OrchestratorStore();
    const events: any = createEvents();
    const orch: any = {
      events,
      getUseProxy: () => false,
      getProxyUrl: () => "",
      getGitProxyUrl: () => "",
      getVMBashFullInternetAccess: () => false,
      getTaskServerUrl: () => "/schedule",
      taskServerEnabled: true,
    };

    (mockGetConfig as any).mockImplementation(async (_db: any, key: string) => {
      if (key === "task_sync_outbox") {
        return JSON.stringify([
          {
            type: "delete",
            id: "queued-1",
            queuedAt: 123,
          },
        ]);
      }

      return undefined;
    });

    (global as any).fetch = (jest.fn() as any).mockResolvedValue({ ok: true });

    await store.init({} as any, orch);

    expect((global as any).fetch).toHaveBeenCalledWith(
      expect.stringMatching(/^\/schedule\/tasks\/queued-1\?/),
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(mockSetConfig).toHaveBeenCalledWith(
      {} as any,
      "task_sync_outbox",
      "[]",
    );
  });

  it("clearAllTasks deletes only tasks in active group", async () => {
    const store = new OrchestratorStore();
    const loadSpy = jest.spyOn(store, "loadTasks").mockResolvedValue(undefined);

    (await store.clearAllTasks({} as any)) as any;

    expect(mockDeleteTask).toHaveBeenCalledWith({} as any, "t-default");

    expect(mockDeleteTask).not.toHaveBeenCalledWith({} as any, "t-other");

    expect(loadSpy).toHaveBeenCalled();
  });

  it("reconciles server-only tasks into local store", async () => {
    const store = new OrchestratorStore();
    (store as any).orchestrator = {
      taskServerEnabled: true,
      taskServerUrl: "/schedule",
    } as any;

    (mockGetConfig as any).mockImplementation(async (_db: any, key: string) => {
      if (key === "subscriber_id") {
        return "sub-123";
      }

      return undefined;
    });

    (mockGetAllTasks as any).mockResolvedValueOnce([]);

    (global as any).fetch = (jest.fn() as any).mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: "task-1",
          group_id: DEFAULT_GROUP_ID,
          schedule: "*/5 * * * *",
          prompt: "Frequent task",
          type: "tools",
          tools: '[{"name":"bash","input":{"command":"ls"}}]',
          channel: "br:",

          enabled: 1,
          last_run: null,
          created_at: 1700000000000,
        },
      ],
    });

    await store.loadTasks({} as any);

    expect((global as any).fetch).toHaveBeenCalledWith(
      "/schedule/tasks?groupId=br%3Amain&subscriberId=sub-123",
      expect.objectContaining({ method: "GET" }),
    );

    expect(mockSaveTask).toHaveBeenCalledWith(
      {} as any,
      expect.objectContaining({
        id: "task-1",
        groupId: DEFAULT_GROUP_ID,
        schedule: "*/5 * * * *",
        prompt: "Frequent task",
        type: "tools",
        tools: [{ name: "bash", input: { command: "ls" } }],
        channel: "br:",
      }),
    );
    expect(store.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "task-1",
          groupId: DEFAULT_GROUP_ID,
          type: "tools",
          tools: [{ name: "bash", input: { command: "ls" } }],
          channel: "br:",
        }),
      ]),
    );
  });

  it("includes subscriberId when syncing task upserts to server", async () => {
    const store: any = new OrchestratorStore();
    store.orchestrator = {
      taskServerEnabled: true,
      taskServerUrl: "/schedule",
    } as any;
    (mockGetConfig as any).mockImplementation(async (_db: any, key: string) => {
      if (key === "subscriber_id") {
        return "sub-xyz";
      }

      return undefined;
    });

    (global as any).fetch = (jest.fn() as any).mockResolvedValue({
      ok: true,
    } as any);

    await store.upsertTask(
      {} as any,
      {
        id: "t-upsert",
        groupId: DEFAULT_GROUP_ID,
        schedule: "*/5 * * * *",
        prompt: "sync me",
        enabled: true,
        lastRun: null,
        createdAt: Date.now(),
      },
      { reloadTasks: false },
    );

    const postCall = (global as any).fetch.mock.calls.find(
      (call: any[]) => call[1]?.method === "POST",
    );
    expect(postCall).toBeDefined();
    expect(JSON.parse(postCall[1].body)).toEqual(
      expect.objectContaining({
        id: "t-upsert",
        subscriberId: "sub-xyz",
      }),
    );
  });

  it("includes subscriberId when deleting task on server", async () => {
    const store: any = new OrchestratorStore();
    store.orchestrator = {
      taskServerEnabled: true,
      taskServerUrl: "/schedule",
    } as any;
    jest.spyOn(store, "loadTasks").mockResolvedValue(undefined);
    (mockGetConfig as any).mockImplementation(async (_db: any, key: string) => {
      if (key === "subscriber_id") {
        return "sub-del";
      }

      return undefined;
    });

    (global as any).fetch = (jest.fn() as any).mockResolvedValue({
      ok: true,
    } as any);

    await store.deleteTask({} as any, "t-del");

    expect((global as any).fetch).toHaveBeenCalledWith(
      "/schedule/tasks/t-del?subscriberId=sub-del",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("restoreTasksFromBackup rewrites ids and group", async () => {
    const store: any = new OrchestratorStore();
    jest.spyOn(store, "clearAllTasks").mockResolvedValue(undefined);
    jest.spyOn(store, "loadTasks").mockResolvedValue(undefined);

    await store.restoreTasksFromBackup({} as any, [
      { id: "old1", groupId: "x", prompt: "a", enabled: true },
      { id: "old2", groupId: "x", prompt: "b", enabled: false },
    ]);

    expect(mockSaveTask).toHaveBeenNthCalledWith(
      1,
      {},
      expect.objectContaining({ groupId: DEFAULT_GROUP_ID, prompt: "a" }),
    );

    expect(mockSaveTask).toHaveBeenNthCalledWith(
      2,
      {},
      expect.objectContaining({ groupId: DEFAULT_GROUP_ID, prompt: "b" }),
    );

    expect(mockSaveTask.mock.calls[0][1].id).not.toBe("old1");

    expect(mockSaveTask.mock.calls[1][1].id).not.toBe("old2");
  });

  it("loadFiles and grantStorageAccess handle success and errors", async () => {
    const store = new OrchestratorStore();
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    (await store.loadFiles({} as any)) as any;

    expect(store.files).toEqual(["file.txt"]);

    (mockListGroupFiles as any).mockRejectedValueOnce(new Error("list failed"));

    (await store.loadFiles({} as any)) as any;

    expect(errorSpy).toHaveBeenCalledWith(
      "Failed to load files in store:",
      expect.any(Error),
    );

    const loadSpy = jest.spyOn(store, "loadFiles").mockResolvedValue(undefined);

    (await store.grantStorageAccess({} as any)) as any;

    expect(mockRequestStorageAccess).toHaveBeenCalledWith({} as any) as any;

    expect(loadSpy).toHaveBeenCalled();

    (mockRequestStorageAccess as any).mockRejectedValueOnce(
      new Error("permission denied"),
    );

    (await store.grantStorageAccess({} as any)) as any;

    expect(errorSpy).toHaveBeenCalledWith(
      "Failed to grant storage access:",
      expect.any(Error),
    );

    errorSpy.mockRestore();
  });

  it("manual workspace sync helpers call orchestrator bridge", () => {
    const store = new OrchestratorStore();
    store.orchestrator = {} as any;

    store.syncHostWorkspaceToVM();
    store.syncVMWorkspaceToHost();

    expect(mockSyncTerminalWorkspace).toHaveBeenCalledWith(
      store.orchestrator,
      DEFAULT_GROUP_ID,
    );

    expect(mockFlushTerminalWorkspace).toHaveBeenCalledWith(
      store.orchestrator,
      DEFAULT_GROUP_ID,
    );
  });

  it("supports folder navigation and reset", async () => {
    const store = new OrchestratorStore();
    const setPathSpy = jest.spyOn(store, "setCurrentPath");

    await store.navigateIntoFolder({} as any, "dir/");

    expect(store.currentPath).toBe("dir");

    await store.navigateIntoFolder({} as any, "sub/");

    expect(store.currentPath).toBe("dir/sub");

    (await store.navigateBackFolder({} as any)) as any;

    expect(store.currentPath).toBe("dir");

    (await store.navigateBackFolder({} as any)) as any;

    expect(store.currentPath).toBe(".");

    (await store.navigateBackFolder({} as any)) as any;

    expect(store.currentPath).toBe(".");

    (await store.resetToRootFolder({} as any)) as any;

    expect(store.currentPath).toBe(".");

    expect(setPathSpy).toHaveBeenCalled();
  });

  it("setActiveGroup resets transient state and reloads views", () => {
    const store: any = new OrchestratorStore();

    store._messages.set([{ id: "m1" }]);

    store._activityLog.set([{ label: "x" }]);
    store._error.set("oops");
    store._isTyping.set(true);
    store._toolActivity.set({ tool: "x", status: "running" });
    store._currentPath.set("nested/path");

    const historySpy = jest
      .spyOn(store, "loadHistory")
      .mockResolvedValue(undefined);
    const taskSpy = jest.spyOn(store, "loadTasks").mockResolvedValue(undefined);
    const filesSpy = jest
      .spyOn(store, "loadFiles")
      .mockResolvedValue(undefined);

    store._activePage.set("chat");

    store.setActiveGroup({} as any, "group-2");

    expect(store.activeGroupId).toBe("group-2");

    expect(store.messages).toEqual([]);

    expect(store.activityLog).toEqual([]);

    expect(store.error).toBeNull();

    expect(store.isTyping).toBe(false);

    expect(store.toolActivity).toBeNull();

    expect(store.currentPath).toBe(".");

    expect(historySpy).toHaveBeenCalled();

    expect(taskSpy).toHaveBeenCalledWith({} as any) as any;

    expect(filesSpy).toHaveBeenCalledWith({} as any) as any;
  });

  it("setActiveGroup preserves unread when not viewing chat", () => {
    const store: any = new OrchestratorStore();

    store._activePage.set("files");
    store._unreadGroupIds.set(new Set(["group-2"]));

    store.setActiveGroup({} as any, "group-2");

    expect(store.unreadGroupIds).toEqual(new Set(["group-2"]));
  });

  it("returns a snapshot via getState and tasks backup", () => {
    const store: any = new OrchestratorStore();

    store._tasks.set([{ id: "t1" }]);

    expect(store.getTasksForBackup()).toEqual([{ id: "t1" }]);

    expect(store.getState()).toMatchObject({
      activeGroupId: DEFAULT_GROUP_ID,
      currentPath: ".",
      files: [],
      messages: [],
      ready: false,
    });
  });

  describe("multi-conversation management", () => {
    beforeEach(() => {
      (mockListGroups as any).mockResolvedValue([
        { groupId: "br:main", name: "Main", createdAt: 0 },
      ]);

      (mockCreateGroup as any).mockResolvedValue({
        groupId: "br:new1",
        name: "New Conversation",
        createdAt: 1000,
      });

      (mockRenameGroup as any).mockResolvedValue(undefined);

      (mockDeleteGroupMetadata as any).mockResolvedValue(undefined);

      (mockClearGroupMessages as any).mockResolvedValue(undefined);

      (mockGetConfig as any).mockResolvedValue(undefined);

      (mockSetConfig as any).mockResolvedValue(undefined);
    });

    it("loadGroups populates groups signal", async () => {
      const store = new OrchestratorStore();

      (await store.loadGroups({} as any)) as any;

      expect(store.groups).toEqual([
        { groupId: "br:main", name: "Main", createdAt: 0 },
      ]);
    });

    it("createConversation creates group and switches to it", async () => {
      const store = new OrchestratorStore();
      jest.spyOn(store, "loadHistory").mockResolvedValue(undefined);
      jest.spyOn(store, "loadTasks").mockResolvedValue(undefined);
      jest.spyOn(store, "loadFiles").mockResolvedValue(undefined);
      jest.spyOn(store, "loadGroups").mockResolvedValue(undefined);

      const group = await store.createConversation(
        {} as any,
        "New Conversation",
      );

      expect(group.groupId).toBe("br:new1");
      expect(mockCreateGroup).toHaveBeenCalledWith(
        {} as any,
        "New Conversation",
      );
      expect(store.activeGroupId).toBe("br:new1");
    });

    it("renameConversation updates group name and reloads groups", async () => {
      const store = new OrchestratorStore();
      jest.spyOn(store, "loadGroups").mockResolvedValue(undefined);

      await store.renameConversation({} as any, "br:main", "Renamed");

      expect(mockRenameGroup).toHaveBeenCalledWith(
        {} as any,
        "br:main",
        "Renamed",
      );
      expect(store.loadGroups).toHaveBeenCalled();
    });

    it("deleteConversation removes group, clears messages, switches to another group", async () => {
      mockListGroups

        .mockResolvedValueOnce([
          { groupId: "br:main", name: "Main", createdAt: 0 },
          { groupId: "br:other", name: "Other", createdAt: 100 },
        ])

        .mockResolvedValueOnce([
          { groupId: "br:main", name: "Main", createdAt: 0 },
        ]);

      const store = new OrchestratorStore();
      jest.spyOn(store, "loadHistory").mockResolvedValue(undefined);
      jest.spyOn(store, "loadTasks").mockResolvedValue(undefined);
      jest.spyOn(store, "loadFiles").mockResolvedValue(undefined);

      // Start on the group we'll delete

      (await store.loadGroups({} as any)) as any;
      store._activeGroupId.set("br:other");

      await store.deleteConversation({} as any, "br:other");

      expect(mockDeleteGroupMetadata).toHaveBeenCalledWith(
        {} as any,
        "br:other",
      );
      expect(mockClearGroupMessages).toHaveBeenCalledWith(
        {} as any,
        "br:other",
      );

      // Should have switched to another group
      expect(store.activeGroupId).not.toBe("br:other");
    });

    it("deleteConversation refuses to delete the last remaining group", async () => {
      (mockListGroups as any).mockResolvedValue([
        { groupId: "br:main", name: "Main", createdAt: 0 },
      ]);

      const store = new OrchestratorStore();

      (await store.loadGroups({} as any)) as any;

      await store.deleteConversation({} as any, "br:main");

      // Should NOT have deleted
      expect(mockDeleteGroupMetadata).not.toHaveBeenCalled();
    });

    it("streaming events are scoped to active conversation", async () => {
      const store = new OrchestratorStore();
      const events = createEvents();
      const orch: any = {
        events,
        getUseProxy: () => false,
        getProxyUrl: () => "",
        getGitProxyUrl: () => "",
        getVMBashFullInternetAccess: () => false,
        getTaskServerUrl: () => "/schedule",
        taskServerEnabled: true,
      };
      jest.spyOn(store, "loadHistory").mockResolvedValue(undefined);
      jest.spyOn(store, "loadTasks").mockResolvedValue(undefined);
      jest.spyOn(store, "loadFiles").mockResolvedValue(undefined);

      await store.init({} as any, orch);

      // Start streaming in Main conversation (the default active group)
      events.emit("streaming-start", { groupId: DEFAULT_GROUP_ID });
      expect(store.streamingText).toBe("");

      events.emit("streaming-chunk", {
        groupId: DEFAULT_GROUP_ID,
        text: "Hello ",
      });
      expect(store.streamingText).toBe("Hello ");

      // Switch to a different conversation
      store.setActiveGroup({} as any, "br:secondary");

      // Streaming text should be cleared for the new conversation
      expect(store.streamingText).toBeNull();

      // Chunks arriving for the OLD conversation should NOT appear
      events.emit("streaming-chunk", {
        groupId: DEFAULT_GROUP_ID,
        text: "world",
      });
      expect(store.streamingText).toBeNull();

      // streaming-done for old group should not affect current view
      events.emit("streaming-done", { groupId: DEFAULT_GROUP_ID });
      expect(store.streamingText).toBeNull();

      // Switch back to Main — streaming is done, text was persisted by worker
      store.setActiveGroup({} as any, DEFAULT_GROUP_ID);
      expect(store.streamingText).toBeNull();
    });

    it("streaming-start for non-active group is ignored", async () => {
      const store = new OrchestratorStore();
      const events = createEvents();
      const orch: any = {
        events,
        getUseProxy: () => false,
        getProxyUrl: () => "",
        getGitProxyUrl: () => "",
        getVMBashFullInternetAccess: () => false,
        getTaskServerUrl: () => "/schedule",
        taskServerEnabled: true,
      };

      await store.init({} as any, orch);

      // Active group is DEFAULT_GROUP_ID
      // A streaming-start for a different group should not activate streaming
      events.emit("streaming-start", { groupId: "br:other" });
      expect(store.streamingText).toBeNull();
    });

    it("typing events are scoped to active conversation", async () => {
      const store = new OrchestratorStore();
      const events = createEvents();
      const orch: any = {
        events,
        getUseProxy: () => false,
        getProxyUrl: () => "",
        getGitProxyUrl: () => "",
        getVMBashFullInternetAccess: () => false,
        getTaskServerUrl: () => "/schedule",
        taskServerEnabled: true,
      };

      await store.init({} as any, orch);

      // Typing for the active group
      events.emit("typing", {
        groupId: DEFAULT_GROUP_ID,
        typing: true,
      });
      expect(store.isTyping).toBe(true);

      // Typing for a different group should not affect current view
      events.emit("typing", { groupId: "br:other", typing: true });
      // Should still reflect the active group's state, not the other group
      // Since we didn't get a typing:false for the active group, it stays true
      expect(store.isTyping).toBe(true);

      // Switch to the other group
      jest.spyOn(store, "loadHistory").mockResolvedValue(undefined);
      jest.spyOn(store, "loadTasks").mockResolvedValue(undefined);
      jest.spyOn(store, "loadFiles").mockResolvedValue(undefined);
      store.setActiveGroup({} as any, "br:other");

      // isTyping was reset by setActiveGroup
      expect(store.isTyping).toBe(false);

      // typing event for old group should be ignored
      events.emit("typing", {
        groupId: DEFAULT_GROUP_ID,
        typing: true,
      });
      expect(store.isTyping).toBe(false);
    });

    it("tool-activity events are scoped to active conversation", async () => {
      const store = new OrchestratorStore();
      const events = createEvents();
      const orch: any = {
        events,
        getUseProxy: () => false,
        getProxyUrl: () => "",
        getGitProxyUrl: () => "",
        getVMBashFullInternetAccess: () => false,
        getTaskServerUrl: () => "/schedule",
        taskServerEnabled: true,
      };

      await store.init({} as any, orch);

      // Tool activity for the active group
      events.emit("tool-activity", {
        groupId: DEFAULT_GROUP_ID,
        tool: "read_file",
        status: "running",
      });
      expect(store.toolActivity).toEqual({
        tool: "read_file",
        status: "running",
      });

      // Tool activity for a different group should be ignored
      events.emit("tool-activity", {
        groupId: "br:other",
        tool: "write_file",
        status: "running",
      });
      expect(store.toolActivity).toEqual({
        tool: "read_file",
        status: "running",
      });
    });

    it("message events are scoped to active conversation", async () => {
      const store = new OrchestratorStore();
      const events = createEvents();
      const orch: any = {
        events,
        getUseProxy: () => false,
        getProxyUrl: () => "",
        getGitProxyUrl: () => "",
        getVMBashFullInternetAccess: () => false,
        getTaskServerUrl: () => "/schedule",
        taskServerEnabled: true,
      };

      await store.init({} as any, orch);

      // Message for the active group should be appended
      events.emit("message", {
        id: "m1",
        groupId: DEFAULT_GROUP_ID,
        role: "user",
        isFromMe: false,
      });
      expect(store.messages).toHaveLength(2); // 1 from init + 1 new

      // Message for a different group should NOT be appended
      events.emit("message", {
        id: "m2",
        groupId: "br:other",
        role: "user",
        isFromMe: false,
      });
      expect(store.messages).toHaveLength(2); // unchanged
    });

    it("switchConversation persists last active group", async () => {
      const store = new OrchestratorStore();
      jest.spyOn(store, "loadHistory").mockResolvedValue(undefined);
      jest.spyOn(store, "loadTasks").mockResolvedValue(undefined);
      jest.spyOn(store, "loadFiles").mockResolvedValue(undefined);

      await store.switchConversation({} as any, "br:other", true);

      expect(store.activeGroupId).toBe("br:other");
      expect(mockSetConfig).toHaveBeenCalledWith(
        {},
        "last_active_group",
        "br:other",
      );
    });

    it("switchConversation can preserve unread when requested", async () => {
      const store = new OrchestratorStore();
      jest.spyOn(store, "loadHistory").mockResolvedValue(undefined);
      jest.spyOn(store, "loadTasks").mockResolvedValue(undefined);
      jest.spyOn(store, "loadFiles").mockResolvedValue(undefined);

      store._activePage.set("files");
      store._unreadGroupIds.set(new Set(["br:other"]));

      await store.switchConversation({} as any, "br:other", false);

      expect(store.unreadGroupIds).toEqual(new Set(["br:other"]));
    });

    it("init restores persisted pages list", async () => {
      (mockIsMainGroupMemorySuppressed as any).mockResolvedValue(true);
      (mockGetConfig as any).mockImplementation(
        async (_db: any, key: string) => {
          if (key === "pages_list") {
            return JSON.stringify([
              { groupId: "br:main", path: "README.md" },
              { groupId: "br:test", path: "docs/guide.md" },
            ]);
          }

          return undefined;
        },
      );

      const store = new OrchestratorStore();
      const events = createEvents();
      const orch: any = {
        events,
        getUseProxy: () => false,
        getProxyUrl: () => "",
        getGitProxyUrl: () => "",
        getVMBashFullInternetAccess: () => false,
        getTaskServerUrl: () => "/schedule",
        taskServerEnabled: true,
      };

      await store.init({} as any, orch);

      expect(store.pages).toEqual([
        { groupId: "br:main", path: "README.md" },
        { groupId: "br:test", path: "docs/guide.md" },
      ]);
    });

    it("addPage de-duplicates by group and path and persists pages list", async () => {
      const store = new OrchestratorStore();

      await store.addPage({} as any, "README.md");
      await store.addPage({} as any, "README.md");
      await store.addPage({} as any, "docs/guide.md");
      await store.addPage({} as any, "README.md", "br:test");

      expect(store.pages).toEqual([
        { groupId: "br:main", path: "README.md" },
        { groupId: "br:main", path: "docs/guide.md" },
        { groupId: "br:test", path: "README.md" },
      ]);
      expect(mockSetConfig).toHaveBeenLastCalledWith(
        {} as any,
        "pages_list",
        JSON.stringify([
          { groupId: "br:main", path: "README.md" },
          { groupId: "br:main", path: "docs/guide.md" },
          { groupId: "br:test", path: "README.md" },
        ]),
      );
    });

    it("addPage clears suppression when main MEMORY is added back", async () => {
      const store = new OrchestratorStore();

      await store.addPage({} as any, "MEMORY.md", "br:main");

      expect(mockSetMainGroupMemorySuppressed).toHaveBeenCalledWith(
        {} as any,
        false,
      );
    });

    it("removePage removes path and persists updated pages list", async () => {
      const store = new OrchestratorStore();

      await store.addPage({} as any, "README.md", "br:main");
      await store.addPage({} as any, "README.md", "br:test");
      await store.addPage({} as any, "docs/guide.md", "br:main");

      await store.removePage({} as any, "README.md", "br:main");

      expect(store.pages).toEqual([
        { groupId: "br:test", path: "README.md" },
        { groupId: "br:main", path: "docs/guide.md" },
      ]);
      expect(mockSetConfig).toHaveBeenLastCalledWith(
        {} as any,
        "pages_list",
        JSON.stringify([
          { groupId: "br:test", path: "README.md" },
          { groupId: "br:main", path: "docs/guide.md" },
        ]),
      );
    });

    it("removePage keeps pages empty and records suppression when removing main MEMORY", async () => {
      const store = new OrchestratorStore();

      await store.addPage({} as any, "MEMORY.md", "br:main");
      await store.removePage({} as any, "MEMORY.md", "br:main");

      expect(mockSetMainGroupMemorySuppressed).toHaveBeenCalledWith(
        {} as any,
        true,
      );
      expect(mockEnsureMainGroupMemory).not.toHaveBeenCalled();
      expect(store.pages).toEqual([]);
      expect(mockSetConfig).toHaveBeenLastCalledWith(
        {} as any,
        "pages_list",
        JSON.stringify([]),
      );
    });

    it("removePage keeps existing last non-default page when MEMORY reseed fails", async () => {
      const store = new OrchestratorStore();
      (mockEnsureMainGroupMemory as any).mockResolvedValue(false);

      await store.addPage({} as any, "docs/guide.md", "br:main");
      await store.removePage({} as any, "docs/guide.md", "br:main");

      expect(store.pages).toEqual([
        { groupId: "br:main", path: "docs/guide.md" },
      ]);
      expect(mockSetConfig).toHaveBeenCalledWith(
        {} as any,
        "suppressed_pages_list",
        expect.any(String),
      );
    });

    it("removeAllPages suppresses all pages, resets pages list, and clears default/active pinned pages", async () => {
      const store = new OrchestratorStore();

      await store.addPage({} as any, "README.md", "br:main");
      await store.addPage({} as any, "docs/guide.md", "br:test");

      await store.removeAllPages({} as any);

      expect(store.pages).toEqual([]);
      expect(mockSetConfig).toHaveBeenCalledWith(
        {} as any,
        "pages_list",
        JSON.stringify([]),
      );
      expect(mockSetConfig).toHaveBeenCalledWith(
        {} as any,
        "default_pinned_page",
        null,
      );
      expect(mockSetConfig).toHaveBeenCalledWith(
        {} as any,
        "last_selected_pinned_page",
        null,
      );
    });

    it("init seeds default MEMORY.md as first page when missing", async () => {
      (mockGetConfig as any).mockImplementation(
        async (_db: any, key: string) => {
          if (key === "pages_list") {
            return undefined;
          }

          return undefined;
        },
      );

      const store = new OrchestratorStore();
      const events = createEvents();
      const orch: any = {
        events,
        getUseProxy: () => false,
        getProxyUrl: () => "",
        getGitProxyUrl: () => "",
        getVMBashFullInternetAccess: () => false,
        getTaskServerUrl: () => "/schedule",
        taskServerEnabled: true,
      };

      await store.init({} as any, orch);

      expect(mockEnsureMainGroupMemory).toHaveBeenCalledWith(
        {} as any,
        DEFAULT_GROUP_ID,
      );
      expect(store.pages).toEqual([{ groupId: "br:main", path: "MEMORY.md" }]);
      expect(mockSetConfig).toHaveBeenCalledWith(
        {} as any,
        "pages_list",
        JSON.stringify([{ groupId: "br:main", path: "MEMORY.md" }]),
      );
    });

    it("init does not seed default MEMORY when suppression is enabled", async () => {
      (mockGetConfig as any).mockImplementation(
        async (_db: any, key: string) => {
          if (key === "pages_list") {
            return undefined;
          }

          return undefined;
        },
      );
      (mockIsMainGroupMemorySuppressed as any).mockResolvedValue(true);

      const store = new OrchestratorStore();
      const events = createEvents();
      const orch: any = {
        events,
        getUseProxy: () => false,
        getProxyUrl: () => "",
        getGitProxyUrl: () => "",
        getVMBashFullInternetAccess: () => false,
        getTaskServerUrl: () => "/schedule",
        taskServerEnabled: true,
      };

      await store.init({} as any, orch);

      expect(mockEnsureMainGroupMemory).not.toHaveBeenCalled();
      expect(store.pages).toEqual([]);
      expect(mockSetConfig).not.toHaveBeenCalledWith(
        {} as any,
        "pages_list",
        expect.any(String),
      );
    });

    it("init does not reseed default page when pages are already configured", async () => {
      (mockIsMainGroupMemorySuppressed as any).mockResolvedValue(true);
      (mockGetConfig as any).mockImplementation(
        async (_db: any, key: string) => {
          if (key === "pages_list") {
            return JSON.stringify([
              { groupId: "br:main", path: "docs/guide.md" },
            ]);
          }

          return undefined;
        },
      );

      const store = new OrchestratorStore();
      const events = createEvents();
      const orch: any = {
        events,
        getUseProxy: () => false,
        getProxyUrl: () => "",
        getGitProxyUrl: () => "",
        getVMBashFullInternetAccess: () => false,
        getTaskServerUrl: () => "/schedule",
        taskServerEnabled: true,
      };

      await store.init({} as any, orch);

      expect(store.pages).toEqual([
        { groupId: "br:main", path: "docs/guide.md" },
      ]);
      expect(mockEnsureMainGroupMemory).not.toHaveBeenCalled();
    });

    it("init migrates legacy string page entries to main conversation refs", async () => {
      (mockIsMainGroupMemorySuppressed as any).mockResolvedValue(true);
      (mockGetConfig as any).mockImplementation(
        async (_db: any, key: string) => {
          if (key === "pages_list") {
            return JSON.stringify(["README.md", "docs/guide.md"]);
          }

          return undefined;
        },
      );

      const store = new OrchestratorStore();
      const events = createEvents();
      const orch: any = {
        events,
        getUseProxy: () => false,
        getProxyUrl: () => "",
        getGitProxyUrl: () => "",
        getVMBashFullInternetAccess: () => false,
        getTaskServerUrl: () => "/schedule",
        taskServerEnabled: true,
      };

      await store.init({} as any, orch);

      expect(store.pages).toEqual([
        { groupId: "br:main", path: "README.md" },
        { groupId: "br:main", path: "docs/guide.md" },
      ]);
    });

    it("init normalizes main/MEMORY.md page entries to MEMORY.md", async () => {
      (mockGetConfig as any).mockImplementation(
        async (_db: any, key: string) => {
          if (key === "pages_list") {
            return JSON.stringify([
              { groupId: "br:main", path: "main/memory.md" },
              { groupId: "br:main", path: "docs/guide.md" },
            ]);
          }

          return undefined;
        },
      );

      const store = new OrchestratorStore();
      const events = createEvents();
      const orch: any = {
        events,
        getUseProxy: () => false,
        getProxyUrl: () => "",
        getGitProxyUrl: () => "",
        getVMBashFullInternetAccess: () => false,
        getTaskServerUrl: () => "/schedule",
        taskServerEnabled: true,
      };

      await store.init({} as any, orch);

      expect(store.pages).toEqual([
        { groupId: "br:main", path: "docs/guide.md" },
        { groupId: "br:main", path: "MEMORY.md" },
      ]);
    });

    it("init restores last-active conversation on reload", async () => {
      (mockGetConfig as any).mockResolvedValue("br:restored");

      (mockListGroups as any).mockResolvedValue([
        { groupId: "br:main", name: "Main", createdAt: 0 },
        { groupId: "br:restored", name: "Restored", createdAt: 100 },
      ]);

      const store = new OrchestratorStore();
      const events = createEvents();
      const orch: any = {
        events,
        getUseProxy: () => false,
        getProxyUrl: () => "",
        getGitProxyUrl: () => "",
        getVMBashFullInternetAccess: () => false,
        getTaskServerUrl: () => "/schedule",
        taskServerEnabled: true,
      };

      await store.init({} as any, orch);

      expect(store.activeGroupId).toBe("br:restored");
      expect(store.groups).toEqual([
        { groupId: "br:main", name: "Main", createdAt: 0 },
        { groupId: "br:restored", name: "Restored", createdAt: 100 },
      ]);
    });

    it("thinking-log events are scoped to active conversation", async () => {
      const store = new OrchestratorStore();
      const events = createEvents();
      const orch: any = {
        events,
        getUseProxy: () => false,
        getProxyUrl: () => "",
        getGitProxyUrl: () => "",
        getVMBashFullInternetAccess: () => false,
        getTaskServerUrl: () => "/schedule",
        taskServerEnabled: true,
      };

      await store.init({} as any, orch);

      // Log entry for the active group should be recorded
      events.emit("thinking-log", {
        groupId: DEFAULT_GROUP_ID,
        level: "info",
        label: "Starting",
        message: "active conversation log",
      });
      expect(store.activityLog).toHaveLength(1);

      events.emit("thinking-log", {
        groupId: DEFAULT_GROUP_ID,
        level: "api-call",
        label: "API call #1",
        message: "5 messages",
      });
      expect(store.activityLog).toHaveLength(2);

      // Log entry for a DIFFERENT group should NOT be recorded
      events.emit("thinking-log", {
        groupId: "br:other",
        level: "tool-result",
        label: "Result: javascript",
        message: "sprint data from other conversation",
      });
      expect(store.activityLog).toHaveLength(2); // unchanged
    });

    it("loadHistory guards against stale activeGroupId after async resolve", async () => {
      const store: any = new OrchestratorStore();
      const events = createEvents();
      const orch: any = {
        events,
        getUseProxy: () => false,
        getProxyUrl: () => "",
        getGitProxyUrl: () => "",
        getVMBashFullInternetAccess: () => false,
        getTaskServerUrl: () => "/schedule",
        taskServerEnabled: true,
      };

      await store.init({} as any, orch);

      // Simulate slow DB query — resolves after group switch
      let resolveSlowQuery: any;
      (mockGetRecentMessages as any).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSlowQuery = resolve;
          }),
      );

      // Start loading history for group B
      store._activeGroupId.set("br:groupB");
      const loadPromise = store.loadHistory();

      // User switches to group C before load completes
      store._activeGroupId.set("br:groupC");

      store._messages.set([{ id: "c1", content: "group C message" }]);

      // Slow query for group B resolves
      resolveSlowQuery([{ id: "b1", content: "group B message" }]);
      await loadPromise;

      // Messages should NOT be overwritten with group B data
      // since the user is now viewing group C
      expect(store.messages).toEqual([
        { id: "c1", content: "group C message" },
      ]);
    });

    it("context-compacted only reloads if groupId matches active conversation", async () => {
      const store: any = new OrchestratorStore();
      const events = createEvents();
      const orch: any = {
        events,
        getUseProxy: () => false,
        getProxyUrl: () => "",
        getGitProxyUrl: () => "",
        getVMBashFullInternetAccess: () => false,
        getTaskServerUrl: () => "/schedule",
        taskServerEnabled: true,
      };

      jest.spyOn(store, "loadHistory").mockResolvedValue(undefined);
      jest.spyOn(store, "loadTasks").mockResolvedValue(undefined);
      jest.spyOn(store, "loadFiles").mockResolvedValue(undefined);

      await store.init({} as any, orch);

      store.loadHistory.mockClear();

      // Compaction completed for the ACTIVE group — should reload
      events.emit("context-compacted", { groupId: DEFAULT_GROUP_ID });
      expect(store.loadHistory).toHaveBeenCalledTimes(1);

      store.loadHistory.mockClear();

      // Compaction completed for a DIFFERENT group — should NOT reload
      events.emit("context-compacted", { groupId: "br:other" });
      expect(store.loadHistory).not.toHaveBeenCalled();
    });

    it("reorderConversations saves new order and reloads groups", async () => {
      const store = new OrchestratorStore();
      jest.spyOn(store, "loadGroups").mockResolvedValue(undefined);

      (mockReorderGroups as any).mockResolvedValue(undefined);

      await store.reorderConversations({} as any, ["br:b", "br:a"]);

      expect(mockReorderGroups).toHaveBeenCalledWith({} as any, [
        "br:b",
        "br:a",
      ]);
      expect(store.loadGroups).toHaveBeenCalled();
    });

    it("cloneConversation clones metadata + messages + tasks + MEMORY.md and switches to clone", async () => {
      const clonedGroup: any = {
        groupId: "br:clone1",
        name: "Main (copy)",
        createdAt: 5000,
        toolTags: ["bash", "fetch_url"],
      };

      (mockCloneGroup as any).mockResolvedValue(clonedGroup);

      (mockCloneGroupMessages as any).mockResolvedValue(3);

      (mockCloneGroupTasks as any).mockResolvedValue(2);

      (mockReadGroupFile as any).mockResolvedValue("# Memory\nSome notes");

      (mockWriteGroupFile as any).mockResolvedValue(undefined);
      (mockCopyGroupDirectory as any).mockResolvedValue(undefined);

      const store = new OrchestratorStore();
      jest.spyOn(store, "loadHistory").mockResolvedValue(undefined);
      jest.spyOn(store, "loadTasks").mockResolvedValue(undefined);
      jest.spyOn(store, "loadFiles").mockResolvedValue(undefined);
      jest.spyOn(store, "loadGroups").mockResolvedValue(undefined);

      const result = await store.cloneConversation({} as any, "br:main");

      expect(result).toEqual(clonedGroup);
      expect(mockCloneGroup).toHaveBeenCalledWith({} as any, "br:main");
      expect(mockCloneGroupMessages).toHaveBeenCalledWith(
        {},
        "br:main",
        "br:clone1",
      );
      expect(mockCloneGroupTasks).toHaveBeenCalledWith(
        {},
        "br:main",
        "br:clone1",
      );
      expect(mockReadGroupFile).toHaveBeenCalledWith(
        {},
        "br:main",
        "MEMORY.md",
      );
      expect(mockWriteGroupFile).toHaveBeenCalledWith(
        {},
        "br:clone1",
        "MEMORY.md",
        "# Memory\nSome notes",
      );
      expect(mockCopyGroupDirectory).toHaveBeenCalledWith(
        {},
        "br:main",
        "br:clone1",
        "attachments",
      );
      expect(store.activeGroupId).toBe("br:clone1");
    });

    it("cloneConversation succeeds when source has no MEMORY.md", async () => {
      const clonedGroup: any = {
        groupId: "br:clone2",
        name: "Chat (copy)",
        createdAt: 6000,
      };

      (mockCloneGroup as any).mockResolvedValue(clonedGroup);

      (mockCloneGroupMessages as any).mockResolvedValue(1);

      (mockCloneGroupTasks as any).mockResolvedValue(0);

      (mockReadGroupFile as any).mockRejectedValue(new Error("file not found"));
      (mockCopyGroupDirectory as any).mockRejectedValue(
        new Error("directory not found"),
      );

      const store = new OrchestratorStore();
      jest.spyOn(store, "loadHistory").mockResolvedValue(undefined);
      jest.spyOn(store, "loadTasks").mockResolvedValue(undefined);
      jest.spyOn(store, "loadFiles").mockResolvedValue(undefined);
      jest.spyOn(store, "loadGroups").mockResolvedValue(undefined);

      const result = await store.cloneConversation({} as any, "br:src");

      expect(result).toEqual(clonedGroup);
      expect(mockWriteGroupFile).not.toHaveBeenCalled();
      expect(store.activeGroupId).toBe("br:clone2");
    });

    it("cloneConversation returns null if source not found", async () => {
      (mockCloneGroup as any).mockResolvedValue(null);

      const store = new OrchestratorStore();

      const result = await store.cloneConversation({} as any, "br:nonexistent");

      expect(result).toBeNull();
      expect(mockCloneGroupMessages).not.toHaveBeenCalled();
    });
  });

  describe("unread message tracking", () => {
    it("starts with empty unread set", () => {
      const store = new OrchestratorStore();
      expect(store.unreadGroupIds).toEqual(new Set());
    });

    it("marks group as unread when message arrives for non-active group", async () => {
      const store = new OrchestratorStore();
      const events = createEvents();
      const orch: any = {
        events,
        getUseProxy: jest.fn().mockReturnValue(false),
        getProxyUrl: jest.fn().mockReturnValue(""),
        getGitProxyUrl: jest.fn().mockReturnValue(""),
        getVMBashFullInternetAccess: jest.fn().mockReturnValue(false),
        getTaskServerUrl: jest.fn().mockReturnValue("/schedule"),
        taskServerEnabled: true,
      };

      await store.init({} as any, orch);

      // Message for a different group
      events.emit("message", {
        id: "m-other",
        groupId: "br:other",
        role: "assistant",
        isFromMe: false,
      });

      expect(store.unreadGroupIds).toEqual(new Set(["br:other"]));
    });

    it("does not mark active group as unread", async () => {
      const store = new OrchestratorStore();
      const events = createEvents();
      const orch: any = {
        events,
        getUseProxy: jest.fn().mockReturnValue(false),
        getProxyUrl: jest.fn().mockReturnValue(""),
        getGitProxyUrl: jest.fn().mockReturnValue(""),
        getVMBashFullInternetAccess: jest.fn().mockReturnValue(false),
        getTaskServerUrl: jest.fn().mockReturnValue("/schedule"),
        taskServerEnabled: true,
      };

      await store.init({} as any, orch);

      // Message for the active group
      events.emit("message", {
        id: "m-active",
        groupId: DEFAULT_GROUP_ID,
        role: "assistant",
        isFromMe: false,
      });

      expect(store.unreadGroupIds).toEqual(new Set());
    });

    it("clears unread when switching to that conversation in chat", async () => {
      const store = new OrchestratorStore();
      const events = createEvents();
      const orch: any = {
        events,
        getUseProxy: jest.fn().mockReturnValue(false),
        getProxyUrl: jest.fn().mockReturnValue(""),
        getGitProxyUrl: jest.fn().mockReturnValue(""),
        getVMBashFullInternetAccess: jest.fn().mockReturnValue(false),
        getTaskServerUrl: jest.fn().mockReturnValue("/schedule"),
        taskServerEnabled: true,
      };

      jest.spyOn(store, "loadHistory").mockResolvedValue(undefined);
      jest.spyOn(store, "loadTasks").mockResolvedValue(undefined);
      jest.spyOn(store, "loadFiles").mockResolvedValue(undefined);

      await store.init({} as any, orch);

      store._activePage.set("chat");

      // Mark br:other as unread
      events.emit("message", {
        id: "m-other",
        groupId: "br:other",
        role: "assistant",
        isFromMe: false,
      });
      expect(store.unreadGroupIds).toEqual(new Set(["br:other"]));

      // Switch to br:other
      store.setActiveGroup({} as any, "br:other");
      expect(store.unreadGroupIds).toEqual(new Set());
    });

    it("preserves unread when switching conversations outside chat", async () => {
      const store = new OrchestratorStore();
      const events = createEvents();
      const orch: any = {
        events,
        getUseProxy: jest.fn().mockReturnValue(false),
        getProxyUrl: jest.fn().mockReturnValue(""),
        getGitProxyUrl: jest.fn().mockReturnValue(""),
        getVMBashFullInternetAccess: jest.fn().mockReturnValue(false),
        getTaskServerUrl: jest.fn().mockReturnValue("/schedule"),
        taskServerEnabled: true,
      };

      jest.spyOn(store, "loadHistory").mockResolvedValue(undefined);
      jest.spyOn(store, "loadTasks").mockResolvedValue(undefined);
      jest.spyOn(store, "loadFiles").mockResolvedValue(undefined);

      await store.init({} as any, orch);

      store._activePage.set("files");

      events.emit("message", {
        id: "m-other",
        groupId: "br:other",
        role: "assistant",
        isFromMe: false,
      });
      expect(store.unreadGroupIds).toEqual(new Set(["br:other"]));

      store.setActiveGroup({} as any, "br:other");
      expect(store.unreadGroupIds).toEqual(new Set(["br:other"]));
    });

    it("tracks multiple unread groups", async () => {
      const store = new OrchestratorStore();
      const events = createEvents();
      const orch: any = {
        events,
        getUseProxy: jest.fn().mockReturnValue(false),
        getProxyUrl: jest.fn().mockReturnValue(""),
        getGitProxyUrl: jest.fn().mockReturnValue(""),
        getVMBashFullInternetAccess: jest.fn().mockReturnValue(false),
        getTaskServerUrl: jest.fn().mockReturnValue("/schedule"),
        taskServerEnabled: true,
      };

      await store.init({} as any, orch);

      events.emit("message", {
        id: "m1",
        groupId: "br:other1",
        role: "assistant",
        isFromMe: false,
      });
      events.emit("message", {
        id: "m2",
        groupId: "br:other2",
        role: "assistant",
        isFromMe: false,
      });

      expect(store.unreadGroupIds).toEqual(new Set(["br:other1", "br:other2"]));
    });

    it("only clears the group being switched to, not all unread", async () => {
      const store = new OrchestratorStore();
      const events = createEvents();
      const orch: any = {
        events,
        getUseProxy: () => false,
        getProxyUrl: () => "",
        getGitProxyUrl: () => "",
        getVMBashFullInternetAccess: () => false,
        getTaskServerUrl: () => "/schedule",
        taskServerEnabled: true,
      };

      jest.spyOn(store, "loadHistory").mockResolvedValue(undefined);
      jest.spyOn(store, "loadTasks").mockResolvedValue(undefined);
      jest.spyOn(store, "loadFiles").mockResolvedValue(undefined);

      await store.init({} as any, orch);

      store._activePage.set("chat");

      events.emit("message", {
        id: "m1",
        groupId: "br:other1",
        role: "assistant",
        isFromMe: false,
      });
      events.emit("message", {
        id: "m2",
        groupId: "br:other2",
        role: "assistant",
        isFromMe: false,
      });

      store.setActiveGroup({} as any, "br:other1");
      expect(store.unreadGroupIds).toEqual(new Set(["br:other2"]));
    });
  });

  describe("activePinnedPage", () => {
    it("persists activePinnedPage when set", async () => {
      const store = new OrchestratorStore();
      const mockPage = { groupId: "br:main", path: "MEMORY.md" };

      await store.setActivePinnedPage({} as any, mockPage);

      expect(store.activePinnedPage).toEqual(mockPage);
      expect(mockSetConfig).toHaveBeenCalledWith(
        {} as any,
        "last_selected_pinned_page",
        JSON.stringify(mockPage),
      );

      await store.setActivePinnedPage({} as any, null);
      expect(store.activePinnedPage).toBeNull();
      expect(mockSetConfig).toHaveBeenLastCalledWith(
        {} as any,
        "last_selected_pinned_page",
        null,
      );
    });

    it("restores activePinnedPage on initialization", async () => {
      const store = new OrchestratorStore();
      const mockPage = { groupId: "br:main", path: "MEMORY.md" };

      (mockGetConfig as any).mockImplementation(
        async (_db: any, key: string) => {
          if (key === "last_selected_pinned_page") {
            return JSON.stringify(mockPage);
          }

          return undefined;
        },
      );

      const events = createEvents();
      const orch: any = {
        events,
        getUseProxy: () => false,
        getProxyUrl: () => "",
        getGitProxyUrl: () => "",
        getVMBashFullInternetAccess: () => false,
        getTaskServerUrl: () => "/schedule",
        taskServerEnabled: true,
      };

      await store.init({} as any, orch);

      expect(store.activePinnedPage).toEqual(mockPage);
    });

    it("schedules background static main site seeding without blocking init", async () => {
      const store = new OrchestratorStore();
      const spy = jest
        .spyOn(store, "scheduleBackgroundStaticMainSiteSeeding")
        .mockImplementation(() => {});

      const events = createEvents();
      const orch: any = {
        events,
        getUseProxy: () => false,
        getProxyUrl: () => "",
        getGitProxyUrl: () => "",
        getVMBashFullInternetAccess: () => false,
        getTaskServerUrl: () => "/schedule",
        taskServerEnabled: true,
      };

      await store.init({} as any, orch);

      expect(spy).toHaveBeenCalledWith({} as any);
    });

    it("applies declarative and built-in tool names from site-config to toolsStore without setting group toolTags", async () => {
      const store = new OrchestratorStore();
      const events = createEvents();
      const orch: any = {
        events,
        getUseProxy: () => false,
        getProxyUrl: () => "",
        getGitProxyUrl: () => "",
        getVMBashFullInternetAccess: () => false,
        getTaskServerUrl: () => "/schedule",
        taskServerEnabled: true,
      };

      const { toolsStore } = await import("./tools.js");
      const setAllEnabledSpy = jest
        .spyOn(toolsStore, "setAllEnabled")
        .mockImplementation(async () => {});
      const setAllDeclarativeEnabledSpy = jest
        .spyOn(toolsStore, "setAllDeclarativeEnabled")
        .mockImplementation(async () => {});

      const configElement = document.createElement("script");
      configElement.id = "shadow-claw-site-config";
      configElement.type = "application/json";
      configElement.textContent = JSON.stringify({
        settings: {
          defaultToolsProfile: "none",
        },
        enabledTools: ["pwgen", "pwgen_help", "pwgen_entropy"],
      });
      document.head.appendChild(configElement);

      try {
        await store.init({} as any, orch);
        expect(setAllEnabledSpy).toHaveBeenCalledWith({} as any, [
          "pwgen",
          "pwgen_help",
          "pwgen_entropy",
        ]);
        expect(setAllDeclarativeEnabledSpy).toHaveBeenCalledWith({} as any, [
          "pwgen",
          "pwgen_help",
          "pwgen_entropy",
        ]);
      } finally {
        configElement.remove();
        setAllEnabledSpy.mockRestore();
        setAllDeclarativeEnabledSpy.mockRestore();
      }
    });

    it("clears legacy group-level toolTags on DEFAULT_GROUP_ID if present", async () => {
      const store = new OrchestratorStore();
      const events = createEvents();
      const orch: any = {
        events,
        getUseProxy: () => false,
        getProxyUrl: () => "",
        getGitProxyUrl: () => "",
        getVMBashFullInternetAccess: () => false,
        getTaskServerUrl: () => "/schedule",
        taskServerEnabled: true,
      };

      const configElement = document.createElement("script");
      configElement.id = "shadow-claw-site-config";
      configElement.type = "application/json";
      configElement.textContent = JSON.stringify({});
      document.head.appendChild(configElement);

      mockListGroups.mockResolvedValue([
        { groupId: DEFAULT_GROUP_ID, name: "Main", toolTags: ["old_tool"] },
      ]);

      try {
        await store.init({} as any, orch);
        expect(mockUpdateGroupToolTags).toHaveBeenCalledWith(
          {} as any,
          DEFAULT_GROUP_ID,
          undefined,
        );
      } finally {
        configElement.remove();
      }
    });

    it("handles sendMessage with and without a2uiAction", async () => {
      const store = new OrchestratorStore();
      const mockSubmit = jest.fn();
      const orch: any = {
        browserChat: { submit: mockSubmit },
        events: createEvents(),
      };
      await store.init({} as any, orch);

      store.sendMessage("plain message", []);
      expect(mockSubmit).toHaveBeenCalledWith(
        "plain message",
        DEFAULT_GROUP_ID,
        [],
      );

      const action = {
        actionId: "btn-click",
        surfaceId: "surf-1",
        componentId: "btn-1",
      };
      store.sendMessage("action message", [], action as any);
      expect(mockSubmit).toHaveBeenCalledWith(
        "action message",
        DEFAULT_GROUP_ID,
        [],
        action,
      );
    });

    it("manages remote agent status, typing status, and ready state", () => {
      const store = new OrchestratorStore();
      expect(store.ready).toBe(false);

      store.setReady(true);
      expect(store.ready).toBe(true);

      store.setRemoteAgentStatus("peer:agent-1", "running" as any);
      expect(store._remoteAgentStatusByGroup.get().get("peer:agent-1")).toBe(
        "running",
      );

      store.setRemoteAgentTyping("peer:agent-1", true);
      expect(store._remoteAgentTypingByGroup.get().get("peer:agent-1")).toBe(
        true,
      );

      store.setRemoteAgentTyping("peer:agent-1", false);
      expect(
        store._remoteAgentTypingByGroup.get().get("peer:agent-1"),
      ).toBeUndefined();
    });

    it("handles folder navigation and proxy/network settings", async () => {
      const store = new OrchestratorStore();
      const mockDb: any = {};
      const orch: any = {
        browserChat: { submit: jest.fn() },
        events: createEvents(),
      };
      await store.init(mockDb, orch);

      // 1. Folder navigation
      await store.navigateIntoFolder(mockDb, "docs");
      expect(store.currentPath).toBe("docs");

      await store.navigateIntoFolder(mockDb, "sub");
      expect(store.currentPath).toBe("docs/sub");

      await store.navigateBackFolder(mockDb);
      expect(store.currentPath).toBe("docs");

      await store.resetToRootFolder(mockDb);
      expect(store.currentPath).toBe(".");

      // 2. Proxy & network settings
      await store.setGitProxyUrl(mockDb, "https://git-proxy.example.com");
      expect(store.gitProxyUrl).toBe("https://git-proxy.example.com");

      await store.setProxyUrl(mockDb, "https://proxy.example.com");
      expect(store.proxyUrl).toBe("https://proxy.example.com");

      await store.setUseProxy(mockDb, true);
      expect(store.useProxy).toBe(true);

      await store.setVMBashFullInternetAccess(mockDb, true);
      expect(store.vmBashFullInternetAccess).toBe(true);
    });

    it("handles task management helpers (clearAllTasks, restoreTasksFromBackup, toggleTask)", async () => {
      const store = new OrchestratorStore();
      const mockDb: any = {};
      const orch: any = {
        browserChat: { submit: jest.fn() },
        events: createEvents(),
      };
      await store.init(mockDb, orch);

      const task: any = {
        id: "task-123",
        groupId: DEFAULT_GROUP_ID,
        name: "Test Task",
        enabled: true,
      };
      mockGetAllTasks.mockResolvedValue([task]);
      await store.loadTasks(mockDb);
      expect(store.tasks.length).toBe(1);

      // 1. toggleTask
      mockGetAllTasks.mockResolvedValue([{ ...task, enabled: false }]);
      await store.toggleTask(mockDb, task, false);
      expect(store.tasks.find((t) => t.id === "task-123")?.enabled).toBe(false);

      // 2. restoreTasksFromBackup
      mockGetAllTasks.mockResolvedValue([
        task,
        {
          id: "task-new",
          groupId: DEFAULT_GROUP_ID,
          name: "New Task",
          enabled: true,
        },
      ]);
      await store.restoreTasksFromBackup(mockDb, [
        { id: "task-new", name: "New Task", enabled: true } as any,
      ]);
      expect(store.tasks.some((t) => t.id === "task-new")).toBe(true);

      // 3. clearAllTasks
      mockGetAllTasks.mockResolvedValue([]);
      await store.clearAllTasks(mockDb);
      expect(store.tasks).toEqual([]);
    });
  });
});
