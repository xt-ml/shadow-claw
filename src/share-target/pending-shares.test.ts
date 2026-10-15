import { consumePendingShares } from "./pending-shares.js";

if (typeof globalThis.structuredClone !== "function") {
  (globalThis as any).structuredClone = (value: unknown) => value;
}

function openTestDb(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      const store = db.createObjectStore("pendingShares", { keyPath: "id" });
      store.createIndex("by-createdAt", "createdAt");
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("open failed"));
  });
}

function putPendingShare(
  db: IDBDatabase,
  value: {
    id: string;
    createdAt: number;
    title: string;
    text: string;
    url: string;
    fileName: string;
    fileType: string;
    fileBytes: ArrayBuffer | null;
  },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pendingShares", "readwrite");
    tx.objectStore("pendingShares").put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("put failed"));
  });
}

describe("consumePendingShares", () => {
  it("returns and clears pending shares ordered by createdAt", async () => {
    const dbName = `pending-shares-${Date.now()}-${Math.random()}`;
    const db = await openTestDb(dbName);

    await putPendingShare(db, {
      id: "b",
      createdAt: 20,
      title: "second",
      text: "",
      url: "",
      fileName: "two.txt",
      fileType: "text/plain",
      fileBytes: null,
    });

    await putPendingShare(db, {
      id: "a",
      createdAt: 10,
      title: "first",
      text: "",
      url: "",
      fileName: "one.txt",
      fileType: "text/plain",
      fileBytes: null,
    });

    const firstPass = await consumePendingShares(db);

    expect(firstPass.map((entry) => entry.id)).toEqual(["a", "b"]);

    const secondPass = await consumePendingShares(db);
    expect(secondPass).toEqual([]);

    db.close();
  });

  it("returns empty array when db is null or does not have transaction function", async () => {
    expect(await consumePendingShares(null as any)).toEqual([]);
    expect(await consumePendingShares({} as any)).toEqual([]);
  });

  it("handles NotFoundError DOMException by resolving with empty array", async () => {
    const mockDb: any = {
      transaction: () => {
        throw new DOMException("Store not found", "NotFoundError");
      },
    };
    const res = await consumePendingShares(mockDb);
    expect(res).toEqual([]);
  });

  it("rejects when transaction throws other error", async () => {
    const mockDb: any = {
      transaction: () => {
        throw new Error("Disk corruption");
      },
    };
    await expect(consumePendingShares(mockDb)).rejects.toThrow(
      "Disk corruption",
    );
  });

  it("handles getAll error, clear error, and tx abort", async () => {
    // 1. getAll error
    const req1: any = {};
    const mockDb1: any = {
      transaction: () => ({
        objectStore: () => ({
          getAll: () => {
            setTimeout(() => {
              req1.error = new Error("Read error");
              req1.onerror();
            }, 0);
            return req1;
          },
        }),
      }),
    };
    await expect(consumePendingShares(mockDb1)).rejects.toThrow("Read error");

    // 2. clear error
    const req2: any = {};
    const clearReq: any = {};
    const mockDb2: any = {
      transaction: () => ({
        objectStore: () => ({
          getAll: () => {
            setTimeout(() => {
              req2.result = [{ id: "x", createdAt: 1 }];
              req2.onsuccess();
            }, 0);
            return req2;
          },
          clear: () => {
            setTimeout(() => {
              clearReq.error = new Error("Clear error");
              clearReq.onerror();
            }, 0);
            return clearReq;
          },
        }),
      }),
    };
    await expect(consumePendingShares(mockDb2)).rejects.toThrow("Clear error");

    // 3. tx abort
    const req3: any = {};
    const tx3: any = {
      objectStore: () => ({
        getAll: () => {
          setTimeout(() => {
            tx3.error = new Error("Aborted error");
            tx3.onabort();
          }, 0);
          return req3;
        },
      }),
    };
    const mockDb3: any = {
      transaction: () => tx3,
    };
    await expect(consumePendingShares(mockDb3)).rejects.toThrow(
      "Aborted error",
    );
  });

  it("handles fallback default errors and non-array result", async () => {
    // 1. getAll error fallback
    const req1: any = {};
    const mockDb1: any = {
      transaction: () => ({
        objectStore: () => ({
          getAll: () => {
            setTimeout(() => {
              req1.error = null;
              req1.onerror();
            }, 0);
            return req1;
          },
        }),
      }),
    };
    await expect(consumePendingShares(mockDb1)).rejects.toThrow(
      "Failed to read pending shares",
    );

    // 2. clear error fallback
    const req2: any = {};
    const clearReq: any = {};
    const mockDb2: any = {
      transaction: () => ({
        objectStore: () => ({
          getAll: () => {
            setTimeout(() => {
              req2.result = [{ id: "x" }];
              req2.onsuccess();
            }, 0);
            return req2;
          },
          clear: () => {
            setTimeout(() => {
              clearReq.error = null;
              clearReq.onerror();
            }, 0);
            return clearReq;
          },
        }),
      }),
    };
    await expect(consumePendingShares(mockDb2)).rejects.toThrow(
      "Failed to clear pending shares",
    );

    // 3. tx abort fallback
    const req3: any = {};
    const tx3: any = {
      objectStore: () => ({
        getAll: () => {
          setTimeout(() => {
            tx3.error = null;
            tx3.onabort();
          }, 0);
          return req3;
        },
      }),
    };
    const mockDb3: any = {
      transaction: () => tx3,
    };
    await expect(consumePendingShares(mockDb3)).rejects.toThrow(
      "Pending share transaction aborted",
    );

    // 4. getAll result is null (not array)
    const req4: any = {};
    const clearReq4: any = {};
    const mockDb4: any = {
      transaction: () => ({
        objectStore: () => ({
          getAll: () => {
            setTimeout(() => {
              req4.result = null;
              req4.onsuccess();
            }, 0);
            return req4;
          },
          clear: () => {
            setTimeout(() => {
              clearReq4.onsuccess();
            }, 0);
            return clearReq4;
          },
        }),
      }),
    };
    expect(await consumePendingShares(mockDb4)).toEqual([]);
  });

  it("normalizes records with ArrayBuffer and missing fields", async () => {
    const req: any = {};
    const clearReq: any = {};
    const buf = new ArrayBuffer(8);
    const mockDb: any = {
      transaction: () => ({
        objectStore: () => ({
          getAll: () => {
            setTimeout(() => {
              req.result = [
                null,
                {},
                { id: "" },
                {
                  id: "valid-1",
                  createdAt: 123,
                  title: "Title",
                  text: "Text",
                  url: "https://example.com",
                  fileName: "test.dat",
                  fileType: "application/octet-stream",
                  fileBytes: buf,
                },
              ];
              req.onsuccess();
            }, 0);
            return req;
          },
          clear: () => {
            setTimeout(() => {
              clearReq.onsuccess();
            }, 0);
            return clearReq;
          },
        }),
      }),
    };

    const res = await consumePendingShares(mockDb);
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe("valid-1");
    expect(res[0].fileBytes).toBe(buf);
  });
});
