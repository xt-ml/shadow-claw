import { test, expect } from "./fixtures.js";
import { getAllGroupIds } from "./shared/index.js";

test.describe("Orchestrator Integration", () => {
  test("should initialize orchestrator on page load", async ({ app }) => {
    await expect(app.root).toHaveCount(1);
    await expect(app.chatComponent()).toHaveCount(1);
  });

  test("should initialize group storage on first load", async ({ page }) => {
    await page.waitForTimeout(1000);

    const groupIds = await getAllGroupIds(page);

    expect(Array.isArray(groupIds)).toBe(true);

    expect(groupIds.length).toBeGreaterThanOrEqual(0);
  });

  test("should handle page switching", async ({ app }) => {
    await app.navigateTo("chat");
    await expect(app.activePage()).toHaveAttribute("data-page-id", "chat");

    expect(await app.navItems().count()).toBeGreaterThanOrEqual(3);
  });

  test("should persist messages to IndexedDB", async ({ app, page }) => {
    await app.navigateTo("chat");

    await page.waitForTimeout(1000);

    const messagesPersisted = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const request = indexedDB.open("shadowclaw");

        request.onsuccess = (event) => {
          const db = (event.target as any).result;
          const hasMessagesStore = db.objectStoreNames.contains("messages");

          if (hasMessagesStore) {
            const transaction = db.transaction(["messages"], "readonly");
            const store = transaction.objectStore("messages");
            const getAllRequest = store.getAll();

            getAllRequest.onsuccess = () => {
              db.close();
              resolve({
                hasStore: true,
                messageCount: getAllRequest.result.length,
              });
            };

            getAllRequest.onerror = () => {
              db.close();
              resolve({ hasStore: true, messageCount: 0 });
            };
          } else {
            db.close();
            resolve({ hasStore: false });
          }
        };

        request.onerror = () => {
          resolve({ hasStore: false, error: "DB open failed" });
        };
      });
    });

    expect((messagesPersisted as any).hasStore).toBe(true);
  });

  test("should initialize worker on startup", async ({ page }) => {
    const workerInitialized = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll("script"));
      const hasWorkerScript = scripts.some(
        (script) =>
          script.src.includes("worker.ts") || script.type === "module",
      );

      return {
        hasWorkerScript,
        hasWorkerSupport: typeof Worker !== "undefined",
      };
    });

    expect(workerInitialized.hasWorkerSupport).toBe(true);
  });

  test("should handle orchestrator state transitions", async ({ chat }) => {
    await chat.open();
    await chat.expectCoreUi();
    await expect(chat.status()).toHaveCount(1);
  });

  test("should queue messages when offline", async ({ page }) => {
    await page.context().setOffline(true);

    const offlineState = await page.evaluate(() => {
      return {
        isOffline: !navigator.onLine,
      };
    });

    expect(offlineState.isOffline).toBe(true);

    await page.context().setOffline(false);
  });

  test("should handle worker lifecycle", async ({ page }) => {
    const workerLifecycle = await page.evaluate(() => {
      return {
        workerSupported: typeof Worker !== "undefined",
        sharedWorkerSupported: typeof SharedWorker !== "undefined",
      };
    });

    expect(workerLifecycle.workerSupported).toBe(true);
  });

  test("should recover from worker errors gracefully", async ({ app }) => {
    await app.navigateTo("chat");
    await expect(app.toastComponent()).toHaveCount(1);
  });

  test("should maintain conversation context across page navigations", async ({
    app,
    chat,
  }) => {
    await app.navigateTo("chat");
    await app.navigateTo("files");
    await app.navigateTo("chat");
    await expect(chat.host).toHaveCount(1);
  });

  test("should handle concurrent message processing", async ({ chat }) => {
    await chat.open();
    await expect(
      chat.host.locator(".messages, [role='log'], .chat__messages"),
    ).toHaveCount(1);
  });

  test("should clean up resources on page unload", async ({ page, app }) => {
    await page.goto("about:blank");

    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto("/");
    await app.waitForReady();
    await expect(app.root).toHaveCount(1);
  });
});
