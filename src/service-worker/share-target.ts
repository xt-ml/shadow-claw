/// <reference types="@types/serviceworker" />

const SHARE_DB_NAME = "shadowclaw";
const SHARE_DB_VERSION = 2;
const PENDING_SHARES_STORE = "pendingShares";

interface PendingShareRecord {
  id: string;
  createdAt: number;
  title: string;
  text: string;
  url: string;
  fileName: string;
  fileType: string;
  fileBytes: ArrayBuffer | null;
}

function toStringValue(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function isShareTargetPath(pathname: string): boolean {
  return pathname.endsWith("/share/share-target.html");
}

function createRecordId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function openShareDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SHARE_DB_NAME, SHARE_DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PENDING_SHARES_STORE)) {
        const pendingShares = database.createObjectStore(PENDING_SHARES_STORE, {
          keyPath: "id",
        });
        pendingShares.createIndex("by-createdAt", "createdAt");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("Failed to open share DB"));
  });
}

function savePendingShares(records: PendingShareRecord[]): Promise<void> {
  if (records.length === 0) {
    return Promise.resolve();
  }

  return new Promise(async (resolve, reject) => {
    try {
      const db = await openShareDb();
      const tx = db.transaction(PENDING_SHARES_STORE, "readwrite");
      const store = tx.objectStore(PENDING_SHARES_STORE);

      for (const record of records) {
        store.put(record);
      }

      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error || new Error("Failed to persist pending shares"));
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error || new Error("Failed to persist pending shares"));
      };
    } catch (error) {
      reject(error);
    }
  });
}

async function buildPendingShareRecords(
  request: Request,
): Promise<PendingShareRecord[]> {
  const formData = await request.formData();
  const title = toStringValue(formData.get("title"));
  const text = toStringValue(formData.get("text"));
  const url = toStringValue(formData.get("url"));
  const createdAt = Date.now();

  const files = formData
    .getAll("file")
    .filter((value): value is File => value instanceof File);

  if (files.length === 0) {
    return [
      {
        id: createRecordId(),
        createdAt,
        title,
        text,
        url,
        fileName: "",
        fileType: "",
        fileBytes: null,
      },
    ];
  }

  return Promise.all(
    files.map(async (file) => ({
      id: createRecordId(),
      createdAt,
      title,
      text,
      url,
      fileName: file.name || "shared-file",
      fileType: file.type || "application/octet-stream",
      fileBytes: await file.arrayBuffer(),
    })),
  );
}

async function handleShareTargetRequest(event: FetchEvent): Promise<Response> {
  try {
    const records = await buildPendingShareRecords(event.request);
    await savePendingShares(records);
  } catch (error) {
    console.error("share-target: failed to store shared payload", error);
  }

  return Response.redirect(
    new URL("?share-target=1", self.registration.scope).href,
    303,
  );
}

self.addEventListener("fetch", (event: FetchEvent) => {
  const requestUrl = new URL(event.request.url);

  if (
    !isShareTargetPath(requestUrl.pathname) ||
    event.request.method !== "POST"
  ) {
    return;
  }

  event.respondWith(handleShareTargetRequest(event));
});
