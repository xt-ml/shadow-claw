import { CONFIG_KEYS, LEGACY_DB_NAME } from "../config/config.js";
import { getConfig } from "./getConfig.js";
import { setConfig } from "./setConfig.js";
import type { ShadowClawDatabase } from "./types.js";

/**
 * Perform a one-time migration from the legacy unnamespaced database "shadowclaw"
 * to the new namespaced database if not already done.
 */
export async function migrateLegacyDatabase(
  targetDb: ShadowClawDatabase,
): Promise<void> {
  if (!targetDb || targetDb.name === LEGACY_DB_NAME) {
    return;
  }

  try {
    const alreadyMigrated = await getConfig(
      targetDb,
      CONFIG_KEYS.DB_MIGRATED_FROM_LEGACY,
    );
    if (alreadyMigrated === "true") {
      return;
    }
  } catch {
    // ignore read error
  }

  try {
    const legacyDb = await new Promise<ShadowClawDatabase | null>((resolve) => {
      const req = indexedDB.open(LEGACY_DB_NAME);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames || db.objectStoreNames.length === 0) {
          db.close();
          resolve(null);

          return;
        }
        resolve(db);
      };
      req.onerror = () => resolve(null);
    });

    if (legacyDb) {
      const storeNames = Array.from(legacyDb.objectStoreNames).filter((name) =>
        targetDb.objectStoreNames.contains(name),
      );

      for (const storeName of storeNames) {
        await new Promise<void>((resolve) => {
          try {
            const readTx = legacyDb.transaction(storeName, "readonly");
            const readStore = readTx.objectStore(storeName);
            const getAllReq = readStore.getAll();

            getAllReq.onsuccess = () => {
              const items: any[] = getAllReq.result || [];
              if (items.length > 0) {
                try {
                  const writeTx = targetDb.transaction(storeName, "readwrite");
                  const writeStore = writeTx.objectStore(storeName);
                  for (const item of items) {
                    writeStore.put(item);
                  }
                  writeTx.oncomplete = () => resolve();
                  writeTx.onerror = () => resolve();
                  writeTx.onabort = () => resolve();
                } catch {
                  resolve();
                }
              } else {
                resolve();
              }
            };
            getAllReq.onerror = () => resolve();
          } catch {
            resolve();
          }
        });
      }

      legacyDb.close();
    }
  } catch (err) {
    console.warn("Legacy IndexedDB migration warning:", err);
  } finally {
    try {
      await setConfig(targetDb, CONFIG_KEYS.DB_MIGRATED_FROM_LEGACY, "true");
    } catch {
      // ignore write error
    }
  }
}
