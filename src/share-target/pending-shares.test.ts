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
});
