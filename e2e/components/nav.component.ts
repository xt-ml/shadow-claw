import { expect, Locator } from "@playwright/test";

export class NavComponent {
  private readonly root: Locator;

  constructor(root: Locator) {
    this.root = root;
  }

  navItem(pageId: string): Locator {
    return this.root.locator(`.nav-item[data-page="${pageId}"]`);
  }

  allNavItems(): Locator {
    return this.root.locator(".nav-item");
  }

  activePage(): Locator {
    return this.root.locator(".page.active");
  }

  async navigateTo(pageId: string) {
    await this.navItem(pageId).click();

    await expect(this.activePage()).toHaveAttribute("data-page-id", pageId);
  }

  async currentPageId(): Promise<string | null> {
    return this.activePage().getAttribute("data-page-id");
  }

  async navItemCount(): Promise<number> {
    return this.allNavItems().count();
  }

  async isPageActive(pageId: string): Promise<boolean> {
    const currentId = await this.currentPageId();

    return currentId === pageId;
  }
}
