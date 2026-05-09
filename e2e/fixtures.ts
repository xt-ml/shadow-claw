import { test as base, expect } from "@playwright/test";

import { AppPage } from "./pages/app.page.js";
import { ChatPage } from "./pages/chat.page.js";
import { FilesPage } from "./pages/files.page.js";
import { TasksPage } from "./pages/tasks.page.js";
import { SettingsPage } from "./pages/settings.page.js";
import { ConversationsComponent } from "./components/conversations.component.js";
import { clearScheduledTasksForGroup, getRunId } from "./shared/index.js";

type MyFixtures = {
  app: AppPage;
  chat: ChatPage;
  files: FilesPage;
  tasks: TasksPage;
  settings: SettingsPage;
  conversations: ConversationsComponent;
};

export const test = base.extend<MyFixtures>({
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

  tasks: async ({ app, page, request }, use, testInfo) => {
    const conversationName = [
      "E2E Tasks",
      String(testInfo.workerIndex),
      String(testInfo.repeatEachIndex),
      getRunId(),
    ].join(" ");

    const groupId = await page.evaluate(async (name: string) => {
      const bridge = (window as any).__SHADOWCLAW_E2E__;

      if (!bridge) {
        throw new Error("E2E Bridge is not ready");
      }

      const group = await bridge.createConversation(name);
      await bridge.switchConversation(group.groupId);
      await bridge.loadTasks();

      return group.groupId as string;
    }, conversationName);

    await clearScheduledTasksForGroup(request, groupId);

    await use(new TasksPage(app));
  },

  settings: async ({ app }, use) => {
    await use(new SettingsPage(app));
  },

  conversations: async ({ app }, use) => {
    await use(new ConversationsComponent(app.root));
  },
});

export { expect };
