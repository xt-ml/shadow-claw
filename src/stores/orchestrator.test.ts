import { jest } from "@jest/globals";

const mockDeleteTask = jest.fn() as any;
const mockGetAllTasks = jest.fn() as any;
const mockGetRecentMessages = jest.fn() as any;
const mockSaveTask = jest.fn() as any;
const mockListGroupFiles = jest.fn() as any;
const mockRequestStorageAccess = jest.fn() as any;
const mockGetStorageStatus = jest.fn() as any;
const mockShowError = jest.fn() as any;
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
const mockCopyGroupDirectory = jest.fn() as any;
const mockDeleteMessage = jest.fn() as any;

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

jest.unstable_mockModule("../storage/storage.js", () => ({
  getStorageStatus: mockGetStorageStatus,
}));

jest.unstable_mockModule("../toast.js", () => ({
  showError: mockShowError,
}));

jest.unstable_mockModule("../db/groups.js", () => ({
  listGroups: mockListGroups,
  createGroup: mockCreateGroup,
  renameGroup: mockRenameGroup,
  deleteGroupMetadata: mockDeleteGroupMetadata,
  reorderGroups: mockReorderGroups,
  cloneGroup: mockCloneGroup,
  saveGroupMetadata: mockSaveGroupMetadata,
  updateGroupToolTags: mockUpdateGroupToolTags,
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

jest.unstable_mockModule("../storage/copyGroupDirectory.js", () => ({
  copyGroupDirectory: mockCopyGroupDirectory,
}));

jest.unstable_mockModule("../db/deleteMessage.js", () => ({
  deleteMessage: mockDeleteMessage,
}));

const { OrchestratorStore } = await import("./orchestrator.js");
const { DEFAULT_GROUP_ID } = await import("../config.js");

function createEvents() {
  const handlers = new Map();

  return {
    on(type: any, callback: any) {
      handlers.set(type, callback);
    },
    emit(type: any, payload: any) {
      const handler = handlers.get(type);
      if (handler) {
        handler(payload);
      }
    },
  };
}

describe("OrchestratorStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockSaveGroupMetadata as any).mockResolvedValue(undefined);

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
      content: "@k9 hello",
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

    events.emit("token-usage", { input: 3, output: 4, total: 7 });

    expect(store.tokenUsage).toEqual({ input: 3, output: 4, total: 7 });

    events.emit("session-reset");

    expect(store.messages).toEqual([]);

    expect(store.activityLog).toEqual([]);

    expect(store.tokenUsage).toBeNull();

    expect(store.isTyping).toBe(false);

    expect(store.modelDownloadProgress).toBeNull();

    expect(store.state).toBe("idle");
  });

  it("forwards thinking-log entries to server when activity disk logging is enabled", async () => {
    const store = new OrchestratorStore();
    const events: any = createEvents();
    const orch: any = {
      events,
      getUseProxy: () => false,
      getProxyUrl: () => "",
      getGitProxyUrl: () => "",
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

  it("sendMessage uses active group", () => {
    const store = new OrchestratorStore();

    store.orchestrator = { submitMessage: jest.fn() } as any;

    store.sendMessage("hello");

    expect((store.orchestrator as any).submitMessage).toHaveBeenCalledWith(
      "hello",
      DEFAULT_GROUP_ID,
      [],
    );
  });

  it("runTask sends prompt for non-script tasks", () => {
    const store: any = new OrchestratorStore();
    const sendSpy = jest
      .spyOn(store, "sendMessage")
      .mockImplementation(() => {});

    store.runTask({ id: "t1", prompt: "do work" });

    expect(sendSpy).toHaveBeenCalledWith("do work");
  });

  it("newSession and compactContext call orchestrator methods", async () => {
    const store = new OrchestratorStore();

    const newSession = (jest.fn() as any).mockResolvedValue(undefined);

    const compactContext = (jest.fn() as any).mockResolvedValue("ok");

    store.orchestrator = { newSession, compactContext } as any;

    const loadSpy = jest
      .spyOn(store, "loadHistory")
      .mockResolvedValue(undefined);

    (await store.newSession({} as any)) as any;

    expect(newSession).toHaveBeenCalledWith({} as any, DEFAULT_GROUP_ID);

    expect(loadSpy).toHaveBeenCalled();

    await expect(store.compactContext({} as any) as any).resolves.toBe("ok");

    expect(compactContext).toHaveBeenCalledWith({} as any, DEFAULT_GROUP_ID);
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
      getTaskServerUrl: () => "/schedule",
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
      "/schedule/tasks/queued-1",
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

    (mockGetAllTasks as any).mockResolvedValueOnce([]);

    (global as any).fetch = (jest.fn() as any).mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: "task-1",
          group_id: DEFAULT_GROUP_ID,
          schedule: "*/5 * * * *",
          prompt: "Frequent task",

          enabled: 1,
          last_run: null,
          created_at: 1700000000000,
        },
      ],
    });

    await store.loadTasks({} as any);

    expect(mockSaveTask).toHaveBeenCalledWith(
      {} as any,
      expect.objectContaining({
        id: "task-1",
        groupId: DEFAULT_GROUP_ID,
        schedule: "*/5 * * * *",
        prompt: "Frequent task",
      }),
    );
    expect(store.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "task-1",
          groupId: DEFAULT_GROUP_ID,
        }),
      ]),
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

    store.orchestrator = {
      syncTerminalWorkspace: jest.fn() as any,
      flushTerminalWorkspace: jest.fn() as any,
    } as any;

    store.syncHostWorkspaceToVM();
    store.syncVMWorkspaceToHost();

    expect(
      (store.orchestrator as any).syncTerminalWorkspace,
    ).toHaveBeenCalledWith(DEFAULT_GROUP_ID);

    expect(
      (store.orchestrator as any).flushTerminalWorkspace,
    ).toHaveBeenCalledWith(DEFAULT_GROUP_ID);
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
        getTaskServerUrl: () => "/schedule",
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
        getTaskServerUrl: () => "/schedule",
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
        getTaskServerUrl: () => "/schedule",
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
        getTaskServerUrl: () => "/schedule",
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
        getTaskServerUrl: () => "/schedule",
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

      await store.switchConversation({} as any, "br:other");

      expect(store.activeGroupId).toBe("br:other");
      expect(mockSetConfig).toHaveBeenCalledWith(
        {},
        "last_active_group",
        "br:other",
      );
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
        getTaskServerUrl: () => "/schedule",
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
        getTaskServerUrl: () => "/schedule",
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
        getTaskServerUrl: () => "/schedule",
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
        getTaskServerUrl: () => "/schedule",
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
        getTaskServerUrl: jest.fn().mockReturnValue("/schedule"),
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
        getTaskServerUrl: jest.fn().mockReturnValue("/schedule"),
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

    it("clears unread when switching to that conversation", async () => {
      const store = new OrchestratorStore();
      const events = createEvents();
      const orch: any = {
        events,
        getUseProxy: jest.fn().mockReturnValue(false),
        getProxyUrl: jest.fn().mockReturnValue(""),
        getGitProxyUrl: jest.fn().mockReturnValue(""),
        getTaskServerUrl: jest.fn().mockReturnValue("/schedule"),
      };

      jest.spyOn(store, "loadHistory").mockResolvedValue(undefined);
      jest.spyOn(store, "loadTasks").mockResolvedValue(undefined);
      jest.spyOn(store, "loadFiles").mockResolvedValue(undefined);

      await store.init({} as any, orch);

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

    it("tracks multiple unread groups", async () => {
      const store = new OrchestratorStore();
      const events = createEvents();
      const orch: any = {
        events,
        getUseProxy: jest.fn().mockReturnValue(false),
        getProxyUrl: jest.fn().mockReturnValue(""),
        getGitProxyUrl: jest.fn().mockReturnValue(""),
        getTaskServerUrl: jest.fn().mockReturnValue("/schedule"),
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
        getTaskServerUrl: () => "/schedule",
      };

      jest.spyOn(store, "loadHistory").mockResolvedValue(undefined);
      jest.spyOn(store, "loadTasks").mockResolvedValue(undefined);
      jest.spyOn(store, "loadFiles").mockResolvedValue(undefined);

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

      store.setActiveGroup({} as any, "br:other1");
      expect(store.unreadGroupIds).toEqual(new Set(["br:other2"]));
    });
  });
});
