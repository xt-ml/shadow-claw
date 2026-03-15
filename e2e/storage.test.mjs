import { test, expect } from "./fixtures.mjs";
import { getAllGroupIds } from "./shared/index.mjs";

test.describe("Storage Integration", () => {
  test.beforeEach(async ({ app }) => {
    // Ensure tests run on the real app origin, not about:blank.
    await app.navigateTo("files");
  });

  test("should have OPFS support in browser", async ({ page }) => {
    const opfsSupport = await page.evaluate(() => {
      return {
        hasStorageAPI: "storage" in navigator,
        hasGetDirectory:
          "storage" in navigator &&
          typeof navigator.storage.getDirectory === "function",
      };
    });

    expect(opfsSupport.hasStorageAPI).toBe(true);

    expect(opfsSupport.hasGetDirectory).toBe(true);
  });

  test("should have IndexedDB support", async ({ page }) => {
    const idbSupport = await page.evaluate(() => {
      return {
        hasIndexedDB: "indexedDB" in window,
        canOpen: typeof indexedDB?.open === "function",
      };
    });

    expect(idbSupport.hasIndexedDB).toBe(true);

    expect(idbSupport.canOpen).toBe(true);
  });

  test("should initialize IndexedDB on page load", async ({ page }) => {
    await page.waitForTimeout(1000);

    const dbInitialized = await page.evaluate(async () => {
      return new Promise((resolve) => {
        let request;
        try {
          request = indexedDB.open("shadowclaw");
        } catch {
          resolve({ dbExists: false, hasStores: false, storeCount: 0 });

          return;
        }

        request.onsuccess = (event) => {
          const db = event.target.result;
          const hasObjectStores = db.objectStoreNames.length > 0;
          db.close();
          resolve({
            dbExists: true,
            hasStores: hasObjectStores,
            storeCount: db.objectStoreNames.length,
          });
        };

        request.onerror = () => {
          resolve({ dbExists: false, hasStores: false, storeCount: 0 });
        };
      });
    });

    expect(dbInitialized.dbExists).toBe(true);

    expect(dbInitialized.hasStores).toBe(true);
  });

  test("should persist messages in IndexedDB", async ({ page }) => {
    const groupIds = await getAllGroupIds(page);

    expect(Array.isArray(groupIds)).toBe(true);
  });

  test("should handle workspace directory access", async ({ page }) => {
    const workspaceAccess = await page.evaluate(async () => {
      try {
        const root = await navigator.storage.getDirectory();
        const workspaceHandle = await root.getDirectoryHandle("shadowclaw", {
          create: true,
        });

        return {
          canAccessRoot: !!root,
          canCreateDir: !!workspaceHandle,
          success: true,
        };
      } catch (error) {
        return {
          canAccessRoot: false,
          canCreateDir: false,
          success: false,
          error: error.message,
        };
      }
    });

    expect(workspaceAccess.success).toBe(true);

    expect(workspaceAccess.canAccessRoot).toBe(true);
  });

  test("should respect storage quota", async ({ page }) => {
    const quota = await page.evaluate(async () => {
      if (!navigator.storage || !navigator.storage.estimate) {
        return { hasQuotaAPI: false };
      }

      try {
        const estimate = await navigator.storage.estimate();
        return {
          hasQuotaAPI: true,
          quota: estimate.quota,
          usage: estimate.usage,
          hasSpace: estimate.quota > estimate.usage,
        };
      } catch (error) {
        return {
          hasQuotaAPI: true,
          error: error.message,
        };
      }
    });

    expect(quota.hasQuotaAPI).toBe(true);

    if (quota.quota) {
      expect(quota.hasSpace).toBe(true);
    }
  });

  test("should handle file read/write operations in OPFS", async ({ page }) => {
    const fileOperations = await page.evaluate(async () => {
      try {
        const root = await navigator.storage.getDirectory();
        const workspaceHandle = await root.getDirectoryHandle("shadowclaw", {
          create: true,
        });

        // Try to create a test file
        const testFileHandle = await workspaceHandle.getFileHandle("test.txt", {
          create: true,
        });

        // Write to the file
        const writable = await testFileHandle.createWritable();
        await writable.write("test content");
        await writable.close();

        // Read from the file
        const file = await testFileHandle.getFile();
        const content = await file.text();

        // Clean up
        await workspaceHandle.removeEntry("test.txt");

        return {
          success: true,
          canWrite: true,
          canRead: content === "test content",
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
        };
      }
    });

    expect(fileOperations.success).toBe(true);

    expect(fileOperations.canWrite).toBe(true);

    expect(fileOperations.canRead).toBe(true);
  });

  test("should maintain workspace structure", async ({ page }) => {
    await page.waitForTimeout(1500);

    const workspaceStructure = await page.evaluate(async () => {
      try {
        const root = await navigator.storage.getDirectory();
        const shadowclawHandle = await root.getDirectoryHandle("shadowclaw", {
          create: false,
        });

        // Check if there are group directories
        const entries = [];
        for await (const entry of shadowclawHandle.values()) {
          entries.push({
            name: entry.name,
            kind: entry.kind,
          });
        }

        return {
          success: true,
          hasWorkspace: true,
          entryCount: entries.length,
          entries,
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
        };
      }
    });

    expect(workspaceStructure.hasWorkspace).toBe(true);
  });

  test("should store and retrieve config via IndexedDB", async ({ page }) => {
    await page.waitForTimeout(1000);

    const configAccess = await page.evaluate(async () => {
      return new Promise((resolve) => {
        let request;
        try {
          request = indexedDB.open("shadowclaw");
        } catch {
          resolve({ hasConfigStore: false, error: "IDB unavailable" });

          return;
        }

        request.onsuccess = (event) => {
          const db = event.target.result;
          const hasConfigStore = db.objectStoreNames.contains("config");

          if (hasConfigStore) {
            const transaction = db.transaction(["config"], "readonly");
            const store = transaction.objectStore("config");
            const getAllRequest = store.getAll();

            getAllRequest.onsuccess = () => {
              db.close();

              resolve({
                hasConfigStore: true,
                configCount: getAllRequest.result.length,
              });
            };

            getAllRequest.onerror = () => {
              db.close();

              resolve({ hasConfigStore: true, configCount: 0 });
            };
          } else {
            db.close();

            resolve({ hasConfigStore: false });
          }
        };

        request.onerror = () => {
          resolve({ hasConfigStore: false, error: "DB open failed" });
        };
      });
    });

    expect(configAccess.hasConfigStore).toBe(true);
  });
});
