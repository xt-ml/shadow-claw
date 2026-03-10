import { jest } from "@jest/globals";

const mockDeleteTask = jest.fn();
const mockGetAllTasks = jest.fn();
const mockGetRecentMessages = jest.fn();
const mockSaveTask = jest.fn();
const mockListGroupFiles = jest.fn();
const mockRequestStorageAccess = jest.fn();
const mockGetStorageStatus = jest.fn();
const mockShowError = jest.fn();

jest.unstable_mockModule("../db/deleteTask.mjs", () => ({
  deleteTask: mockDeleteTask,
}));

jest.unstable_mockModule("../db/getAllTasks.mjs", () => ({
  getAllTasks: mockGetAllTasks,
}));

jest.unstable_mockModule("../db/getRecentMessages.mjs", () => ({
  getRecentMessages: mockGetRecentMessages,
}));

jest.unstable_mockModule("../db/saveTask.mjs", () => ({
  saveTask: mockSaveTask,
}));

jest.unstable_mockModule("../storage/listGroupFiles.mjs", () => ({
  listGroupFiles: mockListGroupFiles,
}));

jest.unstable_mockModule("../storage/requestStorageAccess.mjs", () => ({
  requestStorageAccess: mockRequestStorageAccess,
}));

jest.unstable_mockModule("../storage/storage.mjs", () => ({
  getStorageStatus: mockGetStorageStatus,
}));

jest.unstable_mockModule("../toast.mjs", () => ({
  showError: mockShowError,
}));

const { OrchestratorStore } = await import("./orchestrator.mjs");
const { DEFAULT_GROUP_ID } = await import("../config.mjs");

