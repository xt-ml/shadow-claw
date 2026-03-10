import { expect } from "@playwright/test";
import { NavComponent } from "../components/nav.component.mjs";

/**
 * Root application object for ShadowClaw E2E tests.
 */
export class AppPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.root = page.locator("shadow-claw");
    this.nav = new NavComponent(this.root);
  }

  async open() {
    await this.page.goto("/");
    await this.waitForReady();
  }

  async waitForReady() {
    await this.page.waitForFunction(() => {
      const isDefined = !!customElements.get("shadow-claw");
      const el = document.querySelector("shadow-claw");
      return isDefined && !!el && !!el.shadowRoot;
    });

    await expect(this.root).toHaveCount(1);
    await expect(this.nav.activePage()).toHaveCount(1);
  }

  // Delegate navigation to NavComponent
  async navigateTo(pageId) {
    await this.nav.navigateTo(pageId);
  }

  /**
   * Navigate pages without pointer interaction (useful when a native dialog is open).
   * @param {string} pageId
   */
  async navigateToWithOpenDialog(pageId) {
    await this.page.evaluate((targetPageId) => {
      const app = document.querySelector("shadow-claw");
      app?.showPage(targetPageId);
    }, pageId);

    await expect(this.activePage()).toHaveAttribute("data-page-id", pageId);
  }

  async currentPageId() {
    return this.nav.currentPageId();
  }

  // Expose nav component methods for backward compatibility
  navItems() {
    return this.nav.allNavItems();
  }

  activePage() {
    return this.nav.activePage();
  }

  navItem(pageId) {
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
