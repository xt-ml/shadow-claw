import type { ShadowClawDatabase } from "../types.js";

const PENDING_SHARES_STORE = "pendingShares";

export interface PendingShareRecord {
  id: string;
  createdAt: number;
  title: string;
  text: string;
  url: string;
  fileName: string;
  fileType: string;
  fileBytes: ArrayBuffer | null;
}

function normalizeRecord(raw: any): PendingShareRecord {
  return {
    id: typeof raw?.id === "string" ? raw.id : "",
    createdAt: typeof raw?.createdAt === "number" ? raw.createdAt : 0,
    title: typeof raw?.title === "string" ? raw.title : "",
    text: typeof raw?.text === "string" ? raw.text : "",
    url: typeof raw?.url === "string" ? raw.url : "",
    fileName: typeof raw?.fileName === "string" ? raw.fileName : "",
    fileType: typeof raw?.fileType === "string" ? raw.fileType : "",
    fileBytes: raw?.fileBytes instanceof ArrayBuffer ? raw.fileBytes : null,
  };
}

/**
 * Read and clear pending Web Share Target payloads in FIFO order.
 */
export async function consumePendingShares(
  db: ShadowClawDatabase,
): Promise<PendingShareRecord[]> {
  if (!db || typeof (db as any).transaction !== "function") {
    return [];
  }

  return new Promise((resolve, reject) => {
    let tx: IDBTransaction;

    try {
      tx = db.transaction(PENDING_SHARES_STORE, "readwrite");
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotFoundError") {
        resolve([]);

        return;
      }

      reject(error);

      return;
    }

    const store = tx.objectStore(PENDING_SHARES_STORE);
    const getAllRequest = store.getAll();

    getAllRequest.onerror = () => {
      reject(getAllRequest.error || new Error("Failed to read pending shares"));
    };

    getAllRequest.onsuccess = () => {
      const rows = Array.isArray(getAllRequest.result)
        ? getAllRequest.result
            .map(normalizeRecord)
            .filter(
              (record) => typeof record.id === "string" && record.id.length > 0,
            )
            .sort((a, b) => a.createdAt - b.createdAt)
        : [];

      const clearRequest = store.clear();
      clearRequest.onerror = () => {
        reject(
          clearRequest.error || new Error("Failed to clear pending shares"),
        );
      };

      clearRequest.onsuccess = () => {
        resolve(rows);
      };
    };

    tx.onabort = () => {
      reject(tx.error || new Error("Pending share transaction aborted"));
    };
  });
}
