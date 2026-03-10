import { expect } from "@playwright/test";

/**
 * Navigation component - handles app-level page switching and nav bar interactions.
 */
export class NavComponent {
  /**
   * @param {import('@playwright/test').Locator} root - The shadow-claw root locator
   */
  constructor(root) {
    this.root = root;
  }

  navItem(pageId) {
    return this.root.locator(`.nav-item[data-page="${pageId}"]`);
  }

  allNavItems() {
    return this.root.locator(".nav-item");
  }

  activePage() {
    return this.root.locator(".page.active");
  }

  async navigateTo(pageId) {
    await this.navItem(pageId).click();
    await expect(this.activePage()).toHaveAttribute("data-page-id", pageId);
  }

  async currentPageId() {
    return this.activePage().getAttribute("data-page-id");
  }

  async navItemCount() {
    return this.allNavItems().count();
  }

  async isPageActive(pageId) {
    const currentId = await this.currentPageId();
    return currentId === pageId;
  }
}
