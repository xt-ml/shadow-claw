import { expect, Locator } from "@playwright/test";

export class NavComponent {
  private readonly root: Locator;

  constructor(root: Locator) {
    this.root = root;
  }

  activePage(): Locator {
    return this.root.locator(".page.active");
  }

  allNavItems(): Locator {
    return this.root.locator(".nav-item");
  }

  navItem(pageId: string): Locator {
    return this.root.locator(`.nav-item[data-page="${pageId}"]`);
  }

  async currentPageId(): Promise<string | null> {
    return this.activePage().getAttribute("data-page-id");
  }

  async isPageActive(pageId: string): Promise<boolean> {
    const currentId = await this.currentPageId();

    return currentId === pageId;
  }

  async navigateTo(pageId: string) {
    await this.navItem(pageId).click();

    await expect(this.activePage()).toHaveAttribute("data-page-id", pageId);
  }

  async navItemCount(): Promise<number> {
    return this.allNavItems().count();
  }
}
