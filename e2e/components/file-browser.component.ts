import { expect, Locator } from "@playwright/test";

export class FileBrowserComponent {
  private readonly host: Locator;

  constructor(filesHost: Locator) {
    this.host = filesHost;
  }

  fileList() {
    return this.host.locator(".files__list");
  }

  breadcrumbs() {
    return this.host.locator(".files__breadcrumbs");
  }

  uploadButton() {
    return this.host.locator(".files__upload-btn");
  }

  backupButton() {
    return this.host.getByRole("button", { name: /backup/i });
  }

  fileInput() {
    return this.host.locator('input[type="file"]');
  }

  fileItem(name: string) {
    return this.host.locator(`[data-file-name="${name}"]`);
  }

  async expectCoreUi() {
    await expect(this.fileList()).toHaveCount(1);
    const hasUpload =
      (await this.uploadButton().count()) > 0 ||
      (await this.fileInput().count()) > 0;
    expect(hasUpload).toBe(true);
  }

  async navigateToBreadcrumb(index: number) {
    await this.breadcrumbs().locator("a, button").nth(index).click();
  }
}