function createEvents() {
  const handlers = new Map();

  return {
    on(type, callback) {
      handlers.set(type, callback);
    },
    emit(type, payload) {
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

    mockGetRecentMessages.mockResolvedValue([{ id: "m1", role: "assistant" }]);
    mockGetAllTasks.mockResolvedValue([
      {
        id: "t-default",
        groupId: DEFAULT_GROUP_ID,
        enabled: true,
        prompt: "p",
      },
      { id: "t-other", groupId: "other", enabled: true, prompt: "q" },
    ]);
    mockGetStorageStatus.mockResolvedValue({ type: "opfs", name: "OPFS" });
    mockListGroupFiles.mockResolvedValue(["file.txt"]);
  });

  it("initializes from orchestrator and loads state", async () => {
    const store = new OrchestratorStore();
    const events = createEvents();
    const orch = { events };

    await store.init({}, orch);

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

  it("reacts to orchestrator events", async () => {
    const store = new OrchestratorStore();
    const events = createEvents();
    const orch = { events };

    await store.init({}, orch);

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
    expect(store.state).toBe("idle");
  });

  it("sendMessage uses active group", () => {
    const store = new OrchestratorStore();
    store.orchestrator = { submitMessage: jest.fn() };

    store.sendMessage("hello");

    expect(store.orchestrator.submitMessage).toHaveBeenCalledWith(
      "hello",
      DEFAULT_GROUP_ID,
    );
  });

  it("runTask executes scripts and reports script errors", () => {
    const store = new OrchestratorStore();
    globalThis.__taskRan = false;

    store.runTask({
      id: "s1",
      isScript: true,
      prompt: "globalThis.__taskRan = true;",
    });
    expect(globalThis.__taskRan).toBe(true);

    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    store.runTask({
      id: "s2",
      isScript: true,
      prompt: "throw new Error('bad script')",
    });
    expect(mockShowError).toHaveBeenCalledWith("Script Error: bad script");
    errorSpy.mockRestore();
  });

  it("runTask sends prompt for non-script tasks", () => {
    const store = new OrchestratorStore();
    const sendSpy = jest
      .spyOn(store, "sendMessage")
      .mockImplementation(() => {});

    store.runTask({ id: "t1", isScript: false, prompt: "do work" });

    expect(sendSpy).toHaveBeenCalledWith("do work");
  });

  it("newSession and compactContext call orchestrator methods", async () => {
    const store = new OrchestratorStore();
    const newSession = jest.fn().mockResolvedValue(undefined);
    const compactContext = jest.fn().mockResolvedValue("ok");
    store.orchestrator = { newSession, compactContext };

    const loadSpy = jest
      .spyOn(store, "loadHistory")
      .mockResolvedValue(undefined);

    await store.newSession({});
    expect(newSession).toHaveBeenCalledWith({}, DEFAULT_GROUP_ID);
    expect(loadSpy).toHaveBeenCalled();

    await expect(store.compactContext({})).resolves.toBe("ok");
    expect(compactContext).toHaveBeenCalledWith({}, DEFAULT_GROUP_ID);
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
    const store = new OrchestratorStore();
    const loadSpy = jest.spyOn(store, "loadTasks").mockResolvedValue(undefined);

    await store.toggleTask({}, { id: "t1", enabled: false }, true);
    expect(mockSaveTask).toHaveBeenCalledWith({}, { id: "t1", enabled: true });

    await store.deleteTask({}, "t1");
    expect(mockDeleteTask).toHaveBeenCalledWith({}, "t1");
    expect(loadSpy).toHaveBeenCalledTimes(2);
  });

  it("clearAllTasks deletes only tasks in active group", async () => {
    const store = new OrchestratorStore();
    const loadSpy = jest.spyOn(store, "loadTasks").mockResolvedValue(undefined);

    await store.clearAllTasks({});

    expect(mockDeleteTask).toHaveBeenCalledWith({}, "t-default");
    expect(mockDeleteTask).not.toHaveBeenCalledWith({}, "t-other");
    expect(loadSpy).toHaveBeenCalled();
  });

  it("restoreTasksFromBackup rewrites ids and group", async () => {
    const store = new OrchestratorStore();
    jest.spyOn(store, "clearAllTasks").mockResolvedValue(undefined);
    jest.spyOn(store, "loadTasks").mockResolvedValue(undefined);

    await store.restoreTasksFromBackup({}, [
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

    await store.loadFiles({});
    expect(store.files).toEqual(["file.txt"]);

    mockListGroupFiles.mockRejectedValueOnce(new Error("list failed"));
    await store.loadFiles({});
    expect(errorSpy).toHaveBeenCalledWith(
      "Failed to load files in store:",
      expect.any(Error),
    );

    const loadSpy = jest.spyOn(store, "loadFiles").mockResolvedValue(undefined);
    await store.grantStorageAccess({});
    expect(mockRequestStorageAccess).toHaveBeenCalledWith({});
    expect(loadSpy).toHaveBeenCalled();

    mockRequestStorageAccess.mockRejectedValueOnce(
      new Error("permission denied"),
    );
    await store.grantStorageAccess({});
    expect(errorSpy).toHaveBeenCalledWith(
      "Failed to grant storage access:",
      expect.any(Error),
    );

    errorSpy.mockRestore();
  });

  it("supports folder navigation and reset", async () => {
    const store = new OrchestratorStore();
    const loadSpy = jest.spyOn(store, "loadFiles").mockResolvedValue(undefined);

    await store.navigateIntoFolder({}, "dir/");
    expect(store.currentPath).toBe("dir");

    await store.navigateIntoFolder({}, "sub/");
    expect(store.currentPath).toBe("dir/sub");

    await store.navigateBackFolder({});
    expect(store.currentPath).toBe("dir");

    await store.navigateBackFolder({});
    expect(store.currentPath).toBe(".");

    await store.navigateBackFolder({});
    expect(store.currentPath).toBe(".");

    await store.resetToRootFolder({});
    expect(store.currentPath).toBe(".");
    expect(loadSpy).toHaveBeenCalled();
  });

  it("setActiveGroup resets transient state and reloads views", () => {
    const store = new OrchestratorStore();
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

    store.setActiveGroup({}, "group-2");

    expect(store.activeGroupId).toBe("group-2");
    expect(store.messages).toEqual([]);
    expect(store.activityLog).toEqual([]);
    expect(store.error).toBeNull();
    expect(store.isTyping).toBe(false);
    expect(store.toolActivity).toBeNull();
    expect(store.currentPath).toBe(".");
    expect(historySpy).toHaveBeenCalled();
    expect(taskSpy).toHaveBeenCalledWith({});
    expect(filesSpy).toHaveBeenCalledWith({});
  });

  it("returns a snapshot via getState and tasks backup", () => {
    const store = new OrchestratorStore();
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
});
