import { expect } from "@playwright/test";
import { FileBrowserComponent } from "../components/file-browser.component.mjs";

/**
 * Files page object with filesystem UI helpers.
 */
export class FilesPage {
  /** @param {import('./app.page.mjs').AppPage} app */
  constructor(app) {
    this.app = app;
    this.page = app.page;
    this.host = app.filesComponent();
    this.browser = new FileBrowserComponent(this.host);
  }

  async open() {
    await this.app.navigateTo("files");
    await expect(this.host).toHaveCount(1);
  }

  // Expose component methods for backward compatibility
  fileList() {
    return this.browser.fileList();
  }

  uploadButton() {
    return this.browser.uploadButton();
  }

  fileInput() {
    return this.browser.fileInput();
  }

  breadcrumbs() {
    return this.browser.breadcrumbs();
  }

  allButtons() {
    return this.host.locator("button");
  }
}
