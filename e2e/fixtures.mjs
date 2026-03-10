import { test as base, expect } from "@playwright/test";
import { AppPage } from "./pages/app.page.mjs";
import { ChatPage } from "./pages/chat.page.mjs";
import { FilesPage } from "./pages/files.page.mjs";
import { TasksPage } from "./pages/tasks.page.mjs";

/**
 * Shared typed fixtures for E2E suite.
 */
export const test = base.extend({
  app: async ({ page }, use) => {
    const app = new AppPage(page);
    await app.open();
    await use(app);
  },

  chat: async ({ app }, use) => {
    await use(new ChatPage(app));
  },

  files: async ({ app }, use) => {
    await use(new FilesPage(app));
  },

  tasks: async ({ app }, use) => {
    await use(new TasksPage(app));
  },
});

export { expect };
