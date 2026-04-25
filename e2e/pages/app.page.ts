import { Page, expect } from "@playwright/test";

import { NavComponent } from "../components/nav.component.js";

export class AppPage {
  page: Page;
  root;
  nav;

  constructor(page: Page) {
    this.page = page;
    this.root = page.locator("shadow-claw");
    this.nav = new NavComponent(this.root);
  }

  async open() {
    await this.page.goto("/");
    await this.waitForReady();
  }

  async waitForReady() {
    await this.page.waitForFunction(
      () => {
        const isDefined = !!customElements.get("shadow-claw");
        const el = document.querySelector("shadow-claw") as any;
        const store = (window as any).orchestratorStore;
        const db = (window as any).__SHADOWCLAW_DB__;

        return (
          isDefined && !!el && !!el.shadowRoot && !!store && store.ready && !!db
        );
      },
      { timeout: 45000 },
    );

    await expect(this.root).toHaveCount(1);
    await expect(this.nav.activePage()).toHaveCount(1);
  }

  async navigateTo(pageId: string) {
    await this.nav.navigateTo(pageId);
  }

  async navigateToWithOpenDialog(pageId: string) {
    let switched = await this.page
      .evaluate((targetPageId) => {
        const app = document.querySelector("shadow-claw") as any;

        if (!app || typeof app.showPage !== "function") {
          return false;
        }

        app.showPage(targetPageId);

        return true;
      }, pageId)
      .catch(() => false);

    if (!switched) {
      await this.waitForReady();

      switched = await this.page
        .evaluate((targetPageId) => {
          const app = document.querySelector("shadow-claw") as any;

          if (!app || typeof app.showPage !== "function") {
            return false;
          }

          app.showPage(targetPageId);

          return true;
        }, pageId)
        .catch(() => false);
    }

    if (!switched) {
      await this.nav.navigateTo(pageId);

      return;
    }

    await expect(this.activePage()).toHaveAttribute("data-page-id", pageId);
  }

  async currentPageId() {
    return this.nav.currentPageId();
  }

  navItems() {
    return this.nav.allNavItems();
  }

  activePage() {
    return this.nav.activePage();
  }

  navItem(pageId: string) {
    return this.nav.navItem(pageId);
  }

  chatComponent() {
    return this.root.locator("shadow-claw-chat");
  }

  filesComponent() {
    return this.root.locator("shadow-claw-files");
  }

  tasksComponent() {
    return this.root.locator("shadow-claw-tasks");
  }

  toastComponent() {
    return this.root.locator("shadow-claw-toast");
  }
}
