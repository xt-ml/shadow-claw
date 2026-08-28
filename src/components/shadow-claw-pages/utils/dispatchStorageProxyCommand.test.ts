import { jest } from "@jest/globals";
import {
  dispatchStorageProxyCommand,
  handleStorageProxyMessage,
} from "./dispatchStorageProxyCommand.js";

describe("dispatchStorageProxyCommand", () => {
  const pageKey = "test-page.md";

  it("dispatches setItem, removeItem, clear, and getAllItems operations", async () => {
    const mockStorage = {
      setItem: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      deleteItem: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      clear: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      getAll: jest.fn<() => Promise<unknown>>().mockResolvedValue({ a: "1" }),
      getItem: jest.fn<() => Promise<unknown>>().mockResolvedValue(null),
      putItem: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    };

    await dispatchStorageProxyCommand(
      "setItem",
      { key: "k1", value: "v1" },
      pageKey,
      mockStorage as any,
    );
    expect(mockStorage.setItem).toHaveBeenCalledWith(pageKey, "k1", "v1");

    await dispatchStorageProxyCommand(
      "removeItem",
      { key: "k1" },
      pageKey,
      mockStorage as any,
    );
    expect(mockStorage.deleteItem).toHaveBeenCalledWith(pageKey, "k1");

    await dispatchStorageProxyCommand("clear", {}, pageKey, mockStorage as any);
    expect(mockStorage.clear).toHaveBeenCalledWith(pageKey);

    const all = await dispatchStorageProxyCommand(
      "getAllItems",
      {},
      pageKey,
      mockStorage as any,
    );
    expect(all).toEqual({ a: "1" });
  });

  it("dispatches IndexedDB operations (idb-get, idb-put, idb-delete, idb-clear, idb-count)", async () => {
    const mockStorage = {
      setItem: jest.fn(),
      deleteItem: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      clear: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      getAll: jest
        .fn<() => Promise<unknown>>()
        .mockResolvedValue({ a: 1, b: 2, c: 3, d: 4, e: 5 }),
      getItem: jest.fn<() => Promise<unknown>>().mockResolvedValue({ id: 1 }),
      putItem: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    };

    const item = await dispatchStorageProxyCommand(
      "idb-get",
      { dbName: "db1", storeName: "s1", key: "1" },
      pageKey,
      mockStorage as any,
    );
    expect(item).toEqual({ id: 1 });
    expect(mockStorage.getItem).toHaveBeenCalledWith(
      "test-page.md::idb::db1::s1",
      "1",
    );

    const cnt = await dispatchStorageProxyCommand(
      "idb-count",
      { dbName: "db1", storeName: "s1" },
      pageKey,
      mockStorage as any,
    );
    expect(cnt).toBe(5);
  });

  it("posts success result back to source window in handleStorageProxyMessage", async () => {
    const mockSource = { postMessage: jest.fn() } as unknown as WindowProxy;
    const mockStorage = {
      setItem: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      deleteItem: jest.fn(),
      clear: jest.fn(),
      getAll: jest.fn(),
      getItem: jest.fn(),
      putItem: jest.fn(),
    };

    await handleStorageProxyMessage(
      mockSource,
      "req-123",
      "setItem",
      { key: "k", value: "v" },
      pageKey,
      mockStorage as any,
    );

    expect(mockSource.postMessage).toHaveBeenCalledWith(
      {
        type: "shadow-claw-storage-proxy-result",
        requestId: "req-123",
        result: null,
      },
      "*",
    );
  });

  it("posts error result back to source window when command fails", async () => {
    const mockSource = { postMessage: jest.fn() } as unknown as WindowProxy;
    const mockStorage = {
      setItem: jest.fn(),
      deleteItem: jest.fn(),
      clear: jest.fn(),
      getAll: jest.fn(),
      getItem: jest.fn(),
      putItem: jest.fn(),
    };

    await handleStorageProxyMessage(
      mockSource,
      "req-456",
      "unknownOp",
      {},
      pageKey,
      mockStorage as any,
    );

    expect(mockSource.postMessage).toHaveBeenCalledWith(
      {
        type: "shadow-claw-storage-proxy-result",
        requestId: "req-456",
        error: "Unknown storage proxy method: unknownOp",
      },
      "*",
    );
  });
});
