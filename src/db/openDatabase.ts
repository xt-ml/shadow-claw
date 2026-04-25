import { DB_NAME, DB_VERSION } from "../config.js";
import { setDB } from "./db.js";
import type { ShadowClawDatabase } from "../types.js";

/**
 * Open (or create) the IndexedDB database.
 */
export function openDatabase(): Promise<ShadowClawDatabase> {
  return new Promise(async (resolve, reject) => {
    let db: ShadowClawDatabase;

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      // Messages store
      if (!database.objectStoreNames.contains("messages")) {
        const msgStore = database.createObjectStore("messages", {
          keyPath: "id",
        });
        msgStore.createIndex("by-group-time", ["groupId", "timestamp"]);
        msgStore.createIndex("by-group", "groupId");
      }

      // Sessions store (conversation state per group)
      if (!database.objectStoreNames.contains("sessions")) {
        database.createObjectStore("sessions", { keyPath: "groupId" });
      }

      // Tasks store (scheduled tasks)
      if (!database.objectStoreNames.contains("tasks")) {
        const taskStore = database.createObjectStore("tasks", {
          keyPath: "id",
        });

        taskStore.createIndex("by-group", "groupId");
        taskStore.createIndex("by-enabled", "enabled");
      }

      // Config store (key-value)
      if (!database.objectStoreNames.contains("config")) {
        database.createObjectStore("config", { keyPath: "key" });
      }
    };

    request.onsuccess = () => {
      db = request.result;
      setDB(db);
      resolve(db);
    };

    request.onerror = () => {
      reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
    };
  });
}
