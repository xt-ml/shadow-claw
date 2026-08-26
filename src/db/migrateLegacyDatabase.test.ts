import { getConfig } from "./getConfig.js";
import { openDatabase } from "./openDatabase.js";
import { migrateLegacyDatabase } from "./migrateLegacyDatabase.js";
import { CONFIG_KEYS, LEGACY_DB_NAME } from "../config/config.js";
import type { ShadowClawDatabase } from "./types.js";

describe("migrateLegacyDatabase", () => {
  beforeEach(() => {
    delete (window as any).__SHADOWCLAW_DEPLOY_ID__;
  });

  afterEach(() => {
    delete (window as any).__SHADOWCLAW_DEPLOY_ID__;
  });

  it("copies legacy IndexedDB records into new namespaced DB once", async () => {
    // 1. Setup legacy database named "shadowclaw"
    const legacyDb: ShadowClawDatabase = await new Promise(
      (resolve, reject) => {
        const req = indexedDB.open(LEGACY_DB_NAME, 2);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("messages")) {
            db.createObjectStore("messages", { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains("config")) {
            db.createObjectStore("config", { keyPath: "key" });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      },
    );

    // Populate legacy DB
    await new Promise<void>((resolve, reject) => {
      const tx = legacyDb!.transaction(["messages", "config"], "readwrite");
      tx.objectStore("messages").put({
        id: "msg-1",
        groupId: "br:main",
        text: "Legacy Hello",
      });
      tx.objectStore("config").put({
        key: "assistant_name",
        value: "LegacyBot",
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    legacyDb!.close();

    // 2. Open namespaced target DB
    (window as any).__SHADOWCLAW_DEPLOY_ID__ = "deploy-test-1";
    const targetDb = await openDatabase();
    expect(targetDb!.name).toBe("shadowclaw-deploy-test-1");

    // 3. Perform migration
    await migrateLegacyDatabase(targetDb);

    // 4. Verify data was copied
    const copiedMsg = await new Promise((resolve, reject) => {
      const tx = targetDb!.transaction("messages", "readonly");
      const req = tx.objectStore("messages").get("msg-1");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    expect(copiedMsg).toEqual({
      id: "msg-1",
      groupId: "br:main",
      text: "Legacy Hello",
    });

    const migrationFlag = await getConfig(
      targetDb,
      CONFIG_KEYS.DB_MIGRATED_FROM_LEGACY,
    );
    expect(migrationFlag).toBe("true");

    // 5. Subsequent run should be a no-op
    await migrateLegacyDatabase(targetDb);
    expect(await getConfig(targetDb, CONFIG_KEYS.DB_MIGRATED_FROM_LEGACY)).toBe(
      "true",
    );

    targetDb!.close();
  });
});
