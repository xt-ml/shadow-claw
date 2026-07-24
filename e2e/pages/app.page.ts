import { Page, expect } from "@playwright/test";

import { NavComponent } from "../components/nav.component.js";

export class AppPage {
  nav;
  page: Page;
  root;

  constructor(page: Page) {
    this.page = page;
    this.root = page.locator("shadow-claw");
    this.nav = new NavComponent(this.root);
  }

  activePage() {
    return this.nav.activePage();
  }

  chatComponent() {
    return this.root.locator("shadow-claw-chat");
  }

  filesComponent() {
    return this.root.locator("shadow-claw-files");
  }

  navItem(pageId: string) {
    return this.nav.navItem(pageId);
  }

  navItems() {
    return this.nav.allNavItems();
  }

  tasksComponent() {
    return this.root.locator("shadow-claw-tasks");
  }

  toastComponent() {
    return this.root.locator("shadow-claw-toast");
  }

  async currentPageId() {
    return this.nav.currentPageId();
  }

  async navigateTo(pageId: string) {
    await this.nav.navigateTo(pageId);
  }

  async navigateToWithOpenDialog(pageId: string) {
    let switched = await this.page
      .evaluate((targetPageId) => {
        const app = document.querySelector("shadow-claw") as any;

        if (!app) {
          return false;
        }

        document.dispatchEvent(
          new CustomEvent("shadow-claw-navigate", {
            detail: { page: targetPageId },
          }),
        );

        return true;
      }, pageId)
      .catch(() => false);

    if (!switched) {
      await this.waitForReady();

      switched = await this.page
        .evaluate((targetPageId) => {
          const app = document.querySelector("shadow-claw") as any;

          if (!app) {
            return false;
          }

          document.dispatchEvent(
            new CustomEvent("shadow-claw-navigate", {
              detail: { page: targetPageId },
            }),
          );

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

  async open() {
    await this.page.addInitScript(() => {
      (window as any).__SHADOWCLAW_E2E_ENABLE__ = true;
    });
    await this.page.goto("/");
    await this.waitForReady();
  }

  async waitForReady() {
    await this.page.waitForFunction(
      () => {
        const isDefined = !!customElements.get("shadow-claw");
        const el = document.querySelector("shadow-claw") as any;
        const bridge = (window as any).__SHADOWCLAW_E2E__;

        return (
          isDefined && !!el && !!el.shadowRoot && !!bridge && bridge.isReady()
        );
      },
      { timeout: 45000 },
    );

    await expect(this.root).toHaveCount(1);
    await expect(this.nav.activePage()).toHaveCount(1);
  }
}
