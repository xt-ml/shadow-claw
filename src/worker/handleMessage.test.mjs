import { jest } from "@jest/globals";

describe("handleMessage.mjs", () => {
  let handleMessage;
  let mockHandleCompact;
  let mockHandleInvoke;
  let mockOpenDatabase;
  let mockPendingTasks;
  let mockSetStorageRoot;

  beforeEach(async () => {
    jest.resetModules();

    mockHandleCompact = jest.fn();
    mockHandleInvoke = jest.fn();
    mockOpenDatabase = jest.fn();
    mockPendingTasks = new Map();
    mockSetStorageRoot = jest.fn();

    jest.unstable_mockModule("../db/openDatabase.mjs", () => ({
      openDatabase: mockOpenDatabase,
    }));

    jest.unstable_mockModule("../storage/storage.mjs", () => ({
      setStorageRoot: mockSetStorageRoot,
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

    expect(mockHandleInvoke).toHaveBeenCalledWith(db, { some: "data" });
  });

  it("should dispatch compact message", async () => {
    const db = {};
    mockOpenDatabase.mockResolvedValue(db);

    const event = {
      data: { type: "compact", payload: { some: "data" } },
    };

    await handleMessage(event);

    expect(mockHandleCompact).toHaveBeenCalledWith(db, { some: "data" });
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
});
