import { jest } from "@jest/globals";

const { getConfig } = await import("./getConfig.mjs");
const { getDb, setDB } = await import("./db.mjs");
const { setConfig } = await import("./setConfig.mjs");
const { txPromise, txPromiseAll } = await import("./txPromise.mjs");

describe("DB Core", () => {
  let mockDb;
  let mockTx;
  let mockStore;

  beforeEach(() => {
    mockStore = {
      get: jest.fn(),
      put: jest.fn(),
    };

    mockTx = {
      objectStore: jest.fn().mockReturnValue(mockStore),
    };

    mockDb = {
      transaction: jest.fn().mockReturnValue(mockTx),
    };

    try {
      setDB(mockDb);
    } catch (e) {} // May already be set
  });

  describe("db.mjs", () => {
    it("should get and set db", () => {
      setDB(mockDb);

      expect(getDb()).toBe(mockDb);
    });
  });

  describe("txPromise.mjs", () => {
    it("should wrap a transaction in a promise", async () => {
      const mockRequest = {};
      mockStore.get.mockReturnValue(mockRequest);

      const promise = txPromise(mockDb, "store", "readonly", (s) =>
        s.get("key"),
      );

      mockRequest.result = "val";
      mockRequest.onsuccess();

      const res = await promise;
      expect(res).toBe("val");
      expect(mockDb.transaction).toHaveBeenCalledWith("store", "readonly");
    });

    it("should handle multiple requests with txPromiseAll", async () => {
      const mockRequest1 = {};
      const mockRequest2 = {};
      mockStore.get
        .mockReturnValueOnce(mockRequest1)
        .mockReturnValueOnce(mockRequest2);

      const promise = txPromiseAll("store", "readonly", (s) => [
        s.get("k1"),
        s.get("k2"),
      ]);

      mockRequest1.result = "v1";
      mockRequest1.onsuccess();
      mockRequest2.result = "v2";
      mockRequest2.onsuccess();

      const res = await promise;
      expect(res).toEqual(["v1", "v2"]);
    });
  });

  describe("getConfig / setConfig", () => {
    it("should get a config value", async () => {
      const mockRequest = {};
      mockStore.get.mockReturnValue(mockRequest);

      const promise = getConfig(mockDb, "mykey");

      mockRequest.result = { key: "mykey", value: "myval" };
      mockRequest.onsuccess();

      const res = await promise;
      expect(res).toBe("myval");
    });

    it("should set a config value", async () => {
      const mockRequest = {};
      mockStore.put.mockReturnValue(mockRequest);

      const promise = setConfig(mockDb, "mykey", "newval");

      mockRequest.onsuccess();

      await promise;
      expect(mockStore.put).toHaveBeenCalledWith({
        key: "mykey",
        value: "newval",
      });
    });
  });

  describe("DB Error Cases", () => {
    it("should throw if setDB called with null", () => {
      expect(() => setDB(null)).toThrow("Database not initialized");
    });

    it("should throw if txPromise fails to get transaction", async () => {
      const mockDbNoTx = { transaction: jest.fn().mockReturnValue(null) };
      await expect(txPromise(mockDbNoTx, "s", "r", () => {})).rejects.toThrow(
        "failed to get transaction",
      );
    });

    it("should throw if txPromiseAll fails to get transaction", async () => {
      setDB({ transaction: jest.fn().mockReturnValue(null) });
      await expect(txPromiseAll("s", "r", () => [])).rejects.toThrow(
        "failed to get transaction",
      );
    });

    it("should resolve empty requests in txPromiseAll", async () => {
      setDB(mockDb);
      mockDb.transaction.mockReturnValue(mockTx);
      const res = await txPromiseAll("s", "r", () => []);
      expect(res).toEqual([]);
    });

    it("should handle request error in txPromise", async () => {
      const mockRequest = {};
      mockStore.get.mockReturnValue(mockRequest);

      const promise = txPromise(mockDb, "s", "r", (s) => s.get("k"));
      mockRequest.error = new Error("Request failed");
      mockRequest.onerror();

      await expect(promise).rejects.toThrow("Request failed");
    });
  });
});
