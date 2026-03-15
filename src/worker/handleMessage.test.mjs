import { jest } from "@jest/globals";

describe("handleMessage.mjs", () => {
  let handleMessage;
  let mockHandleCompact;
  let mockHandleInvoke;
  let mockOpenDatabase;
  let mockPendingTasks;
  let mockSetStorageRoot;
  let mockBootVM;
  let mockAttachTerminalWorkspaceAutoSync;
  let mockCreateTerminalSession;
  let mockFlushVMWorkspaceToHost;
  let mockGetVMStatus;
  let mockGetVMBootModePreference;
  let mockPost;
  let mockSetVMBootHostPreference;
  let mockSetVMBootModePreference;
  let mockSetVMNetworkRelayURLPreference;
  let mockShutdownVM;
  let mockSubscribeVMBootOutput;
  let mockSyncVMWorkspaceFromHost;

  beforeEach(async () => {
    jest.resetModules();

    mockHandleCompact = jest.fn();
    mockHandleInvoke = jest.fn();
    mockOpenDatabase = jest.fn();
    mockPendingTasks = new Map();
    mockSetStorageRoot = jest.fn();
    mockBootVM = jest.fn();
    mockAttachTerminalWorkspaceAutoSync = jest.fn();
    mockCreateTerminalSession = jest.fn();
    mockFlushVMWorkspaceToHost = jest.fn().mockResolvedValue(undefined);
    mockGetVMStatus = jest.fn();
    mockGetVMBootModePreference = jest.fn(() => "disabled");
    mockPost = jest.fn();
    mockSetVMBootHostPreference = jest.fn();
    mockSetVMBootModePreference = jest.fn();
    mockSetVMNetworkRelayURLPreference = jest.fn();
    mockShutdownVM = jest.fn();
    mockSubscribeVMBootOutput = jest.fn(() => jest.fn());
    mockSyncVMWorkspaceFromHost = jest.fn().mockResolvedValue(undefined);

    jest.unstable_mockModule("../db/openDatabase.mjs", () => ({
      openDatabase: mockOpenDatabase,
    }));

    jest.unstable_mockModule("../storage/storage.mjs", () => ({
      setStorageRoot: mockSetStorageRoot,
    }));

    jest.unstable_mockModule("../vm.mjs", () => ({
      attachTerminalWorkspaceAutoSync: mockAttachTerminalWorkspaceAutoSync,
      bootVM: mockBootVM,
      createTerminalSession: mockCreateTerminalSession,
      flushVMWorkspaceToHost: mockFlushVMWorkspaceToHost,
      getVMBootModePreference: mockGetVMBootModePreference,
      getVMStatus: mockGetVMStatus,
      setVMBootHostPreference: mockSetVMBootHostPreference,
      setVMBootModePreference: mockSetVMBootModePreference,
      setVMNetworkRelayURLPreference: mockSetVMNetworkRelayURLPreference,
      subscribeVMBootOutput: mockSubscribeVMBootOutput,
      syncVMWorkspaceFromHost: mockSyncVMWorkspaceFromHost,
      shutdownVM: mockShutdownVM,
    }));

    jest.unstable_mockModule("./post.mjs", () => ({
      post: mockPost,
    }));

    jest.unstable_mockModule("./handleInvoke.mjs", () => ({
      handleInvoke: mockHandleInvoke,
    }));

    jest.unstable_mockModule("./handleCompact.mjs", () => ({
      handleCompact: mockHandleCompact,
    }));

    jest.unstable_mockModule("./pendingTasks.mjs", () => ({
      pendingTasks: mockPendingTasks,
    }));

    const module = await import("./handleMessage.mjs");
    handleMessage = module.handleMessage;
  });

  it("should dispatch invoke message", async () => {
    const db = {};
    mockOpenDatabase.mockResolvedValue(db);

    const event = {
      data: { type: "invoke", payload: { some: "data" } },
    };

    await handleMessage(event);

    expect(mockHandleInvoke).toHaveBeenCalledWith(
      db,
      { some: "data" },
      expect.any(Object),
    );
  });

  it("should dispatch compact message", async () => {
    const db = {};
    mockOpenDatabase.mockResolvedValue(db);

    const event = {
      data: { type: "compact", payload: { some: "data" } },
    };

    await handleMessage(event);

    expect(mockHandleCompact).toHaveBeenCalledWith(
      db,
      { some: "data" },
      expect.any(Object),
    );
  });

  it("should dispatch set-storage message", async () => {
    mockOpenDatabase.mockResolvedValue({});
    const event = {
      data: { type: "set-storage", payload: { storageHandle: "handle" } },
    };

    await handleMessage(event);

    expect(mockSetStorageRoot).toHaveBeenCalledWith("handle");
  });

  it("should handle task-list-response message", async () => {
    mockOpenDatabase.mockResolvedValue({});

    const resolve = jest.fn();
    mockPendingTasks.set("g1", resolve);

    const event = {
      data: {
        type: "task-list-response",
        payload: { groupId: "g1", tasks: ["t1"] },
      },
    };

    await handleMessage(event);

    expect(resolve).toHaveBeenCalledWith(["t1"]);

    expect(mockPendingTasks.has("g1")).toBe(false);
  });

  it("should handle database open failure", async () => {
    mockOpenDatabase.mockRejectedValue(new Error("db fail"));
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const event = {
      data: { type: "invoke", payload: {} },
    };

    await handleMessage(event);

    expect(consoleSpy).toHaveBeenCalledWith(
      "[Worker] Failed to open database:",
      expect.any(Error),
    );

    expect(mockHandleInvoke).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("should handle set-storage without storageHandle", async () => {
    mockOpenDatabase.mockResolvedValue({});
    const event = {
      data: { type: "set-storage", payload: {} },
    };

    await handleMessage(event);

    expect(mockSetStorageRoot).not.toHaveBeenCalled();
  });

  it("should handle task-list-response when no pending resolver exists", async () => {
    mockOpenDatabase.mockResolvedValue({});

    const event = {
      data: {
        type: "task-list-response",
        payload: { groupId: "unknown", tasks: [] },
      },
    };

    // Should not throw
    await expect(handleMessage(event)).resolves.toBeUndefined();
  });

  it("should handle set-vm-mode message", async () => {
    mockOpenDatabase.mockResolvedValue({});
    mockShutdownVM.mockResolvedValue(undefined);
    mockBootVM.mockResolvedValue(undefined);

    await handleMessage({
      data: { type: "set-vm-mode", payload: { mode: "9p" } },
    });

    expect(mockSetVMBootModePreference).toHaveBeenCalledWith("9p");

    expect(mockShutdownVM).toHaveBeenCalled();

    expect(mockBootVM).toHaveBeenCalled();
  });

  it("should not boot when vm mode is disabled", async () => {
    mockOpenDatabase.mockResolvedValue({});
    mockShutdownVM.mockResolvedValue(undefined);

    await handleMessage({
      data: { type: "set-vm-mode", payload: { mode: "disabled" } },
    });

    expect(mockSetVMBootModePreference).toHaveBeenCalledWith("disabled");

    expect(mockShutdownVM).toHaveBeenCalled();

    expect(mockBootVM).not.toHaveBeenCalled();
  });

  it("should apply relay and boot host preferences without mode", async () => {
    mockOpenDatabase.mockResolvedValue({});
    mockShutdownVM.mockResolvedValue(undefined);

    await handleMessage({
      data: {
        type: "set-vm-mode",
        payload: {
          bootHost: "https://example.com",
          networkRelayUrl: "wss://relay.example.com/",
        },
      },
    });

    expect(mockSetVMBootHostPreference).toHaveBeenCalledWith(
      "https://example.com",
    );

    expect(mockSetVMNetworkRelayURLPreference).toHaveBeenCalledWith(
      "wss://relay.example.com/",
    );

    expect(mockShutdownVM).toHaveBeenCalled();

    expect(mockBootVM).not.toHaveBeenCalled();
  });

  it("should open a worker-owned terminal session", async () => {
    const send = jest.fn();
    mockOpenDatabase.mockResolvedValue({});
    mockGetVMStatus.mockReturnValue({
      ready: true,
      booting: false,
      bootAttempted: true,
      error: null,
    });

    mockCreateTerminalSession.mockImplementation((onOutput) => {
      onOutput("booted\n");
      return { close: jest.fn(), send };
    });

    await handleMessage({
      data: { type: "vm-terminal-open" },
    });

    expect(mockCreateTerminalSession).toHaveBeenCalled();

    expect(mockPost).toHaveBeenCalledWith({
      type: "vm-terminal-output",
      payload: { chunk: "booted\n" },
    });

    expect(mockPost).toHaveBeenCalledWith({
      type: "vm-terminal-opened",
      payload: { ok: true },
    });
  });

  it("should not block terminal-opened on initial workspace sync", async () => {
    mockOpenDatabase.mockResolvedValue({});
    mockGetVMStatus.mockReturnValue({
      ready: true,
      booting: false,
      bootAttempted: true,
      error: null,
    });

    mockSyncVMWorkspaceFromHost.mockReturnValue(new Promise(() => {}));
    mockCreateTerminalSession.mockReturnValue({
      close: jest.fn(),
      send: jest.fn(),
    });

    await expect(
      handleMessage({
        data: { type: "vm-terminal-open" },
      }),
    ).resolves.toBeUndefined();

    expect(mockCreateTerminalSession).toHaveBeenCalled();

    expect(mockPost).toHaveBeenCalledWith({
      type: "vm-terminal-opened",
      payload: { ok: true },
    });
  });

  it("should show a warning toast when initial workspace sync fails", async () => {
    mockOpenDatabase.mockResolvedValue({});
    mockGetVMStatus.mockReturnValue({
      ready: true,
      booting: false,
      bootAttempted: true,
      error: null,
    });

    mockCreateTerminalSession.mockReturnValue({
      close: jest.fn(),
      send: jest.fn(),
    });

    mockSyncVMWorkspaceFromHost.mockRejectedValue(new Error("File not found"));

    await expect(
      handleMessage({
        data: { type: "vm-terminal-open" },
      }),
    ).resolves.toBeUndefined();

    // Allow the async catch handler to run.
    await Promise.resolve();

    expect(mockPost).toHaveBeenCalledWith({
      type: "show-toast",
      payload: {
        message:
          "WebVM terminal connected, but workspace sync failed. File changes may not appear until the next sync.",
        type: "warning",
        duration: 5000,
      },
    });
  });

  it("should forward terminal input to the active session", async () => {
    const send = jest.fn();
    const close = jest.fn();
    mockOpenDatabase.mockResolvedValue({});
    mockGetVMStatus.mockReturnValue({
      ready: true,
      booting: false,
      bootAttempted: true,
      error: null,
    });

    mockCreateTerminalSession.mockReturnValue({ close, send });

    await handleMessage({
      data: { type: "vm-terminal-open" },
    });

    await handleMessage({
      data: { type: "vm-terminal-input", payload: { data: "ls\n" } },
    });

    await handleMessage({
      data: { type: "vm-terminal-close" },
    });

    expect(send).toHaveBeenCalledWith("ls\n");

    expect(close).toHaveBeenCalled();

    expect(mockPost).toHaveBeenCalledWith({
      type: "vm-terminal-closed",
      payload: { ok: true },
    });
  });

  it("flushes guest workspace changes on terminal close without reseeding host files", async () => {
    const send = jest.fn();
    const close = jest.fn();
    const db = {};

    mockOpenDatabase.mockResolvedValue(db);
    mockGetVMStatus.mockReturnValue({
      ready: true,
      booting: false,
      bootAttempted: true,
      error: null,
    });

    mockCreateTerminalSession.mockReturnValue({ close, send });

    await handleMessage({
      data: { type: "vm-terminal-open", payload: { groupId: "g1" } },
    });

    await handleMessage({
      data: { type: "vm-terminal-close", payload: { groupId: "g1" } },
    });

    expect(mockFlushVMWorkspaceToHost).toHaveBeenCalledWith({
      db,
      groupId: "g1",
    });

    expect(mockSyncVMWorkspaceFromHost).toHaveBeenCalledTimes(1);
  });

  it("silently syncs host workspace into the VM on request", async () => {
    const db = {};

    mockOpenDatabase.mockResolvedValue(db);
    mockGetVMStatus.mockReturnValue({
      ready: true,
      booting: false,
      bootAttempted: true,
      error: null,
    });

    mockCreateTerminalSession.mockReturnValue({
      close: jest.fn(),
      send: jest.fn(),
    });

    await handleMessage({
      data: { type: "vm-terminal-open", payload: { groupId: "g1" } },
    });

    mockSyncVMWorkspaceFromHost.mockClear();
    mockPost.mockClear();

    await handleMessage({
      data: { type: "vm-workspace-sync", payload: { groupId: "g1" } },
    });

    expect(mockSyncVMWorkspaceFromHost).toHaveBeenCalledWith({
      db,
      groupId: "g1",
    });

    expect(mockPost).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "vm-workspace-synced" }),
    );
  });

  it("ignores silent host-to-vm sync requests without an active terminal session", async () => {
    mockOpenDatabase.mockResolvedValue({});

    await handleMessage({
      data: { type: "vm-workspace-sync", payload: { groupId: "g1" } },
    });

    expect(mockSyncVMWorkspaceFromHost).not.toHaveBeenCalled();
  });

  it("should handle cancel message type", async () => {
    mockOpenDatabase.mockResolvedValue({});
    let capturedSignal;

    mockHandleInvoke.mockImplementation(async (_, __, signal) => {
      capturedSignal = signal;
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const invokePromise = handleMessage({
      data: { type: "invoke", payload: { groupId: "g1" } },
    });

    const event = {
      data: { type: "cancel", payload: { groupId: "g1" } },
    };

    await Promise.resolve();

    await expect(handleMessage(event)).resolves.toBeUndefined();

    expect(capturedSignal).toBeDefined();

    expect(capturedSignal.aborted).toBe(true);

    await invokePromise;
  });
});
