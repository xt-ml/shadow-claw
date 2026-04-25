import { jest } from "@jest/globals";

const setDB = jest.fn();

jest.unstable_mockModule("./db.js", () => ({
  setDB,
}));

jest.unstable_mockModule("../config.js", () => ({
  DB_NAME: "shadowclaw-test",
  DB_VERSION: 3,
}));

const { openDatabase } = await import("./openDatabase.js");

describe("openDatabase", () => {
  let originalIndexedDB;

  beforeEach(() => {
    jest.clearAllMocks();
    originalIndexedDB = (globalThis as any).indexedDB;
  });

  afterEach(() => {
    (globalThis as any).indexedDB = originalIndexedDB;
  });

  it("creates missing stores and indexes during upgrade", async () => {
    const msgStore: any = { createIndex: jest.fn() };
    const taskStore: any = { createIndex: jest.fn() };

    const database: any = {
      objectStoreNames: { contains: jest.fn(() => false) },
      createObjectStore: jest.fn((name) => {
        if (name === "messages") {
          return msgStore;
        }

        if (name === "tasks") {
          return taskStore;
        }

        return { createIndex: jest.fn() };
      }),
    };

    const request: any = { result: database, error: null };

    (globalThis as any).indexedDB = {
      open: jest.fn(() => request),
    };

    const promise = openDatabase();

    request.onupgradeneeded();

    request.onsuccess();

    const db = await promise;

    expect(db).toBe(database);

    expect(database.createObjectStore).toHaveBeenCalledWith("messages", {
      keyPath: "id",
    });

    expect(msgStore.createIndex).toHaveBeenCalledWith("by-group-time", [
      "groupId",
      "timestamp",
    ]);

    expect(msgStore.createIndex).toHaveBeenCalledWith("by-group", "groupId");

    expect(database.createObjectStore).toHaveBeenCalledWith("sessions", {
      keyPath: "groupId",
    });

    expect(database.createObjectStore).toHaveBeenCalledWith("tasks", {
      keyPath: "id",
    });

    expect(taskStore.createIndex).toHaveBeenCalledWith("by-group", "groupId");

    expect(taskStore.createIndex).toHaveBeenCalledWith("by-enabled", "enabled");

    expect(database.createObjectStore).toHaveBeenCalledWith("config", {
      keyPath: "key",
    });

    expect(setDB).toHaveBeenCalledWith(database);
  });

  it("skips creating stores that already exist", async () => {
    const database: any = {
      objectStoreNames: { contains: jest.fn(() => true) },
      createObjectStore: jest.fn(),
    };

    const request: any = { result: database, error: null };

    (globalThis as any).indexedDB = {
      open: jest.fn(() => request),
    };

    const promise = openDatabase();

    request.onupgradeneeded();

    request.onsuccess();

    await promise;

    expect(database.createObjectStore).not.toHaveBeenCalled();
  });

  it("rejects when IndexedDB open fails", async () => {
    const request: any = {
      result: null,
      error: { message: "boom" },
    };

    (globalThis as any).indexedDB = {
      open: jest.fn(() => request),
    };

    const promise = openDatabase();

    request.onerror();

    await expect(promise).rejects.toThrow("Failed to open IndexedDB: boom");
  });
});
