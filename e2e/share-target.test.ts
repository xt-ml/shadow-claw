import { test, expect } from "./fixtures.js";

test.describe("Web Share Target import", () => {
  async function queuePendingShare(
    page: import("@playwright/test").Page,
    fileName: string,
    content: string,
  ) {
    const bytes = Array.from(new TextEncoder().encode(content));

    await page.evaluate(
      async ({ fileName, bytes }) => {
        const bridge = (globalThis as any).__SHADOWCLAW_E2E__;
        const db = bridge?.getDb() as IDBDatabase | null;
        if (!db) {
          throw new Error("ShadowClaw database is not ready via E2E bridge");
        }

        const id =
          (typeof crypto !== "undefined" &&
          typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`) +
          `-${fileName}`;

        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction("pendingShares", "readwrite");
          const store = tx.objectStore("pendingShares");

          store.put({
            id,
            createdAt: Date.now(),
            title: "Imported from e2e",
            text: "",
            url: "",
            fileName,
            fileType: "text/plain",
            fileBytes: new Uint8Array(bytes).buffer,
          });

          tx.oncomplete = () => resolve();
          tx.onerror = () =>
            reject(tx.error || new Error("Failed to queue share payload"));
          tx.onabort = () =>
            reject(tx.error || new Error("Failed to queue share payload"));
        });
      },
      { fileName, bytes },
    );
  }

  test("creates/uses daily Shared Files conversation and auto-opens imported file", async ({
    app,
    conversations,
    page,
  }) => {
    const today = await page.evaluate(() => {
      const now = new Date();
      const year = String(now.getFullYear());
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");

      return `${year}-${month}-${day}`;
    });

    const sharedConversationName = `Shared Files ${today}`;

    await queuePendingShare(page, "first-share.txt", "hello from first share");

    await page.reload();
    await app.waitForReady();

    await expect(conversations.host()).toBeVisible({ timeout: 10000 });
    await expect(
      conversations.host().locator(".conversation-name", {
        hasText: sharedConversationName,
      }),
    ).toHaveCount(1);
    expect(await conversations.activeConversationName()).toBe(
      sharedConversationName,
    );

    const modal = page.locator(".file-modal");
    await expect(modal).toHaveJSProperty("open", true);
    await expect(page.locator(".modal-title")).toContainText("first-share.txt");

    await page.locator(".modal-close-btn").click();
    await expect(modal).toHaveJSProperty("open", false);

    await queuePendingShare(
      page,
      "second-share.txt",
      "hello from second share",
    );

    await page.reload();
    await app.waitForReady();

    // The same daily conversation is reused (no duplicate rows).
    await expect(
      conversations.host().locator(".conversation-name", {
        hasText: sharedConversationName,
      }),
    ).toHaveCount(1);
    expect(await conversations.activeConversationName()).toBe(
      sharedConversationName,
    );

    await expect(page.locator(".file-modal")).toHaveJSProperty("open", true);
    await expect(page.locator(".modal-title")).toContainText(
      "second-share.txt",
    );
  });
});
