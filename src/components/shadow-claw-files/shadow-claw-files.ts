import { deleteAllGroupFiles } from "../../storage/deleteAllGroupFiles.js";
import { deleteGroupDirectory } from "../../storage/deleteGroupDirectory.js";
import { deleteGroupFile } from "../../storage/deleteGroupFile.js";
import { createGroupDirectory } from "../../storage/createGroupDirectory.js";
import { downloadAllGroupFilesAsZip } from "../../storage/downloadAllGroupFilesAsZip.js";
import { downloadGroupDirectoryAsZip } from "../../storage/downloadGroupDirectoryAsZip.js";
import { downloadGroupFile } from "../../storage/downloadGroupFile.js";
import { renameGroupEntry } from "../../storage/renameGroupEntry.js";
import { restoreAllGroupFilesFromZip } from "../../storage/restoreAllGroupFilesFromZip.js";
import { uploadGroupFile } from "../../storage/uploadGroupFile.js";
import { writeGroupFile } from "../../storage/writeGroupFile.js";

import { effect } from "../../effect.js";
import { fileViewerStore } from "../../stores/file-viewer.js";
import { filesUiStore } from "../../stores/files-ui.js";
import { orchestratorStore } from "../../stores/orchestrator.js";
import { showError, showSuccess, showWarning } from "../../toast.js";

import { getDb } from "../../db/db.js";

import { escapeHtml } from "../../utils.js";
import "../common/shadow-claw-empty-state/shadow-claw-empty-state.js";
import "../common/shadow-claw-page-header-action-button/shadow-claw-page-header-action-button.js";
import "../shadow-claw-dialog/shadow-claw-dialog.js";
import "../shadow-claw-page-header/shadow-claw-page-header.js";

import type { ShadowClawDatabase } from "../../types.js";
import ShadowClawElement from "../shadow-claw-element.js";

const elementName = "shadow-claw-files";

export class ShadowClawFiles extends ShadowClawElement {
  static componentPath = `components/${elementName}`;
  static styles = `${ShadowClawFiles.componentPath}/${elementName}.css`;
  static template = `${ShadowClawFiles.componentPath}/${elementName}.html`;

  private _pendingRenamePath: string | null = null;
  private _pendingRenameName: string | null = null;
  private _pendingRenameIsDirectory: boolean = false;
  private _isCreatingNewItem: boolean = false;
  private _isRenamingEntry: boolean = false;

  constructor() {
    super();
  }

