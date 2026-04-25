import { expect, Locator, Page } from "@playwright/test";

import { AppPage } from "./app.page.js";

export class TasksPage {
  app: AppPage;
  page: Page;
  host: Locator;

  constructor(app: AppPage) {
    this.app = app;
    this.page = app.page;
    this.host = app.tasksComponent();
  }

  async open() {
    await this.app.navigateTo("tasks");
    await expect(this.host).toHaveCount(1);
  }

  allButtons() {
    return this.host.locator("button");
  }

  textInputs() {
    return this.host.locator('input[type="text"]');
  }

  toggles() {
    return this.host.locator('input[type="checkbox"], [role="switch"]');
  }

  taskLikeElements() {
    return this.host.locator('[class*="task"], li, tr');
  }
}
