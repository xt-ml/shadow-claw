/** @typedef {import('@playwright/test').Page} Page */

/**
 * Shared utilities for ShadowClaw E2E tests
 */

export const appUrl = "http://localhost:8888";

export const TIME_SECONDS_ONE = 1000;
export const TIME_SECONDS_FIVE = 5 * TIME_SECONDS_ONE;
export const TIME_MINUTES_ONE = 60 * TIME_SECONDS_ONE;

/**
 * Generate unique run ID for test artifacts
 *
 * @returns {string}
 */
export function getRunId() {
  const d = new Date();
  return [
    d.toISOString().slice(0, 19).replace(/[:T]/g, "-"),
    Math.random().toString(16).slice(2, 8),
  ].join("_");
}

/**
 * Wait for <shadow-claw> custom element to be defined and ready
 *
 * @param {Page} page
 *
 * @returns {Promise<void>}
 */
export async function waitForShadowClaw(page) {
  await page.evaluate(() => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error("Timed out waiting for <shadow-claw> element to be ready"),
        );
      }, 10000);

      // Wait for custom element to be defined
      customElements.whenDefined("shadow-claw").then(() => {
        const element = document.querySelector("shadow-claw");
        if (!element) {
          clearTimeout(timeout);
          reject(new Error("<shadow-claw> element not found"));

          return;
        }

        // Element is defined and exists
        clearTimeout(timeout);
        resolve();
      });
    });
  });
}

/**
 * Navigate to a specific page within the app
 *
 * @param {Page} page
 * @param {string} pageId - 'chat', 'files', or 'tasks'
 *
 * @returns {Promise<void>}
 */
export async function navigateToPage(page, pageId) {
  await page.evaluate((id) => {
    const shadowClaw = document.querySelector("shadow-claw");
    const navItem = shadowClaw?.shadowRoot?.querySelector(
      `.nav-item[data-page="${id}"]`,
    );

    if (navItem) {
      navItem.click();
    }
  }, pageId);

  // Wait a bit for page transition
  await page.waitForTimeout(500);
}

/**
 * Get the current active page ID
 *
 * @param {Page} page
 *
 * @returns {Promise<string|null>}
 */
export async function getCurrentPageId(page) {
  return page.evaluate(() => {
    const shadowClaw = document.querySelector("shadow-claw");

    const activePage = shadowClaw?.shadowRoot?.querySelector(".page.active");
    return activePage?.dataset?.pageId || null;
  });
}

/**
 * Get all group IDs from IndexedDB
 *
 * @param {Page} page
 *
 * @returns {Promise<string[]>}
 */
export async function getAllGroupIds(page) {
  return page.evaluate(async () => {
    const dbName = "shadowclaw";
    const dbVersion = 1;

    return new Promise((resolve) => {
      try {
        const request = indexedDB.open(dbName, dbVersion);

        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("sessions", "readonly");
          const store = tx.objectStore("sessions");
          const getAllRequest = store.getAllKeys();

          getAllRequest.onsuccess = () => {
            db.close();
            resolve(getAllRequest.result);
          };

          getAllRequest.onerror = () => {
            db.close();
            resolve([]);
          };
        };

        request.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  });
}

/**
 * Wait for a specific number of messages in the current group
 *
 * @param {Page} page
 * @param {number} count
 * @param {number} timeout
 *
 * @returns {Promise<void>}
 */
export async function waitForMessageCount(page, count, timeout = 5000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const messageCount = await page.evaluate(() => {
      const chat = document
        .querySelector("shadow-claw")
        ?.shadowRoot?.querySelector("shadow-claw-chat");

      const messages = chat?.shadowRoot?.querySelectorAll(".message");
      return messages?.length || 0;
    });

    if (messageCount >= count) {
      return;
    }

    await page.waitForTimeout(100);
  }

  throw new Error(
    `Timeout waiting for ${count} messages (${timeout}ms elapsed)`,
  );
}