  async connectedCallback() {
    await Promise.all([this.onStylesReady, this.onTemplateReady]);

    const root = this.shadowRoot;
    if (!root) {
      throw new Error("shadowRoot not found");
    }

    const db = await getDb();

    this.dispatchTerminalSlotReady();

    const content = root.querySelector(".files__content");

    // Re-render when files or path change
    this.addCleanup(
      effect(() => {
        orchestratorStore.files;
        orchestratorStore.currentPath;

        this.updateBreadcrumbs(db);
        this.updateFileList(db);
      }),
    );

    // Keep upload progress UI in sync with signal state.
    this.addCleanup(
      effect(() => {
        const uploadTotal = filesUiStore.uploadTotal;
        const uploadCompleted = filesUiStore.uploadCompleted;
        this.updateUploadProgressUI(
          uploadTotal > 0,
          uploadCompleted,
          uploadTotal,
        );
      }),
    );

    // Toggle drag-over styling from signal state.
    this.addCleanup(
      effect(() => {
        const isDragActive = filesUiStore.isDragActive;
        if (content instanceof HTMLElement) {
          content.classList.toggle("files__content--dragover", isDragActive);
        }
      }),
    );

    const vmStatusListener = () => {
      this.updateSyncButtonsVisibility();
    };

    orchestratorStore.orchestrator?.events?.on?.("vm-status", vmStatusListener);
    this.addCleanup(() =>
      orchestratorStore.orchestrator?.events?.off?.(
        "vm-status",
        vmStatusListener,
      ),
    );

    this.updateSyncButtonsVisibility();

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

    newDialog?.addEventListener("cancel", (event) => {
      if (this._isCreatingNewItem) {
        event.preventDefault();
      }
    });

    newCancelBtn?.addEventListener("click", () => {
      if (this._isCreatingNewItem) {
        return;
      }

      if (newDialog instanceof HTMLDialogElement) {
        newDialog.close();
      }
    });

    newForm?.addEventListener("submit", async (event) => {
      event.preventDefault();

      await this.handleCreateNewFile(db);
    });

    // Rename dialog
    const renameDialog = root.querySelector(".files__rename-dialog");
    const renameCancelBtn = root.querySelector(".files__rename-cancel");
    const renameForm = root.querySelector(".files__rename-form");

    renameDialog?.addEventListener("cancel", (event) => {
      if (this._isRenamingEntry) {
        event.preventDefault();
      }
    });

    renameCancelBtn?.addEventListener("click", () => {
      if (this._isRenamingEntry) {
        return;
      }

      if (renameDialog instanceof HTMLDialogElement) {
        renameDialog.close();
      }

      this._resetPendingRename();
    });

    renameForm?.addEventListener("submit", async (event) => {
      event.preventDefault();

      await this.handleRenameEntry(db);
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
      if (e.target instanceof HTMLInputElement) {
        this.handleRestore(db, e.target);
      }
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
    super.disconnectedCallback();
  }

  dispatchTerminalSlotReady() {
    this.dispatchEvent(
      new CustomEvent("shadow-claw-terminal-slot-ready", {
        bubbles: true,
        composed: true,
      }),
    );
  }

  async requestConfirmation(options: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
  }): Promise<boolean> {
    const appShell = document.querySelector("shadow-claw") as any;
    if (appShell && typeof appShell.requestDialog === "function") {
      return await appShell.requestDialog({ mode: "confirm", ...options });
    }

    showWarning(options.message, 4500);

    return false;
  }

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

  updateBreadcrumbs(db: ShadowClawDatabase) {
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

      parts.forEach((part, index) => {
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
          try {
            await orchestratorStore.setCurrentPath(db, pathToNavigate);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            showError(`Failed to navigate to folder: ${message}`, 4500);
          }
        });

        breadcrumbs.appendChild(btn);
      });
    }
  }

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

  async handleSyncVMToHost(db: ShadowClawDatabase) {
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

  updateFileList(db: ShadowClawDatabase) {
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
          <shadow-claw-empty-state
            class="files__empty"
            message="No files in this folder."
            hint="Ask the agent to create some files!"
          ></shadow-claw-empty-state>
      `;

      return;
    }

    list.innerHTML = "";
    files.forEach((file) => {
      const isDir = file.endsWith("/");
      const name = isDir ? file.slice(0, -1) : file;

      const item = document.createElement("div");
      item.className = "files__item";
      item.setAttribute("role", "listitem");
      item.setAttribute("data-file-name", name);

      const downloadTitle = isDir ? "Download as ZIP" : "Download";
      const actionsHtml = `
        <div class="files__actions" aria-label="Actions for ${escapeHtml(name)}">
          <button type="button" class="files__action-btn files__download" title="${downloadTitle}" aria-label="${downloadTitle} ${escapeHtml(name)}">📥</button>
          <button type="button" class="files__action-btn files__rename" title="Rename" aria-label="Rename ${escapeHtml(name)}">✏️</button>
          <button type="button" class="files__action-btn files__action-btn--delete files__delete" title="Delete" aria-label="Delete ${escapeHtml(name)}">🗑️</button>
        </div>
      `;

      const actionsToggleBtn = document.createElement("button");
      actionsToggleBtn.className = "files__actions-toggle";
      actionsToggleBtn.setAttribute("title", "More actions");
      actionsToggleBtn.setAttribute("aria-label", `More actions for ${name}`);
      actionsToggleBtn.textContent = "⋮";

      item.innerHTML = `
        <button type="button" class="files__item-main" aria-label="${isDir ? "Open folder" : "Open file"} ${escapeHtml(name)}">
          <div class="files__icon" aria-hidden="true">${isDir ? "📁" : "📄"}</div>
          <div class="files__name">${escapeHtml(name)}</div>
        </button>
        ${actionsHtml}
      `;
      item.appendChild(actionsToggleBtn);

      // Click to open file or navigate into folder
      const itemMain = item.querySelector(".files__item-main");
      itemMain?.addEventListener("click", async () => {
        item.classList.remove("show-actions");
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

      // Toggle actions menu
      actionsToggleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        item.classList.toggle("show-actions");
      });

      // Download button (for both files and directories)
      const downloadBtn = item.querySelector(".files__download");
      if (downloadBtn) {
        downloadBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          item.classList.remove("show-actions");
          try {
            if (downloadBtn instanceof HTMLButtonElement) {
              downloadBtn.disabled = true;
            }

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

      const renameBtn = item.querySelector(".files__rename");
      if (renameBtn) {
        renameBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          item.classList.remove("show-actions");

          const itemPath =
            currentPath === "." ? name : `${currentPath}/${name}`;

          this.openRenameDialog(itemPath, name, isDir);
        });
      }

      // Delete button
      const deleteBtn = item.querySelector(".files__delete");
      if (deleteBtn) {
        deleteBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          item.classList.remove("show-actions");
          const action = isDir
            ? "delete this folder and all its contents"
            : "delete this file";

          const confirmed = await this.requestConfirmation({
            title: isDir ? "Delete Folder" : "Delete File",
            message: `Are you sure you want to ${action}?\n\n${name}`,
            confirmLabel: "Delete",
            cancelLabel: "Cancel",
          });

          if (!confirmed) {
            return;
          }

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
        });
      }

      list.appendChild(item);
    });
  }

  /**
   * Escape HTML special characters
   */
  escapeHtml(text: string): string {
    const div = document.createElement("div");

    div.textContent = text;

    return div.innerHTML;
  }

  async handleUpload(db: ShadowClawDatabase, input: HTMLInputElement) {
    const files = input.files;
    if (!files || files.length === 0) {
      return;
    }

    await this.uploadFileList(db, files);

    // Clear the input
    input.value = "";
  }

  async uploadFileList(db: ShadowClawDatabase, files: FileList | File[]) {
    const fileList: File[] = Array.from(files) as File[];
    if (fileList.length === 0) {
      return;
    }

    const groupId = orchestratorStore.activeGroupId;
    const currentPath = orchestratorStore.currentPath;
    const count = fileList.length;

    filesUiStore.startUpload(count);

    try {
      for (let i = 0; i < count; i++) {
        const file = fileList[i];
        const filename =
          currentPath === "." ? file.name : `${currentPath}/${file.name}`;

        await uploadGroupFile(db, groupId, filename, file);
        filesUiStore.setUploadCompleted(i + 1);
      }

      // Reload files
      await orchestratorStore.loadFiles(db);

      showSuccess(`Uploaded ${count} file${count === 1 ? "" : "s"}`, 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      showError(`Failed to upload files: ${message}`, 6000);

      console.error("Upload error:", err);
    } finally {
      filesUiStore.resetUpload();
    }
  }

  updateUploadProgressUI(
    active: boolean,
    uploadCompleted: number,
    uploadTotal: number,
  ) {
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
      uploadTotal > 0 ? Math.round((uploadCompleted / uploadTotal) * 100) : 0;

    if (label instanceof HTMLElement) {
      label.textContent =
        uploadTotal > 0
          ? `Uploading ${uploadCompleted}/${uploadTotal} files (${percent}%)`
          : "Uploading files...";
    }

    if (bar instanceof HTMLElement) {
      bar.style.width = `${percent}%`;
    }
  }

  handleDragEnter(event: DragEvent, _content: HTMLElement) {
    if (!this.hasDragFiles(event)) {
      return;
    }

    event.preventDefault();
    filesUiStore.setDragActive(true);
  }

  handleDragOver(event: DragEvent, _content: HTMLElement) {
    if (!this.hasDragFiles(event)) {
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }

    filesUiStore.setDragActive(true);
  }

  handleDragLeave(event: DragEvent, _content: HTMLElement) {
    if (!filesUiStore.isDragActive) {
      return;
    }

    const related = event.relatedTarget;
    if (related instanceof Node && _content.contains(related)) {
      return;
    }

    filesUiStore.setDragActive(false);
  }

  async handleDrop(
    event: DragEvent,
    db: ShadowClawDatabase,
    _content: HTMLElement,
  ) {
    if (!this.hasDragFiles(event)) {
      return;
    }

    event.preventDefault();
    filesUiStore.setDragActive(false);

    const dropped = event.dataTransfer?.files;
    if (!dropped || dropped.length === 0) {
      return;
    }

    await this.uploadFileList(db, dropped);
  }

  hasDragFiles(event: DragEvent): boolean {
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
    const isFolderInput = root.querySelector(".files__new-is-folder");

    if (!(dialog instanceof HTMLDialogElement)) {
      return;
    }

    this.setNewDialogBusy(false);

    dialog.showModal();

    if (input instanceof HTMLInputElement) {
      input.value = "";
      input.focus();
    }

    if (isFolderInput instanceof HTMLInputElement) {
      isFolderInput.checked = false;
    }
  }

  openRenameDialog(path: string, currentName: string, isDirectory: boolean) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const dialog = root.querySelector(".files__rename-dialog");
    const input = root.querySelector(".files__rename-input");

    if (!(dialog instanceof HTMLDialogElement)) {
      return;
    }

    this.setRenameDialogBusy(false);

    this._pendingRenamePath = path;
    this._pendingRenameName = currentName;
    this._pendingRenameIsDirectory = isDirectory;

    dialog.showModal();

    if (input instanceof HTMLInputElement) {
      input.value = currentName;
      input.select();
      input.focus();
    }
  }

  _resetPendingRename() {
    this._pendingRenamePath = null;
    this._pendingRenameName = null;
    this._pendingRenameIsDirectory = false;
  }

  async handleRenameEntry(db: ShadowClawDatabase) {
    const root = this.shadowRoot;
    if (!root || !this._pendingRenamePath || !this._pendingRenameName) {
      return;
    }

    if (this._isRenamingEntry) {
      return;
    }

    const dialog = root.querySelector(".files__rename-dialog");
    const input = root.querySelector(".files__rename-input");
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const nextName = input.value.trim();
    const currentName = this._pendingRenameName;

    if (!nextName) {
      showWarning("Please enter a name", 3000);

      return;
    }

    if (nextName.includes("/") || nextName.includes("\\")) {
      showWarning("Use only a name, not a path", 3500);

      return;
    }

    if (nextName === currentName) {
      if (dialog instanceof HTMLDialogElement) {
        dialog.close();
      }

      this._resetPendingRename();

      return;
    }

    try {
      this.setRenameDialogBusy(true);

      await renameGroupEntry(
        db,
        orchestratorStore.activeGroupId,
        this._pendingRenamePath,
        nextName,
      );

      await orchestratorStore.loadFiles(db);

      showSuccess(
        this._pendingRenameIsDirectory
          ? `Renamed folder: ${currentName} -> ${nextName}`
          : `Renamed file: ${currentName} -> ${nextName}`,
        3200,
      );

      if (dialog instanceof HTMLDialogElement) {
        dialog.close();
      }

      this._resetPendingRename();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Failed to rename ${currentName}: ${message}`, 6000);
    } finally {
      this.setRenameDialogBusy(false);
    }
  }

  async handleCreateNewFile(db: ShadowClawDatabase) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    if (this._isCreatingNewItem) {
      return;
    }

    const dialog = root.querySelector(".files__new-dialog");
    const input = root.querySelector(".files__new-input");
    const isFolderInput = root.querySelector(".files__new-is-folder");
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const isFolder =
      isFolderInput instanceof HTMLInputElement && isFolderInput.checked;
    const itemType = isFolder ? "folder" : "file";

    const fileName = input.value.trim();
    if (!fileName) {
      showWarning(`Please enter a ${itemType} name`, 3000);

      return;
    }

    if (fileName.includes("/") || fileName.includes("\\")) {
      showWarning(`Use only a ${itemType} name, not a path`, 3500);

      return;
    }

    const filePath =
      orchestratorStore.currentPath === "."
        ? fileName
        : `${orchestratorStore.currentPath}/${fileName}`;

    try {
      this.setNewDialogBusy(true);

      if (isFolder) {
        await createGroupDirectory(
          db,
          orchestratorStore.activeGroupId,
          filePath,
        );
      } else {
        await writeGroupFile(db, orchestratorStore.activeGroupId, filePath, "");
      }

      await orchestratorStore.loadFiles(db);

      showSuccess(`Created ${itemType}: ${fileName}`, 3000);

      if (dialog instanceof HTMLDialogElement) {
        dialog.close();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Failed to create ${itemType}: ${message}`, 6000);
    } finally {
      this.setNewDialogBusy(false);
    }
  }

  setNewDialogBusy(isBusy: boolean) {
    this._isCreatingNewItem = isBusy;

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const cancelBtn = root.querySelector(".files__new-cancel");
    const okBtn = root.querySelector(".files__new-ok");
    const input = root.querySelector(".files__new-input");
    const isFolderInput = root.querySelector(".files__new-is-folder");

    if (cancelBtn instanceof HTMLButtonElement) {
      cancelBtn.disabled = isBusy;
    }

    if (okBtn instanceof HTMLButtonElement) {
      okBtn.disabled = isBusy;
    }

    if (input instanceof HTMLInputElement) {
      input.disabled = isBusy;
    }

    if (isFolderInput instanceof HTMLInputElement) {
      isFolderInput.disabled = isBusy;
    }
  }

  setRenameDialogBusy(isBusy: boolean) {
    this._isRenamingEntry = isBusy;

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const cancelBtn = root.querySelector(".files__rename-cancel");
    const okBtn = root.querySelector(".files__rename-ok");
    const input = root.querySelector(".files__rename-input");

    if (cancelBtn instanceof HTMLButtonElement) {
      cancelBtn.disabled = isBusy;
    }

    if (okBtn instanceof HTMLButtonElement) {
      okBtn.disabled = isBusy;
    }

    if (input instanceof HTMLInputElement) {
      input.disabled = isBusy;
    }
  }

  /**
   * Handle backup (download all files as zip)
   */
  async handleBackup(db: ShadowClawDatabase) {
    const groupId = orchestratorStore.activeGroupId;
    try {
      const btn = this.shadowRoot?.querySelector(".files__backup-btn");
      btn?.toggleAttribute("disabled", true);

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

      btn?.toggleAttribute("disabled", false);

      if (btn) {
        btn.textContent = "💾 Backup";
      }
    }
  }

  /**
   * Handle restore (upload and extract zip)
   */
  async handleRestore(db: ShadowClawDatabase, input: HTMLInputElement) {
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

    const confirmed = await this.requestConfirmation({
      title: "Restore Files",
      message: "Restore from backup will replace all current files. Continue?",
      confirmLabel: "Restore",
      cancelLabel: "Cancel",
    });

    if (!confirmed) {
      input.value = "";

      return;
    }

    try {
      const btn = this.shadowRoot?.querySelector(".files__restore-btn");
      btn?.toggleAttribute("disabled", true);

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
      btn?.toggleAttribute("disabled", false);

      if (btn) {
        btn.textContent = "♻️ Restore";
      }
    }
  }

  /**
   * Handle clear all (delete all files)
   */
  async handleClearAll(db: ShadowClawDatabase) {
    const confirmed = await this.requestConfirmation({
      title: "Clear All Files",
      message: "Delete ALL files? This cannot be undone!",
      confirmLabel: "Delete All",
      cancelLabel: "Cancel",
    });

    if (!confirmed) {
      return;
    }

    const groupId = orchestratorStore.activeGroupId;

    try {
      const btn = this.shadowRoot?.querySelector(".files__clear-btn");
      btn?.toggleAttribute("disabled", true);

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
      btn?.toggleAttribute("disabled", false);

      if (btn) {
        btn.textContent = "🗑️ Clear All";
      }
    }
  }
}

customElements.define(elementName, ShadowClawFiles);
