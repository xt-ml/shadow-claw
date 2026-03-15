import { deleteAllGroupFiles } from "../storage/deleteAllGroupFiles.mjs";
import { deleteGroupDirectory } from "../storage/deleteGroupDirectory.mjs";
import { deleteGroupFile } from "../storage/deleteGroupFile.mjs";
import { downloadAllGroupFilesAsZip } from "../storage/downloadAllGroupFilesAsZip.mjs";
import { downloadGroupDirectoryAsZip } from "../storage/downloadGroupDirectoryAsZip.mjs";
import { downloadGroupFile } from "../storage/downloadGroupFile.mjs";
import { restoreAllGroupFilesFromZip } from "../storage/restoreAllGroupFilesFromZip.mjs";
import { uploadGroupFile } from "../storage/uploadGroupFile.mjs";
import { writeGroupFile } from "../storage/writeGroupFile.mjs";

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

    /** @type {() => void} */
    this.vmStatusCleanup = () => {};

    /** @type {number} */
    this.uploadTotal = 0;

    /** @type {number} */
    this.uploadCompleted = 0;

    /** @type {boolean} */
    this.isDragActive = false;
  }

  static getTemplate() {
    return `
      <style>
        /* Utility classes refactored from inline styles */
        .hidden, [hidden] {
          display: none !important;
        }

        :host {
          display: flex;
          flex-direction: column;
          font-family: var(--shadow-claw-font-sans, system-ui, sans-serif);
          height: 100%;
          min-height: 0;
          overflow: hidden;
        }

        .files {
          display: flex;
          flex: 1;
          flex-direction: column;
          min-height: 0;
          overflow: hidden;
          width: 100%;
        }

        .files__breadcrumbs {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          font-size: 0.8125rem;
          gap: 0.5rem;
        }

        .files__breadcrumbs-spacer {
          flex: 1;
        }

        .files__sync-btn {
          background-color: var(--shadow-claw-bg-primary, #ffffff);
          border-radius: 0.375rem;
          border: 0.0625rem solid var(--shadow-claw-border-color, #e5e7eb);
          color: var(--shadow-claw-text-secondary, #4b5563);
          cursor: pointer;
          font-size: 0.75rem;
          padding: 0.25rem 0.5rem;
          white-space: nowrap;
        }

        .files__sync-btn:hover,
        .files__sync-btn:focus-visible {
          border-color: var(--shadow-claw-accent-primary, #3b82f6);
          color: var(--shadow-claw-accent-primary, #3b82f6);
          outline: none;
        }

        .files__sync-btn:disabled {
          cursor: not-allowed;
          opacity: 0.6;
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
          border-radius: var(--shadow-claw-radius-m);
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 1rem;
          position: relative;
        }

        .files__content--dragover {
          background-color: color-mix(in oklab, var(--shadow-claw-accent-primary) 8%, transparent);
          outline: 0.125rem dashed var(--shadow-claw-accent-primary);
          outline-offset: -0.25rem;
        }

        .files__drop-hint {
          color: var(--shadow-claw-text-tertiary, #9ca3af);
          font-size: 0.75rem;
          margin-bottom: 0.625rem;
        }

        .files__upload-progress {
          background-color: var(--shadow-claw-bg-secondary, #f9fafb);
          border: 0.0625rem solid var(--shadow-claw-border-color, #e5e7eb);
          border-radius: var(--shadow-claw-radius-m);
          display: none;
          margin-bottom: 0.75rem;
          padding: 0.625rem;
        }

        .files__upload-progress.active {
          display: block;
        }

        .files__upload-progress-label {
          color: var(--shadow-claw-text-secondary, #4b5563);
          display: block;
          font-size: 0.75rem;
          font-weight: 600;
          margin-bottom: 0.375rem;
        }

        .files__upload-progress-track {
          background-color: var(--shadow-claw-bg-tertiary, #f3f4f6);
          border-radius: 999px;
          height: 0.5rem;
          overflow: hidden;
          width: 100%;
        }

        .files__upload-progress-bar {
          background-color: var(--shadow-claw-accent-primary, #3b82f6);
          height: 100%;
          transition: width 0.2s ease;
          width: 0%;
        }

        .files__terminal-slot {
          margin-bottom: 1rem;
        }

        .files__terminal-slot:empty {
          display: none;
          margin-bottom: 0;
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
          height: 100%;
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

        .files__new-dialog {
          background-color: var(--shadow-claw-bg-primary, #ffffff);
          border: 0.0625rem solid var(--shadow-claw-border-color, #e5e7eb);
          border-radius: var(--shadow-claw-radius-m);
          color: var(--shadow-claw-text-primary, #111827);
          max-width: 22rem;
          padding: 0;
          width: calc(100vw - 2rem);
        }

        .files__new-dialog::backdrop {
          background-color: rgba(0, 0, 0, 0.35);
        }

        .files__new-form {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 1rem;
        }

        .files__new-label {
          color: var(--shadow-claw-text-secondary, #4b5563);
          font-size: 0.875rem;
          font-weight: 600;
        }

        .files__new-input {
          background-color: var(--shadow-claw-bg-primary, #ffffff);
          border: 0.0625rem solid var(--shadow-claw-border-color, #e5e7eb);
          border-radius: var(--shadow-claw-radius-s);
          color: var(--shadow-claw-text-primary, #111827);
          font-size: 0.875rem;
          min-height: 2rem;
          padding: 0.375rem 0.5rem;
        }

        .files__new-input:focus {
          border-color: var(--shadow-claw-accent-primary, #3b82f6);
          box-shadow: 0 0 0 0.125rem var(--shadow-claw-bg-tertiary, #f3f4f6);
          outline: none;
        }

        .files__new-actions {
          display: flex;
          gap: 0.5rem;
          justify-content: flex-end;
        }

        .files__new-ok,
        .files__new-cancel {
          background-color: var(--shadow-claw-bg-tertiary, #f3f4f6);
          border: 0.0625rem solid var(--shadow-claw-border-color, #e5e7eb);
          border-radius: var(--shadow-claw-radius-s);
          color: var(--shadow-claw-text-primary, #111827);
          cursor: pointer;
          font-size: 0.8125rem;
          font-weight: 600;
          min-height: 2rem;
          min-width: 4.5rem;
          padding: 0.375rem 0.625rem;
        }

        .files__new-ok {
          background-color: var(--shadow-claw-success-color, #10b981);
          border-color: var(--shadow-claw-success-color, #10b981);
          color: white;
        }

        .files__new-ok:hover,
        .files__new-ok:focus-visible {
          background-color: #059669;
          border-color: #059669;
          outline: none;
        }

        .files__new-cancel:hover,
        .files__new-cancel:focus-visible {
          background-color: var(--shadow-claw-bg-secondary, #f9fafb);
          border-color: var(--shadow-claw-accent-primary, #3b82f6);
          outline: none;
        }
      </style>
      <section class="files" aria-label="Files">
        <shadow-claw-page-header icon="📁" title="Files">
          <button slot="actions" type="button" class="files__refresh-btn files__header-btn">🔄 Refresh</button>
          <button slot="actions" type="button" class="files__upload-btn files__header-btn">📤 Upload</button>
          <button slot="actions" type="button" class="files__new-btn files__header-btn">➕ New</button>
          <button slot="actions" type="button" class="files__backup-btn files__header-btn">💾 Backup</button>
          <button slot="actions" type="button" class="files__restore-btn files__header-btn">♻️ Restore</button>
          <button slot="actions" type="button" class="files__clear-btn files__header-btn files__header-btn--danger">🗑️ Clear All</button>
          <nav slot="breadcrumbs" class="files__breadcrumbs" aria-label="Current folder">
            <span class="files__breadcrumbs-path" data-breadcrumb-path></span>
            <span class="files__breadcrumbs-spacer" aria-hidden="true" hidden></span>
            <button type="button" class="files__sync-btn files__sync-host-btn" title="Push host Files panel changes into /workspace inside WebVM" hidden>Host → VM</button>
            <button type="button" class="files__sync-btn files__sync-vm-btn" title="Pull /workspace changes from WebVM terminal back into Files panel" hidden>VM → Host</button>
          </nav>
        </shadow-claw-page-header>
        <input type="file" class="files__hidden-upload files__hidden-input" multiple accept="*/*" aria-label="Upload files">
        <input type="file" class="files__hidden-restore files__hidden-input" accept=".zip,application/zip" aria-label="Restore files from zip backup">
        <dialog class="files__new-dialog" aria-label="Create new file">
          <form class="files__new-form" method="dialog">
            <label class="files__new-label" for="files-new-name">File name</label>
            <input
              class="files__new-input"
              id="files-new-name"
              name="files-new-name"
              type="text"
              autocomplete="off"
              required
            >
            <div class="files__new-actions">
              <button class="files__new-cancel" type="button">Cancel</button>
              <button class="files__new-ok" type="submit">OK</button>
            </div>
          </form>
        </dialog>
        <div class="files__content">
          <div class="files__terminal-slot" data-terminal-slot hidden></div>
          <p class="files__drop-hint">Drop files here to upload</p>
          <div class="files__upload-progress" aria-live="polite" aria-label="Upload progress">
            <span class="files__upload-progress-label">Uploading files...</span>
            <div class="files__upload-progress-track">
              <div class="files__upload-progress-bar"></div>
            </div>
          </div>
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
    this.dispatchTerminalSlotReady();

    // Re-render when files or path change
    this.cleanup = effect(() => {
      orchestratorStore.files;
      orchestratorStore.currentPath;

      this.updateBreadcrumbs(db);
      this.updateFileList(db);
    });

    const vmStatusListener = () => {
      this.updateSyncButtonsVisibility();
    };

    orchestratorStore.orchestrator?.events?.on?.("vm-status", vmStatusListener);
    this.vmStatusCleanup = () =>
      orchestratorStore.orchestrator?.events?.off?.(
        "vm-status",
        vmStatusListener,
      );

    this.updateSyncButtonsVisibility();

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

    const content = root.querySelector(".files__content");
    if (content instanceof HTMLElement) {
      content.addEventListener("dragenter", (event) =>
        this.handleDragEnter(event, content),
      );

      content.addEventListener("dragover", (event) =>
        this.handleDragOver(event, content),
      );

      content.addEventListener("dragleave", (event) =>
        this.handleDragLeave(event, content),
      );

      content.addEventListener("drop", (event) =>
        this.handleDrop(event, db, content),
      );
    }

    // New button
    const newBtn = root.querySelector(".files__new-btn");
    const newDialog = root.querySelector(".files__new-dialog");
    const newCancelBtn = root.querySelector(".files__new-cancel");
    const newForm = root.querySelector(".files__new-form");

    newBtn?.addEventListener("click", () => this.openNewFileDialog());

    newCancelBtn?.addEventListener("click", () => {
      if (newDialog instanceof HTMLDialogElement) {
        newDialog.close();
      }
    });

    newForm?.addEventListener("submit", async (event) => {
      event.preventDefault();

      await this.handleCreateNewFile(db);
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

    const syncHostBtn = root.querySelector(".files__sync-host-btn");
    syncHostBtn?.addEventListener("click", () => this.handleSyncHostToVM());

    const syncVmBtn = root.querySelector(".files__sync-vm-btn");
    syncVmBtn?.addEventListener("click", () => this.handleSyncVMToHost(db));
  }

  disconnectedCallback() {
    this.cleanup();
    this.vmStatusCleanup();
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

  dispatchTerminalSlotReady() {
    this.dispatchEvent(
      new CustomEvent("shadow-claw-terminal-slot-ready", {
        bubbles: true,
        composed: true,
      }),
    );
  }

  /**
   * @returns {void}
   */
  updateSyncButtonsVisibility() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const spacer = root.querySelector(".files__breadcrumbs-spacer");
    const hostBtn = root.querySelector(".files__sync-host-btn");
    const vmBtn = root.querySelector(".files__sync-vm-btn");

    const vmStatus = orchestratorStore.orchestrator?.getVMStatus?.();
    const vmMode = vmStatus?.mode;
    const showSyncButtons = vmMode === "9p";

    if (spacer instanceof HTMLElement) {
      spacer.hidden = !showSyncButtons;
    }

    if (hostBtn instanceof HTMLButtonElement) {
      hostBtn.hidden = !showSyncButtons;
    }

    if (vmBtn instanceof HTMLButtonElement) {
      vmBtn.hidden = !showSyncButtons;
    }
  }

  /**
   * @param {ShadowClawDatabase} db
   */
  updateBreadcrumbs(db) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const breadcrumbs = root.querySelector("[data-breadcrumb-path]");
    if (!(breadcrumbs instanceof HTMLElement)) {
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
   * @returns {void}
   */
  handleSyncHostToVM() {
    const root = this.shadowRoot;
    const button = root?.querySelector(".files__sync-host-btn");
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    button.disabled = true;
    button.textContent = "Syncing...";

    try {
      orchestratorStore.syncHostWorkspaceToVM();
      showSuccess("Requested host → VM workspace sync", 2200);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Failed to request host → VM sync: ${message}`, 5000);
    } finally {
      setTimeout(() => {
        button.disabled = false;
        button.textContent = "Host → VM";
      }, 300);
    }
  }

  /**
   * @param {ShadowClawDatabase} db
   *
   * @returns {Promise<void>}
   */
  async handleSyncVMToHost(db) {
    const root = this.shadowRoot;
    const button = root?.querySelector(".files__sync-vm-btn");
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    button.disabled = true;
    button.textContent = "Syncing...";

    try {
      orchestratorStore.syncVMWorkspaceToHost();
      // Give the worker a short moment to emit vm-workspace-synced.
      await new Promise((resolve) => setTimeout(resolve, 180));
      await orchestratorStore.loadFiles(db);
      showSuccess("Requested VM → host workspace sync", 2200);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Failed to request VM → host sync: ${message}`, 5000);
    } finally {
      button.disabled = false;
      button.textContent = "VM → Host";
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
      item.setAttribute("data-file-name", name);

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

    await this.uploadFileList(db, files);

    // Clear the input
    input.value = "";
  }

  /**
   * @param {ShadowClawDatabase} db
   * @param {FileList|File[]} files
   */
  async uploadFileList(db, files) {
    const fileList = Array.from(files);
    if (fileList.length === 0) {
      return;
    }

    const groupId = orchestratorStore.activeGroupId;
    const currentPath = orchestratorStore.currentPath;
    const count = fileList.length;

    this.uploadTotal = count;
    this.uploadCompleted = 0;
    this.updateUploadProgressUI(true);

    try {
      for (let i = 0; i < count; i++) {
        const file = fileList[i];
        const filename =
          currentPath === "." ? file.name : `${currentPath}/${file.name}`;

        await uploadGroupFile(db, groupId, filename, file);
        this.uploadCompleted = i + 1;
        this.updateUploadProgressUI(true);
      }

      // Reload files
      await orchestratorStore.loadFiles(db);

      showSuccess(`Uploaded ${count} file${count === 1 ? "" : "s"}`, 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      showError(`Failed to upload files: ${message}`, 6000);

      console.error("Upload error:", err);
    } finally {
      this.updateUploadProgressUI(false);
      this.uploadTotal = 0;
      this.uploadCompleted = 0;
    }
  }

  /**
   * @param {boolean} active
   */
  updateUploadProgressUI(active) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const panel = root.querySelector(".files__upload-progress");
    const label = root.querySelector(".files__upload-progress-label");
    const bar = root.querySelector(".files__upload-progress-bar");

    if (!(panel instanceof HTMLElement)) {
      return;
    }

    panel.classList.toggle("active", active);

    const percent =
      this.uploadTotal > 0
        ? Math.round((this.uploadCompleted / this.uploadTotal) * 100)
        : 0;

    if (label instanceof HTMLElement) {
      label.textContent =
        this.uploadTotal > 0
          ? `Uploading ${this.uploadCompleted}/${this.uploadTotal} files (${percent}%)`
          : "Uploading files...";
    }

    if (bar instanceof HTMLElement) {
      bar.style.width = `${percent}%`;
    }
  }

  /**
   * @param {DragEvent} event
   * @param {HTMLElement} content
   */
  handleDragEnter(event, content) {
    if (!this.hasDragFiles(event)) {
      return;
    }

    event.preventDefault();
    this.isDragActive = true;
    content.classList.add("files__content--dragover");
  }

  /**
   * @param {DragEvent} event
   * @param {HTMLElement} content
   */
  handleDragOver(event, content) {
    if (!this.hasDragFiles(event)) {
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
    this.isDragActive = true;
    content.classList.add("files__content--dragover");
  }

  /**
   * @param {DragEvent} event
   * @param {HTMLElement} content
   */
  handleDragLeave(event, content) {
    if (!this.isDragActive) {
      return;
    }

    const related = event.relatedTarget;
    if (related instanceof Node && content.contains(related)) {
      return;
    }

    this.isDragActive = false;
    content.classList.remove("files__content--dragover");
  }

  /**
   * @param {DragEvent} event
   * @param {ShadowClawDatabase} db
   * @param {HTMLElement} content
   */
  async handleDrop(event, db, content) {
    if (!this.hasDragFiles(event)) {
      return;
    }

    event.preventDefault();
    this.isDragActive = false;
    content.classList.remove("files__content--dragover");

    const dropped = event.dataTransfer?.files;
    if (!dropped || dropped.length === 0) {
      return;
    }

    await this.uploadFileList(db, dropped);
  }

  /**
   * @param {DragEvent} event
   */
  hasDragFiles(event) {
    const types = event.dataTransfer?.types;
    return Boolean(types && Array.from(types).includes("Files"));
  }

  openNewFileDialog() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const dialog = root.querySelector(".files__new-dialog");
    const input = root.querySelector(".files__new-input");

    if (!(dialog instanceof HTMLDialogElement)) {
      return;
    }

    dialog.showModal();

    if (input instanceof HTMLInputElement) {
      input.value = "";
      input.focus();
    }
  }

  /**
   * @param {ShadowClawDatabase} db
   */
  async handleCreateNewFile(db) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const dialog = root.querySelector(".files__new-dialog");
    const input = root.querySelector(".files__new-input");
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const fileName = input.value.trim();
    if (!fileName) {
      showWarning("Please enter a file name", 3000);
      return;
    }

    if (fileName.includes("/") || fileName.includes("\\")) {
      showWarning("Use only a file name, not a path", 3500);
      return;
    }

    const filePath =
      orchestratorStore.currentPath === "."
        ? fileName
        : `${orchestratorStore.currentPath}/${fileName}`;

    try {
      await writeGroupFile(db, orchestratorStore.activeGroupId, filePath, "");
      await orchestratorStore.loadFiles(db);

      showSuccess(`Created file: ${fileName}`, 3000);

      if (dialog instanceof HTMLDialogElement) {
        dialog.close();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Failed to create file: ${message}`, 6000);
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
