import { deleteAllGroupFiles } from "../storage/deleteAllGroupFiles.mjs";
import { deleteGroupDirectory } from "../storage/deleteGroupDirectory.mjs";
import { deleteGroupFile } from "../storage/deleteGroupFile.mjs";
import { downloadAllGroupFilesAsZip } from "../storage/downloadAllGroupFilesAsZip.mjs";
import { downloadGroupDirectoryAsZip } from "../storage/downloadGroupDirectoryAsZip.mjs";
import { downloadGroupFile } from "../storage/downloadGroupFile.mjs";
import { restoreAllGroupFilesFromZip } from "../storage/restoreAllGroupFilesFromZip.mjs";
import { uploadGroupFile } from "../storage/uploadGroupFile.mjs";

import { effect } from "../effect.mjs";
import { showError, showSuccess, showWarning } from "../toast.mjs";
import { fileViewerStore } from "../stores/file-viewer.mjs";
import { orchestratorStore } from "../stores/orchestrator.mjs";

import { getDb } from "../db/db.mjs";

import "./shadow-claw-page-header.mjs";

/**
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

export class ShadowClawFiles extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    /** @type {string[]} */
    this.files = [];
    /** @type {() => void} */
    this.cleanup = () => {};
  }

  static getTemplate() {
    return `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          font-family: var(--shadow-claw-font-sans, system-ui, sans-serif);
          height: 100%;
          overflow: hidden;
        }

        .files__breadcrumbs {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          font-size: 0.8125rem;
          gap: 0.5rem;
        }

        .files__breadcrumb-btn {
          background-color: var(--shadow-claw-bg-primary, #ffffff);
          border-radius: 0.1875rem;
          border: 0.0625rem solid var(--shadow-claw-border-color, #e5e7eb);
          color: var(--shadow-claw-accent-primary, #3b82f6);
          cursor: pointer;
          padding: 0.25rem 0.5rem;
          transition: all 0.1s;
        }

        .files__breadcrumb-btn:hover,
        .files__breadcrumb-btn:focus-visible {
          background-color: var(--shadow-claw-bg-tertiary, #f3f4f6);
          border-color: var(--shadow-claw-accent-primary, #3b82f6);
          outline: none;
        }

        .files__breadcrumb-separator {
          color: var(--shadow-claw-text-tertiary, #9ca3af);
        }

        .files__header-btn {
          background-color: var(--shadow-claw-bg-tertiary);
          border-radius: var(--shadow-claw-radius-m);
          border: 0.0625rem solid var(--shadow-claw-border-color);
          color: var(--shadow-claw-text-secondary);
          cursor: pointer;
          font-size: 0.75rem;
          padding: 0.5rem 0.75rem;
          white-space: nowrap;
        }

        .files__header-btn:focus-visible {
          outline: 0.125rem solid var(--shadow-claw-accent-primary, #3b82f6);
          outline-offset: 0.0625rem;
        }

        .files__header-btn--danger {
          border-color: var(--shadow-claw-error-color, #ef4444);
          color: var(--shadow-claw-error-color, #ef4444);
        }

        .files__content {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
        }

        .files__list {
          display: grid;
          gap: 0.75rem;
          grid-template-columns: repeat(auto-fill, minmax(9.375rem, 1fr));
        }

        .files__item {
          background-color: var(--shadow-claw-bg-secondary, #f9fafb);
          border-radius: 0.5rem;
          border: 0.0625rem solid var(--shadow-claw-border-color, #e5e7eb);
          display: flex;
          flex-direction: column;
          position: relative;
          transition: all 0.15s;
        }

        .files__item:hover,
        .files__item:focus-within {
          background-color: var(--shadow-claw-bg-tertiary, #f3f4f6);
          border-color: var(--shadow-claw-accent-primary, #3b82f6);
          transform: translateY(-0.125rem);
        }

        .files__item-main {
          align-items: center;
          background: transparent;
          border: none;
          color: inherit;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding: 0.75rem;
          text-align: center;
          width: 100%;
        }

        .files__item-main:focus-visible {
          outline: 0.125rem solid var(--shadow-claw-accent-primary, #3b82f6);
          outline-offset: -0.125rem;
        }

        .files__actions {
          display: none;
          gap: 0.25rem;
          position: absolute;
          right: 0.25rem;
          top: 0.25rem;
          z-index: 10;
        }

        .files__item:hover .files__actions,
        .files__item:focus-within .files__actions {
          display: flex;
        }

        .files__action-btn {
          background-color: var(--shadow-claw-bg-primary, #ffffff);
          border-radius: var(--shadow-claw-radius-s);
          border: 0.0625rem solid var(--shadow-claw-border-color, #e5e7eb);
          color: var(--shadow-claw-text-primary, #111827);
          cursor: pointer;
          font-size: 0.6875rem;
          padding: 0.25rem 0.375rem;
          transition: all 0.1s;
        }

        .files__action-btn:hover,
        .files__action-btn:focus-visible {
          background-color: var(--shadow-claw-accent-primary);
          border-color: var(--shadow-claw-accent-primary);
          color: var(--shadow-claw-on-primary);
          outline: none;
        }

        .files__action-btn--delete {
          border-color: var(--shadow-claw-error-color, #ef4444);
          color: var(--shadow-claw-error-color, #ef4444);
        }

        .files__action-btn--delete:hover,
        .files__action-btn--delete:focus-visible {
          background-color: var(--shadow-claw-error-color, #ef4444);
          color: var(--shadow-claw-on-error, white);
          outline: none;
        }

        .files__icon {
          font-size: 2rem;
        }

        .files__name {
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          color: var(--shadow-claw-text-primary, #111827);
          display: -webkit-box;
          font-size: 0.8125rem;
          font-weight: 500;
          overflow: hidden;
          word-break: break-all;
        }

        .files__empty {
          align-items: center;
          color: var(--shadow-claw-text-tertiary, #9ca3af);
          display: flex;
          flex-direction: column;
          grid-column: 1 / -1;
          height: 100%;
          justify-content: center;
          text-align: center;
        }

        .files__empty p {
          font-size: 0.875rem;
        }

        .files__hidden-input {
          display: none;
        }

        .files__empty-hint {
          font-size: 0.75rem;
        }

        .files__sr-only {
          border: 0;
          clip: rect(0 0 0 0);
          height: 0.0625rem;
          margin: -0.0625rem;
          overflow: hidden;
          padding: 0;
          position: absolute;
          white-space: nowrap;
          width: 0.0625rem;
        }
      </style>
      <section class="files" aria-label="Files">
        <shadow-claw-page-header icon="📁" title="Files">
          <button slot="actions" type="button" class="files__refresh-btn files__header-btn">🔄 Refresh</button>
          <button slot="actions" type="button" class="files__upload-btn files__header-btn">📤 Upload</button>
          <button slot="actions" type="button" class="files__backup-btn files__header-btn">💾 Backup</button>
          <button slot="actions" type="button" class="files__restore-btn files__header-btn">♻️ Restore</button>
          <button slot="actions" type="button" class="files__clear-btn files__header-btn files__header-btn--danger">🗑️ Clear All</button>
          <nav slot="breadcrumbs" class="files__breadcrumbs" aria-label="Current folder"></nav>
        </shadow-claw-page-header>
        <input type="file" class="files__hidden-upload files__hidden-input" multiple accept="*/*" aria-label="Upload files">
        <input type="file" class="files__hidden-restore files__hidden-input" accept=".zip,application/zip" aria-label="Restore files from zip backup">
        <div class="files__content">
          <div class="files__list" role="list" aria-live="polite"></div>
        </div>
      </section>
    `;
  }

  connectedCallback() {
    const db = getDb();

    if (!db) {
      throw new Error(
        "shadow-claw-files cannot get the db on connectedCallback",
      );
    }

    this.render();

    // Re-render when files or path change
    this.cleanup = effect(() => {
      orchestratorStore.files;
      orchestratorStore.currentPath;
      this.updateBreadcrumbs(db);
      this.updateFileList(db);
    });

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    // Refresh button
    const refreshBtn = root.querySelector(".files__refresh-btn");
    refreshBtn?.addEventListener("click", () =>
      orchestratorStore.loadFiles(db),
    );

    // Upload button
    const uploadBtn = root.querySelector(".files__upload-btn");
    const uploadInput = root.querySelector(".files__hidden-upload");
    uploadBtn?.addEventListener("click", () => {
      if (uploadInput instanceof HTMLInputElement) {
        uploadInput.click();
      }
    });

    uploadInput?.addEventListener("change", (e) => {
      if (e.target instanceof HTMLInputElement) {
        this.handleUpload(db, e.target);
      }
    });

    // Backup button
    const backupBtn = root.querySelector(".files__backup-btn");
    backupBtn?.addEventListener("click", () => this.handleBackup(db));

    // Restore button
    const restoreBtn = root.querySelector(".files__restore-btn");
    const restoreInput = root.querySelector(".files__hidden-restore");
    restoreBtn?.addEventListener("click", () => {
      if (restoreInput instanceof HTMLInputElement) {
        restoreInput.click();
      }
    });

    restoreInput?.addEventListener("change", (e) => {
      if (e.target instanceof HTMLInputElement)
        this.handleRestore(db, e.target);
    });

    // Clear all button
    const clearBtn = root.querySelector(".files__clear-btn");
    clearBtn?.addEventListener("click", () => this.handleClearAll(db));
  }

  disconnectedCallback() {
    this.cleanup();
  }

  render() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }
    const template = document.createElement("template");
    template.innerHTML = ShadowClawFiles.getTemplate();
    root.innerHTML = "";
    root.appendChild(template.content.cloneNode(true));
  }

  /**
   * @param {ShadowClawDatabase} db
   */
  updateBreadcrumbs(db) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }
    const breadcrumbs = root.querySelector(".files__breadcrumbs");
    if (!breadcrumbs) {
      return;
    }

    const currentPath = orchestratorStore.currentPath;
    breadcrumbs.innerHTML = "";

    // Root button
    const rootBtn = document.createElement("button");
    rootBtn.className = "files__breadcrumb-btn";
    rootBtn.textContent = "📁 Root";
    rootBtn.addEventListener("click", () =>
      orchestratorStore.resetToRootFolder(db),
    );

    breadcrumbs.appendChild(rootBtn);

    // Path segments
    if (currentPath !== ".") {
      const parts = currentPath.split("/").filter(Boolean);

      let currentSegmentPath = "";

      parts.forEach(
        (/** @type {string} */ part, /** @type {number} */ index) => {
          const separator = document.createElement("span");
          separator.className = "files__breadcrumb-separator";
          separator.textContent = "/";

          breadcrumbs.appendChild(separator);

          currentSegmentPath =
            index === 0 ? part : `${currentSegmentPath}/${part}`;

          const btn = document.createElement("button");
          btn.className = "files__breadcrumb-btn";
          btn.textContent = part;

          const pathToNavigate = currentSegmentPath;
          btn.addEventListener("click", async () => {
            orchestratorStore._currentPath.set(pathToNavigate);
            await orchestratorStore.loadFiles(db);
          });

          breadcrumbs.appendChild(btn);
        },
      );
    }
  }

  /**
   * @param {ShadowClawDatabase} db
   */
  updateFileList(db) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const list = root.querySelector(".files__list");
    if (!list) {
      return;
    }

    const files = orchestratorStore.files;
    const currentPath = orchestratorStore.currentPath;

    if (files.length === 0) {
      list.innerHTML = `
        <div class="files__empty" role="status">
          <p>No files in this folder.</p>
          <p class="files__empty-hint">Ask the agent to create some files!</p>
        </div>
      `;

      return;
    }

    list.innerHTML = "";
    files.forEach((/** @type {string} */ file) => {
      const isDir = file.endsWith("/");
      const name = isDir ? file.slice(0, -1) : file;

      const item = document.createElement("div");
      item.className = "files__item";
      item.setAttribute("role", "listitem");

      const downloadTitle = isDir ? "Download as ZIP" : "Download";
      const actionsHtml = `
        <div class="files__actions" aria-label="Actions for ${this.escapeHtml(name)}">
          <button type="button" class="files__action-btn files__download" title="${downloadTitle}" aria-label="${downloadTitle} ${this.escapeHtml(name)}">📥</button>
          <button type="button" class="files__action-btn files__action-btn--delete files__delete" title="Delete" aria-label="Delete ${this.escapeHtml(name)}">🗑️</button>
        </div>
      `;

      item.innerHTML = `
        <button type="button" class="files__item-main" aria-label="${isDir ? "Open folder" : "Open file"} ${this.escapeHtml(name)}">
          <div class="files__icon" aria-hidden="true">${isDir ? "📁" : "📄"}</div>
          <div class="files__name">${this.escapeHtml(name)}</div>
        </button>
        ${actionsHtml}
      `;

      // Click to open file or navigate into folder
      const itemMain = item.querySelector(".files__item-main");
      itemMain?.addEventListener("click", async () => {
        if (isDir) {
          // Navigate into folder
          await orchestratorStore.navigateIntoFolder(db, file);
        } else {
          // Open file in viewer
          const filePath =
            currentPath === "." ? file : `${currentPath}/${file}`;

          fileViewerStore.openFile(
            db,
            filePath,
            orchestratorStore.activeGroupId,
          );
        }
      });

      // Download button (for both files and directories)
      const downloadBtn = item.querySelector(".files__download");
      if (downloadBtn) {
        downloadBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          try {
            if (downloadBtn instanceof HTMLButtonElement)
              downloadBtn.disabled = true;

            downloadBtn.textContent = "⏳";

            const itemPath =
              currentPath === "." ? file : `${currentPath}/${file}`;

            if (isDir) {
              await downloadGroupDirectoryAsZip(
                db,
                orchestratorStore.activeGroupId,
                itemPath,
              );
            } else {
              await downloadGroupFile(
                db,
                orchestratorStore.activeGroupId,
                itemPath,
              );
            }

            showSuccess(
              isDir ? `Downloaded folder: ${name}` : `Downloaded file: ${name}`,
              2500,
            );
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);

            showError(`Failed to download ${name}: ${message}`, 6000);

            console.error("Download error:", err);
          } finally {
            if (downloadBtn instanceof HTMLButtonElement) {
              downloadBtn.disabled = false;
            }

            downloadBtn.textContent = "📥";
          }
        });
      }

      // Delete button
      const deleteBtn = item.querySelector(".files__delete");
      if (deleteBtn) {
        deleteBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const action = isDir
            ? "delete this folder and all its contents"
            : "delete this file";

          if (confirm(`Are you sure you want to ${action}?\n\n${name}`)) {
            try {
              const itemPath =
                currentPath === "." ? file : `${currentPath}/${file}`;
              if (isDir) {
                await deleteGroupDirectory(
                  db,
                  orchestratorStore.activeGroupId,
                  itemPath,
                );
              } else {
                await deleteGroupFile(
                  db,
                  orchestratorStore.activeGroupId,
                  itemPath,
                );
              }
              await orchestratorStore.loadFiles(db);
              showSuccess(
                isDir ? `Deleted folder: ${name}` : `Deleted file: ${name}`,
                3000,
              );
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);

              showError(`Failed to delete ${name}: ${message}`, 6000);

              console.error("Delete error:", err);
            }
          }
        });
      }

      list.appendChild(item);
    });
  }

  /**
   * Escape HTML special characters
   *
   * @param {string} text
   *
   * @returns {string}
   */
  escapeHtml(text) {
    const div = document.createElement("div");

    div.textContent = text;

    return div.innerHTML;
  }

  /**
   * Handle file upload
   *
   * @param {ShadowClawDatabase} db
   * @param {HTMLInputElement} input
   */
  async handleUpload(db, input) {
    const files = input.files;
    if (!files || files.length === 0) {
      return;
    }

    const groupId = orchestratorStore.activeGroupId;
    const currentPath = orchestratorStore.currentPath;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filename =
          currentPath === "." ? file.name : `${currentPath}/${file.name}`;

        await uploadGroupFile(db, groupId, filename, file);
      }
      // Clear the input
      input.value = "";

      // Reload files
      await orchestratorStore.loadFiles(db);
      showSuccess(
        `Uploaded ${files.length} file${files.length === 1 ? "" : "s"}`,
        3000,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      showError(`Failed to upload files: ${message}`, 6000);

      console.error("Upload error:", err);
    }
  }

  /**
   * Handle backup (download all files as zip)
   *
   * @param {ShadowClawDatabase} db
   */
  async handleBackup(db) {
    const groupId = orchestratorStore.activeGroupId;
    try {
      const btn = this.shadowRoot?.querySelector(".files__backup-btn");
      if (btn instanceof HTMLButtonElement) {
        btn.disabled = true;
      }

      if (btn) {
        btn.textContent = "⏳";
      }

      await downloadAllGroupFilesAsZip(db, groupId);
      showSuccess("Backup created successfully", 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      showError(`Failed to create backup: ${message}`, 6000);

      console.error("Backup error:", err);
    } finally {
      const btn = this.shadowRoot?.querySelector(".files__backup-btn");

      if (btn instanceof HTMLButtonElement) {
        btn.disabled = false;
      }

      if (btn) {
        btn.textContent = "💾 Backup";
      }
    }
  }

  /**
   * Handle restore (upload and extract zip)
   *
   * @param {ShadowClawDatabase} db
   *
   * @param {HTMLInputElement} input
   */
  async handleRestore(db, input) {
    const files = input.files;
    if (!files || files.length === 0) {
      return;
    }

    const zipFile = files[0];
    if (!zipFile.name.endsWith(".zip")) {
      showWarning("Please select a .zip file", 3500);

      return;
    }

    const groupId = orchestratorStore.activeGroupId;

    if (
      !confirm("Restore from backup will replace all current files. Continue?")
    ) {
      input.value = "";

      return;
    }

    try {
      const btn = this.shadowRoot?.querySelector(".files__restore-btn");
      if (btn instanceof HTMLButtonElement) {
        btn.disabled = true;
      }

      if (btn) {
        btn.textContent = "⏳";
      }

      await restoreAllGroupFilesFromZip(db, groupId, zipFile);

      input.value = "";

      await orchestratorStore.resetToRootFolder(db);
      await orchestratorStore.loadFiles(db);

      showSuccess("Files restored successfully", 3500);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      showError(`Failed to restore from backup: ${message}`, 6000);

      console.error("Restore error:", err);
    } finally {
      const btn = this.shadowRoot?.querySelector(".files__restore-btn");
      if (btn instanceof HTMLButtonElement) {
        btn.disabled = false;
      }

      if (btn) {
        btn.textContent = "♻️ Restore";
      }
    }
  }

  /**
   * Handle clear all (delete all files)
   *
   * @param {ShadowClawDatabase} db
   */
  async handleClearAll(db) {
    if (!confirm("Delete ALL files? This cannot be undone!")) {
      return;
    }

    const groupId = orchestratorStore.activeGroupId;

    try {
      const btn = this.shadowRoot?.querySelector(".files__clear-btn");
      if (btn instanceof HTMLButtonElement) {
        btn.disabled = true;
      }

      if (btn) {
        btn.textContent = "⏳";
      }

      await deleteAllGroupFiles(db, groupId);
      await orchestratorStore.resetToRootFolder(db);
      await orchestratorStore.loadFiles(db);
      showSuccess("All files deleted", 3500);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      showError(`Failed to clear files: ${message}`, 6000);

      console.error("Clear error:", err);
    } finally {
      const btn = this.shadowRoot?.querySelector(".files__clear-btn");
      if (btn instanceof HTMLButtonElement) {
        btn.disabled = false;
      }

      if (btn) {
        btn.textContent = "🗑️ Clear All";
      }
    }
  }
}

customElements.define("shadow-claw-files", ShadowClawFiles);
