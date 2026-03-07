import { deleteAllGroupFiles } from "../storage/deleteAllGroupFiles.mjs";
import { deleteGroupDirectory } from "../storage/deleteGroupDirectory.mjs";
import { deleteGroupFile } from "../storage/deleteGroupFile.mjs";
import { downloadAllGroupFilesAsZip } from "../storage/downloadAllGroupFilesAsZip.mjs";
import { downloadGroupDirectoryAsZip } from "../storage/downloadGroupDirectoryAsZip.mjs";
import { downloadGroupFile } from "../storage/downloadGroupFile.mjs";
import { restoreAllGroupFilesFromZip } from "../storage/restoreAllGroupFilesFromZip.mjs";
import { uploadGroupFile } from "../storage/uploadGroupFile.mjs";

import { effect } from "../effect.mjs";
import { fileViewerStore } from "../stores/file-viewer.mjs";
import { orchestratorStore } from "../stores/orchestrator.mjs";

import { getDb } from "../db/db.mjs";

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

        .header {
          background-color: var(--shadow-claw-bg-primary, #ffffff);
          border-bottom: 0.0625rem solid var(--shadow-claw-border-color, #e5e7eb);
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 1rem;
        }

        .header-top {
          align-items: center;
          display: flex;
          justify-content: space-between;
        }

        .header h2 {
          font-size: 1.125rem;
          font-weight: 600;
          margin: 0;
        }

        .breadcrumbs {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          font-size: 0.8125rem;
          gap: 0.5rem;
        }

        .breadcrumb-btn {
          background-color: var(--shadow-claw-bg-primary, #ffffff);
          border-radius: 0.1875rem;
          border: 0.0625rem solid var(--shadow-claw-border-color, #e5e7eb);
          color: var(--shadow-claw-accent-primary, #3b82f6);
          cursor: pointer;
          padding: 0.25rem 0.5rem;
          transition: all 0.1s;
        }

        .breadcrumb-btn:hover {
          background-color: var(--shadow-claw-bg-tertiary, #f3f4f6);
          border-color: var(--shadow-claw-accent-primary, #3b82f6);
        }

        .breadcrumb-separator {
          color: var(--shadow-claw-text-tertiary, #9ca3af);
        }

        .content {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
        }

        .file-list {
          display: grid;
          gap: 0.75rem;
          grid-template-columns: repeat(auto-fill, minmax(9.375rem, 1fr));
        }

        .file-item {
          align-items: center;
          background-color: var(--shadow-claw-bg-secondary, #f9fafb);
          border-radius: 0.5rem;
          border: 0.0625rem solid var(--shadow-claw-border-color, #e5e7eb);
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding: 0.75rem;
          position: relative;
          text-align: center;
          transition: all 0.15s;
        }

        .file-item:hover {
          background-color: var(--shadow-claw-bg-tertiary, #f3f4f6);
          border-color: var(--shadow-claw-accent-primary, #3b82f6);
          transform: translateY(-0.125rem);
        }

        .file-actions {
          display: none;
          gap: 0.25rem;
          position: absolute;
          right: 0.25rem;
          top: 0.25rem;
          z-index: 10;
        }

        .file-item:hover .file-actions {
          display: flex;
        }

        .action-btn {
          background-color: var(--shadow-claw-bg-primary, #ffffff);
          border-radius: var(--shadow-claw-radius-s);
          border: 0.0625rem solid var(--shadow-claw-border-color, #e5e7eb);
          color: var(--shadow-claw-text-primary, #111827);
          cursor: pointer;
          font-size: 0.6875rem;
          padding: 0.25rem 0.375rem;
          transition: all 0.1s;
        }

        .action-btn:hover {
          background-color: var(--shadow-claw-accent-primary);
          border-color: var(--shadow-claw-accent-primary);
          color: var(--shadow-claw-on-primary);
        }

        .action-btn.delete {
          border-color: var(--shadow-claw-error-color, #ef4444);
          color: var(--shadow-claw-error-color, #ef4444);
        }

        .action-btn.delete:hover {
          background-color: var(--shadow-claw-error-color, #ef4444);
          color: var(--shadow-claw-on-error, white);
        }

        .file-icon {
          font-size: 2rem;
        }

        .file-name {
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          color: var(--shadow-claw-text-primary, #111827);
          display: -webkit-box;
          font-size: 0.8125rem;
          font-weight: 500;
          overflow: hidden;
          word-break: break-all;
        }

        .empty-state {
          align-items: center;
          color: var(--shadow-claw-text-tertiary, #9ca3af);
          display: flex;
          flex-direction: column;
          grid-column: 1 / -1;
          height: 100%;
          justify-content: center;
          text-align: center;
        }

        .empty-state p {
          font-size: 0.875rem;
        }

        .header-actions {
          display: flex;
          gap: 0.5rem;
        }

        .header-btn {
          background-color: var(--shadow-claw-bg-tertiary);
          border-radius: var(--shadow-claw-radius-m);
          border: 0.0625rem solid var(--shadow-claw-border-color);
          color: var(--shadow-claw-text-secondary);
          cursor: pointer;
          font-size: 0.75rem;
          padding: 0.25rem 0.75rem;
        }

        .header-btn.danger {
          border-color: var(--shadow-claw-error-color, #ef4444);
          color: var(--shadow-claw-error-color, #ef4444);
        }

        .hidden-input {
          display: none;
        }

        .empty-state-hint {
          font-size: 0.75rem;
        }
      </style>
      <div class="header">
        <div class="header-top">
          <h2>📁 Files</h2>
          <div class="header-actions">
            <button class="refresh-btn header-btn">🔄 Refresh</button>
            <button class="upload-btn header-btn">📤 Upload</button>
            <button class="backup-btn header-btn">💾 Backup</button>
            <button class="restore-btn header-btn">♻️ Restore</button>
            <button class="clear-btn header-btn danger">🗑️ Clear All</button>
          </div>
        </div>
        <div class="breadcrumbs"></div>
      </div>
      <input type="file" class="hidden-upload hidden-input" multiple accept="*/*">
      <input type="file" class="hidden-restore hidden-input" accept=".zip,application/zip">
      <div class="content">
        <div class="file-list"></div>
      </div>
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
    const refreshBtn = root.querySelector(".refresh-btn");
    refreshBtn?.addEventListener("click", () =>
      orchestratorStore.loadFiles(db),
    );

    // Upload button
    const uploadBtn = root.querySelector(".upload-btn");
    const uploadInput = root.querySelector(".hidden-upload");
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
    const backupBtn = root.querySelector(".backup-btn");
    backupBtn?.addEventListener("click", () => this.handleBackup(db));

    // Restore button
    const restoreBtn = root.querySelector(".restore-btn");
    const restoreInput = root.querySelector(".hidden-restore");
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
    const clearBtn = root.querySelector(".clear-btn");
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
    const breadcrumbs = root.querySelector(".breadcrumbs");
    if (!breadcrumbs) {
      return;
    }

    const currentPath = orchestratorStore.currentPath;
    breadcrumbs.innerHTML = "";

    // Root button
    const rootBtn = document.createElement("button");
    rootBtn.className = "breadcrumb-btn";
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
          separator.className = "breadcrumb-separator";
          separator.textContent = "/";

          breadcrumbs.appendChild(separator);

          currentSegmentPath =
            index === 0 ? part : `${currentSegmentPath}/${part}`;

          const btn = document.createElement("button");
          btn.className = "breadcrumb-btn";
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

    const list = root.querySelector(".file-list");
    if (!list) {
      return;
    }

    const files = orchestratorStore.files;
    const currentPath = orchestratorStore.currentPath;

    if (files.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <p>No files in this folder.</p>
          <p class="empty-state-hint">Ask the agent to create some files!</p>
        </div>
      `;

      return;
    }

    list.innerHTML = "";
    files.forEach((/** @type {string} */ file) => {
      const isDir = file.endsWith("/");
      const name = isDir ? file.slice(0, -1) : file;

      const item = document.createElement("div");
      item.className = "file-item";

      const downloadTitle = isDir ? "Download as ZIP" : "Download";
      const actionsHtml = `
        <div class="file-actions">
          <button class="action-btn download" title="${downloadTitle}">📥</button>
          <button class="action-btn delete" title="Delete">🗑️</button>
        </div>
      `;

      item.innerHTML = `
        <div class="file-icon">${isDir ? "📁" : "📄"}</div>
        <div class="file-name">${this.escapeHtml(name)}</div>
        ${actionsHtml}
      `;

      // Click to open file or navigate into folder
      item.addEventListener("click", async (e) => {
        if (e.target instanceof Element && e.target.closest(".file-actions")) {
          return;
        }

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
      const downloadBtn = item.querySelector(".download");
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
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);

            alert(`Failed to download: ${message}`);

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
      const deleteBtn = item.querySelector(".delete");
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
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);

              alert(`Failed to delete: ${message}`);

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
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      alert(`Failed to upload files: ${message}`);

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
      const btn = this.shadowRoot?.querySelector(".backup-btn");
      if (btn instanceof HTMLButtonElement) {
        btn.disabled = true;
      }

      if (btn) {
        btn.textContent = "⏳";
      }

      await downloadAllGroupFilesAsZip(db, groupId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      alert(`Failed to create backup: ${message}`);

      console.error("Backup error:", err);
    } finally {
      const btn = this.shadowRoot?.querySelector(".backup-btn");

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
      alert("Please select a .zip file");

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
      const btn = this.shadowRoot?.querySelector(".restore-btn");
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

      alert("Files restored successfully!");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      alert(`Failed to restore from backup: ${message}`);

      console.error("Restore error:", err);
    } finally {
      const btn = this.shadowRoot?.querySelector(".restore-btn");
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
      const btn = this.shadowRoot?.querySelector(".clear-btn");
      if (btn instanceof HTMLButtonElement) {
        btn.disabled = true;
      }

      if (btn) {
        btn.textContent = "⏳";
      }

      await deleteAllGroupFiles(db, groupId);
      await orchestratorStore.resetToRootFolder(db);
      await orchestratorStore.loadFiles(db);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      alert(`Failed to clear files: ${message}`);

      console.error("Clear error:", err);
    } finally {
      const btn = this.shadowRoot?.querySelector(".clear-btn");
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
