import { expect } from "@playwright/test";

/**
 * Tasks page object for scheduler/task management UI.
 */
export class TasksPage {
  /** @param {import('./app.page.mjs').AppPage} app */
  constructor(app) {
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
