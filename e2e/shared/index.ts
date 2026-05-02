import { APIRequestContext, Page } from "@playwright/test";

import { DEFAULT_GROUP_ID } from "../../src/config.js";

export const appUrl = "http://localhost:8888";

export const TIME_SECONDS_ONE = 1000;
export const TIME_SECONDS_FIVE = 5 * TIME_SECONDS_ONE;
export const TIME_MINUTES_ONE = 60 * TIME_SECONDS_ONE;

export async function clearScheduledTasksForGroup(
  request: APIRequestContext,
  groupId: string = DEFAULT_GROUP_ID,
): Promise<void> {
  const response = await request.get(
    `/schedule/tasks?groupId=${encodeURIComponent(groupId)}`,
  );

  if (!response.ok()) {
    throw new Error(
      `Failed to list scheduled tasks for group ${groupId}: ${response.status()}`,
    );
  }

  const tasks = (await response.json()) as Array<{ id?: string }>;

  for (const task of tasks) {
    if (!task?.id) {
      continue;
    }

    const deleteResponse = await request.delete(
      `/schedule/tasks/${encodeURIComponent(task.id)}`,
    );

    if (!deleteResponse.ok()) {
      throw new Error(
        `Failed to delete scheduled task ${task.id}: ${deleteResponse.status()}`,
      );
    }
  }
}

export function getRunId(): string {
  const d = new Date();

  return [
    d.toISOString().slice(0, 19).replace(/[:T]/g, "-"),
    Math.random().toString(16).slice(2, 8),
  ].join("_");
}

export async function waitForShadowClaw(page: Page): Promise<void> {
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
        resolve(void 0);
      });
    });
  });
}

export async function navigateToPage(
  page: Page,
  pageId: string,
): Promise<void> {
  await page.evaluate((id: string) => {
    const shadowAgent = document.querySelector("shadow-claw");
    const navItem = shadowAgent?.shadowRoot?.querySelector(
      `.nav-item[data-page="${id}"]`,
    );

    if (navItem) {
      (navItem as HTMLElement).click();
    }
  }, pageId);

  await page.waitForTimeout(500);
}

export async function getCurrentPageId(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const shadowAgent = document.querySelector("shadow-claw");

    const activePage = shadowAgent?.shadowRoot?.querySelector(".page.active");

    return (activePage as HTMLElement)?.dataset?.pageId || null;
  });
}

export async function getAllGroupIds(page: Page): Promise<string[]> {
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
            resolve(getAllRequest.result as string[]);
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

export async function waitForMessageCount(
  page: Page,
  count: number,
  timeout = 5000,
) {
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
