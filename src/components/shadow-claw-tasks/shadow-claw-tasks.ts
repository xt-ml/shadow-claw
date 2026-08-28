import { renderMarkdown } from "../../content/markdown.js";
import { CONFIG_KEYS } from "../../config/config.js";
import { effect } from "../../core/effect.js";

import { getDb, ShadowClawDatabase } from "../../db/db.js";
import { getConfig } from "../../db/getConfig.js";
import { Task } from "../../db/types.js";

import { setSanitizedHtml } from "../../security/trusted-types.js";
import { fileViewerStore } from "../../stores/file-viewer.js";
import { orchestratorStore } from "../../stores/orchestrator.js";

import { showError, showInfo, showSuccess } from "../../ui/toast.js";
import { isTruthyConfigValue } from "../../common/utils/config-value.mjs";
import { escapeHtml } from "../../utils/utils.js";

import "../common/shadow-claw-empty-state/shadow-claw-empty-state.js";
import "../common/shadow-claw-page-header-action-button/shadow-claw-page-header-action-button.js";
import "../shadow-claw-dialog/shadow-claw-dialog.js";
import "../shadow-claw-page-header/shadow-claw-page-header.js";

import ShadowClawElement from "../shadow-claw-element.js";
import shadowClawTasksStyles from "./shadow-claw-tasks.css" with { type: "css" };
import shadowClawTasksTemplate from "./shadow-claw-tasks.html" with { type: "html" };

const elementName = "shadow-claw-tasks";

async function resolveFrontmatterToggle(
  db: ShadowClawDatabase | null,
  key: string,
): Promise<boolean> {
  if (!db || typeof (db as any).transaction !== "function") {
    return true;
  }

  try {
    return isTruthyConfigValue(await getConfig(db, key), true);
  } catch {
    return true;
  }
}

export class ShadowClawTasks extends ShadowClawElement {
  static styles = shadowClawTasksStyles;
  static template = shadowClawTasksTemplate;

  editingTask: any | null = null;
  editingTools: any[] = [];
  renderFrontmatter = true;
  tasks: any[] = [];
  private _autoScrollActive = false;
  private _autoScrollSpeed = 0;

  private _draggedTaskId: string | null = null;
  private _keyboardGrabbedId: string | null = null;
  private _touchDraggedTaskId: string | null = null;
  private _touchId: number | null = null;

  constructor() {
    super();
  }

  async connectedCallback() {
    const root = this.shadowRoot;
    if (!root) {
      throw new Error("shadowRoot not found");
    }

    root.addEventListener("click", (event: Event) => {
      if (event instanceof MouseEvent) {
        getDb()
          .then((db) => this.handlePreviewLinkClick(event, db))
          .catch(console.error);
      }
    });

    // Backup button
    const backupBtn = root.querySelector(".tasks__backup-btn");
    backupBtn?.addEventListener("click", () => this.handleBackup());

    // Restore button
    const restoreBtn = root.querySelector(".tasks__restore-btn");
    const restoreInput = root.querySelector(".tasks__hidden-restore");
    restoreBtn?.addEventListener("click", () => {
      if (restoreInput instanceof HTMLInputElement) {
        restoreInput.click();
      }
    });

    restoreInput?.addEventListener("change", (e) => {
      if (e.target instanceof HTMLInputElement) {
        const target = e.target;
        getDb()
          .then((db) => this.handleRestore(db, target))
          .catch(console.error);
      }
    });

    // Clear all button
    const clearBtn = root.querySelector(".tasks__clear-btn");
    clearBtn?.addEventListener("click", () => {
      getDb()
        .then((db) => this.handleClearAll(db))
        .catch(console.error);
    });

    // Add task button
    const addBtn = root.querySelector(".tasks__add-btn");
    addBtn?.addEventListener("click", () => this.handleAdd());

    // Dialog controls
    const dialog = root.querySelector("dialog");
    const closeBtn = root.querySelector(".tasks__dialog-close");
    const cancelBtn = root.querySelector(".tasks__btn-cancel");
    const form = root.querySelector(
      ".tasks__dialog-form",
    ) as HTMLFormElement | null;

    closeBtn?.addEventListener("click", () => {
      dialog?.close();
    });

    cancelBtn?.addEventListener("click", () => {
      dialog?.close();
    });

    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      if (form) {
        getDb()
          .then((db) => this.handleEditSubmit(db, form))
          .catch(console.error);
      }
    });

    // Close dialog when clicking outside (on backdrop)
    dialog?.addEventListener("click", (e) => {
      if (e.target === dialog) {
        dialog.close();
      }
    });

    // Preview update logic
    const promptTextarea = root.querySelector("textarea[name='prompt']");
    const previewDiv = root.querySelector(".tasks__preview");
    const typeRadios = root.querySelectorAll("input[name='taskType']");
    const promptGroup = root.querySelector(".tasks__prompt-group");
    const toolsGroup = root.querySelector(".tasks__tools-group");
    const addToolBtn = root.querySelector(".tasks__add-tool-btn");

    const updatePreview = async () => {
      if (previewDiv instanceof HTMLElement) {
        const type =
          Array.from(typeRadios)
            .find((r: any) => r.checked)
            ?.getAttribute("value") || "prompt";
        if (type === "tools") {
          setSanitizedHtml(
            previewDiv,
            this.renderToolsPreview(this.editingTools),
          );
        } else if (promptTextarea instanceof HTMLTextAreaElement) {
          setSanitizedHtml(
            previewDiv,
            await this.renderPreview(promptTextarea.value),
          );
        }
      }
    };

    promptTextarea?.addEventListener("input", updatePreview);

    typeRadios.forEach((radio) => {
      radio.addEventListener("change", (e) => {
        const val = (e.target as HTMLInputElement).value;
        if (val === "tools") {
          promptGroup?.setAttribute("style", "display: none;");
          toolsGroup?.removeAttribute("style");
          promptTextarea?.removeAttribute("required");
        } else {
          toolsGroup?.setAttribute("style", "display: none;");
          promptGroup?.removeAttribute("style");
        }

        updatePreview();
      });
    });

    addToolBtn?.addEventListener("click", () => {
      this.editingTools.push({ name: "", input: {} });
      this.renderToolsEditor();
      updatePreview();
    });

    const db = await getDb();
    this.renderFrontmatter = await resolveFrontmatterToggle(
      db,
      CONFIG_KEYS.MARKDOWN_FRONTMATTER_TASKS,
    );

    // apply highlight.js atom-one-dark.min.css to shadow dom
    try {
      const cssText = await (
        await fetch(
          "https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/atom-one-dark.min.css",
        )
      ).text();

      const sheet = new CSSStyleSheet();
      sheet.replaceSync(cssText);

      if (this.shadowRoot?.adoptedStyleSheets) {
        this.shadowRoot.adoptedStyleSheets.push(sheet);
      }
    } catch (err) {
      console.warn("Failed to load highlight.js styles:", err);
    }

    // Global dragover auto-scroll listener on shadowRoot
    root.addEventListener("dragover", (e: any) => {
      if (this._draggedTaskId !== null) {
        this._updateAutoScrollSpeed(e.clientY);
      }
    });

    // Ensure we stop scrolling if the drag ends or leaves
    root.addEventListener("dragend", () => {
      this._stopAutoScroll();
    });
    root.addEventListener("drop", () => {
      this._stopAutoScroll();
    });

    this.render();
    this.dispatchTerminalSlotReady();

    // Re-render when tasks change
    this.cleanup = effect(() => {
      orchestratorStore.tasks;
      this.updateTaskList(db);
    });
  }

  disconnectedCallback() {
    this.cleanup();
  }

  cleanup: () => void = () => {};

  dispatchTerminalSlotReady() {
    this.dispatchEvent(
      new CustomEvent("shadow-claw-terminal-slot-ready", {
        bubbles: true,
        composed: true,
      }),
    );
  }

  /**
   * Escape HTML special characters
   */
  escapeHtml(text: string) {
    const div = document.createElement("div");
    div.textContent = text;

    return div.innerHTML;
  }

  /**
   * Open dialog to add a new task
   */
  handleAdd() {
    this.editingTask = null;
    this.editingTools = [];
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const dialog = root.querySelector("dialog");
    const form = root.querySelector(".tasks__dialog-form");
    const title = root.querySelector(".tasks__dialog-title");
    const submitBtn = root.querySelector(".tasks__dialog-submit");

    if (!form || !(form instanceof HTMLFormElement)) {
      return;
    }

    // Update dialog for add mode
    if (title) {
      title.textContent = "Add Task";
    }

    if (submitBtn) {
      submitBtn.textContent = "Add Task";
    }

    // Clear form
    form.reset();

    const nameInput = form.querySelector("input[name='name']");
    if (nameInput instanceof HTMLInputElement) {
      nameInput.value = "";
    }

    // Reset type toggle
    const promptRadio = form.querySelector(
      "input[name='taskType'][value='prompt']",
    ) as HTMLInputElement;
    if (promptRadio) {
      promptRadio.checked = true;
      promptRadio.dispatchEvent(new Event("change"));
    }

    this.renderToolsEditor();

    // Reset preview
    const previewDiv = root.querySelector(".tasks__preview");
    if (previewDiv instanceof HTMLElement) {
      this.renderPreview("", false).then((html) => {
        setSanitizedHtml(previewDiv, html);
      });
    }

    // Show dialog
    dialog?.showModal();
  }

  /**
   * Open edit dialog for a task
   */
  handleEdit(task: Task) {
    this.editingTask = task;
    this.editingTools = JSON.parse(JSON.stringify(task.tools || []));
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const dialog = root.querySelector("dialog");
    const form = root.querySelector(".tasks__dialog-form");
    const title = root.querySelector(".tasks__dialog-title");
    const submitBtn = root.querySelector(".tasks__dialog-submit");

    if (!form || !(form instanceof HTMLFormElement)) {
      return;
    }

    // Update dialog for edit mode
    if (title) {
      title.textContent = "Edit Task";
    }

    if (submitBtn) {
      submitBtn.textContent = "Save Changes";
    }

    // Set form values
    const nameInput = form.querySelector("input[name='name']");
    if (nameInput instanceof HTMLInputElement) {
      nameInput.value = task.name || "";
    }

    const scheduleInput = form.querySelector("input[name='schedule']");
    const promptInput = form.querySelector("textarea[name='prompt']");
    if (scheduleInput instanceof HTMLInputElement) {
      scheduleInput.value = task.schedule || "";
    }

    if (promptInput instanceof HTMLTextAreaElement) {
      promptInput.value = task.prompt || "";
    }

    const freshContextInput = form.querySelector("input[name='freshContext']");
    if (freshContextInput instanceof HTMLInputElement) {
      freshContextInput.checked = !!task.freshContext;
    }

    const subagentInput = form.querySelector("input[name='subagent']");
    if (subagentInput instanceof HTMLInputElement) {
      subagentInput.checked = !!task.subagent;
    }

    const typeRadio = form.querySelector(
      `input[name='taskType'][value='${task.type || "prompt"}']`,
    ) as HTMLInputElement;
    if (typeRadio) {
      typeRadio.checked = true;
      typeRadio.dispatchEvent(new Event("change"));
    }

    this.renderToolsEditor();

    // Set initial preview
    const previewDiv = root.querySelector(".tasks__preview");
    if (previewDiv instanceof HTMLElement) {
      if (task.type === "tools") {
        setSanitizedHtml(
          previewDiv,
          this.renderToolsPreview(this.editingTools),
        );
      } else {
        this.renderPreview(task.prompt).then((html) => {
          setSanitizedHtml(previewDiv, html);
        });
      }
    }

    // Show dialog
    dialog?.showModal();
  }

  /**
   * Run a task
   */
  handleRun(task: Task) {
    orchestratorStore.runTask(task, true);
  }

  renderToolsEditor() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const list = root.querySelector(".tasks__tools-list");
    if (!list) {
      return;
    }

    list.innerHTML = "";

    this.editingTools.forEach((tool, index) => {
      const item = document.createElement("div");
      item.className = "tasks__tool-item";

      const header = document.createElement("div");
      header.className = "tasks__tool-header";

      const title = document.createElement("div");
      title.className = "tasks__tool-title";
      title.textContent = `Tool ${index + 1}`;

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "tasks__tool-remove-btn";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", () => {
        this.editingTools.splice(index, 1);
        this.renderToolsEditor();
        const previewDiv = root.querySelector(".tasks__preview");
        if (previewDiv) {
          setSanitizedHtml(
            previewDiv,
            this.renderToolsPreview(this.editingTools),
          );
        }
      });

      header.appendChild(title);
      header.appendChild(removeBtn);

      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.className = "tasks__form-input";
      nameInput.placeholder = "Tool Name (e.g. show_toast)";
      nameInput.value = tool.name || "";
      nameInput.addEventListener("input", (e) => {
        tool.name = (e.target as HTMLInputElement).value;
        const previewDiv = root.querySelector(".tasks__preview");
        if (previewDiv) {
          setSanitizedHtml(
            previewDiv,
            this.renderToolsPreview(this.editingTools),
          );
        }
      });

      const paramsInput = document.createElement("textarea");
      paramsInput.className = "tasks__form-textarea";
      paramsInput.placeholder = '{\n  "key": "value"\n}';
      try {
        paramsInput.value =
          tool.input && Object.keys(tool.input).length
            ? JSON.stringify(tool.input, null, 2)
            : "";
      } catch (e) {
        paramsInput.value = "";
      }

      paramsInput.addEventListener("change", (e) => {
        const val = (e.target as HTMLTextAreaElement).value;
        if (!val.trim()) {
          tool.input = {};
        } else {
          try {
            tool.input = JSON.parse(val);
            (e.target as HTMLTextAreaElement).style.borderColor = "";
          } catch (err) {
            (e.target as HTMLTextAreaElement).style.borderColor =
              "var(--shadow-claw-error-color)";
          }
        }

        const previewDiv = root.querySelector(".tasks__preview");
        if (previewDiv) {
          setSanitizedHtml(
            previewDiv,
            this.renderToolsPreview(this.editingTools),
          );
        }
      });

      const suppressLabel = document.createElement("label");
      suppressLabel.className = "tasks__tool-suppress";

      const suppressInput = document.createElement("input");
      suppressInput.type = "checkbox";
      suppressInput.checked = !!tool.suppressOutput;
      suppressInput.addEventListener("change", (e) => {
        tool.suppressOutput = (e.target as HTMLInputElement).checked;
        const previewDiv = root.querySelector(".tasks__preview");
        if (previewDiv) {
          setSanitizedHtml(
            previewDiv,
            this.renderToolsPreview(this.editingTools),
          );
        }
      });

      suppressLabel.appendChild(suppressInput);
      suppressLabel.appendChild(document.createTextNode(" Suppress Output"));

      const suppressToastLabel = document.createElement("label");
      suppressToastLabel.className = "tasks__tool-suppress";

      const suppressToastInput = document.createElement("input");
      suppressToastInput.type = "checkbox";
      suppressToastInput.checked = !!tool.suppressToast;
      suppressToastInput.addEventListener("change", (e) => {
        tool.suppressToast = (e.target as HTMLInputElement).checked;
        const previewDiv = root.querySelector(".tasks__preview");
        if (previewDiv) {
          setSanitizedHtml(
            previewDiv,
            this.renderToolsPreview(this.editingTools),
          );
        }
      });

      suppressToastLabel.appendChild(suppressToastInput);
      suppressToastLabel.appendChild(
        document.createTextNode(" Suppress Toast"),
      );

      item.appendChild(header);
      item.appendChild(nameInput);
      item.appendChild(paramsInput);
      item.appendChild(suppressLabel);
      item.appendChild(suppressToastLabel);
      list.appendChild(item);
    });
  }

  renderToolsPreview(tools: any[], allowCollapse = false) {
    if (!tools || tools.length === 0) {
      return '<span class="tasks__preview-empty">No tools configured</span>';
    }

    const html = tools
      .map((t, i) => {
        let params = "{}";
        try {
          params = JSON.stringify(t.input, null, 2);
        } catch (e) {
          params = "Invalid JSON";
        }

        return `<div><strong>${i + 1}. ${escapeHtml(t.name || "Unnamed Tool")}</strong><pre><code>${escapeHtml(params)}</code></pre></div>`;
      })
      .join("");

    if (allowCollapse && tools.length > 2) {
      return `
        <details class="tasks__content-details">
          <summary class="tasks__content-summary">
            <span class="tasks__summary-text">${tools.length} Tools configured</span>
            <span class="tasks__summary-label">(View more)</span>
          </summary>
          <div class="tasks__prompt">${html}</div>
        </details>
      `;
    }

    return `<div class="tasks__prompt">${html}</div>`;
  }

  resolveWorkspaceLinkPath(href: string): string | null {
    const trimmed = href.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return null;
    }

    let candidate = trimmed;
    const hasScheme = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed);

    if (hasScheme || trimmed.startsWith("//")) {
      let parsed: URL;
      try {
        parsed = new URL(trimmed, window.location.href);
      } catch {
        return null;
      }

      const isHttp =
        parsed.protocol === "http:" || parsed.protocol === "https:";
      if (!isHttp || parsed.host !== window.location.host) {
        return null;
      }

      candidate = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }

    let normalized = candidate.split(/[?#]/, 1)[0].replace(/\\/g, "/");
    normalized = normalized.replace(/^\/+/, "");
    normalized = normalized.replace(/^\.\//, "");

    if (!normalized) {
      return null;
    }

    const parts = normalized.split("/").filter(Boolean);
    if (parts.some((part) => part === "..")) {
      return null;
    }

    return parts.join("/");
  }

  /**
   * Handle backup (download all tasks as JSON)
   */
  async handleBackup() {
    try {
      const btn = this.shadowRoot?.querySelector(".tasks__backup-btn");
      btn?.toggleAttribute("disabled", true);

      if (btn) {
        btn.textContent = "⏳";
      }

      const tasks = orchestratorStore.getTasksForBackup();
      const json = JSON.stringify(tasks, null, 2);
      const blob = new Blob([json], { type: "application/json" });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `shadowclaw-tasks-backup-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Failed to create backup: ${message}`);
      console.error("Backup error:", err);
    } finally {
      const btn = this.shadowRoot?.querySelector(".tasks__backup-btn");
      btn?.toggleAttribute("disabled", false);

      if (btn) {
        btn.textContent = "💾 Backup";
      }
    }
  }

  /**
   * Handle clear all (delete all tasks)
   */
  async handleClearAll(db: ShadowClawDatabase) {
    const confirmed = await this.requestConfirmation({
      title: "Clear All Tasks",
      message: "Delete ALL tasks? This cannot be undone!",
      confirmLabel: "Delete All",
      cancelLabel: "Cancel",
    });

    if (!confirmed) {
      return;
    }

    try {
      const btn = this.shadowRoot?.querySelector(".tasks__clear-btn");
      btn?.toggleAttribute("disabled", true);

      if (btn) {
        btn.textContent = "⏳";
      }

      await orchestratorStore.clearAllTasks(db);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Failed to clear tasks: ${message}`);
      console.error("Clear error:", err);
    } finally {
      const btn = this.shadowRoot?.querySelector(".tasks__clear-btn");
      btn?.toggleAttribute("disabled", false);

      if (btn) {
        btn.textContent = "🗑️ Clear All";
      }
    }
  }

  /**
   * Copy a task's ID to the clipboard
   */
  async handleCopyId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      showSuccess("Task ID copied to clipboard!");
    } catch (err) {
      showError("Failed to copy task ID.");
    }
  }

  /**
   * Delete a task
   */
  async handleDelete(db: ShadowClawDatabase, id: string) {
    const confirmed = await this.requestConfirmation({
      title: "Delete Scheduled Task",
      message: "Are you sure you want to delete this scheduled task?",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
    });

    if (!confirmed) {
      return;
    }

    try {
      await orchestratorStore.deleteTask(db, id);
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  }

  async handleEditSubmit(db: ShadowClawDatabase, form: HTMLFormElement) {
    const formData = new FormData(form);
    const name = formData.get("name");
    const schedule = formData.get("schedule");
    const prompt = formData.get("prompt");
    const type = (formData.get("taskType") as "prompt" | "tools") || "prompt";

    const nameStr = name ? String(name).trim() : "";
    const scheduleStr = schedule ? String(schedule).trim() : "";

    if (type === "prompt" && !prompt) {
      showInfo("Please provide a task prompt.");

      return;
    }

    const freshContext = !!formData.get("freshContext");
    const subagent = !!formData.get("subagent");

    try {
      let taskToSave;

      if (this.editingTask) {
        // Update existing task
        taskToSave = {
          ...this.editingTask,
          name: nameStr || undefined,
          schedule: scheduleStr,
          type,
          prompt: String(prompt || ""),
          tools: JSON.parse(JSON.stringify(this.editingTools)),
          freshContext,
          subagent,
        };
      } else {
        // Create new task
        const currentGroupId = orchestratorStore.activeGroupId;
        taskToSave = {
          id: crypto.randomUUID
            ? crypto.randomUUID()
            : `task-${Date.now()}-${Math.random()}`,
          groupId: currentGroupId,
          name: nameStr || undefined,
          schedule: scheduleStr,
          type,
          prompt: String(prompt || ""),
          tools: JSON.parse(JSON.stringify(this.editingTools)),
          enabled: true,
          lastRun: null,
          createdAt: Date.now(),
          freshContext,
          subagent,
        };
      }

      await orchestratorStore.upsertTask(db, taskToSave);

      const root = this.shadowRoot;
      const dialog = root?.querySelector("dialog");
      dialog?.close();

      this.editingTask = null;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Failed to save task: ${message}`);
      console.error("Save error:", err);
    }
  }

  async handlePreviewLinkClick(event: MouseEvent, db: ShadowClawDatabase) {
    if (event.defaultPrevented || event.button !== 0) {
      return;
    }

    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const link = target.closest("a");
    if (!(link instanceof HTMLAnchorElement)) {
      return;
    }

    const href = link.getAttribute("href") || "";
    const resolved = this.resolveWorkspaceLinkPath(href);
    if (!resolved) {
      return;
    }

    event.preventDefault();

    const attempts = [resolved];
    const lastSegment = resolved.split("/").filter(Boolean).pop() || "";
    const hasExtension = /\.[^./]+$/u.test(lastSegment);

    if (!hasExtension) {
      attempts.push(`${resolved}.md`, `${resolved}/index.md`);
    }

    for (const candidate of attempts) {
      try {
        await fileViewerStore.openFile(
          db,
          candidate,
          orchestratorStore.activeGroupId,
        );

        return;
      } catch {
        // Try next candidate path.
      }
    }

    showError(`Failed to open linked file: ${resolved}`, 5000);
  }

  async handleReorder(
    draggedId: string,
    targetId: string,
    precomputedIds?: string[],
  ) {
    const db = await getDb();
    if (!db) {
      return;
    }

    if (precomputedIds) {
      await orchestratorStore.reorderTasks(
        db,
        orchestratorStore.activeGroupId,
        precomputedIds,
      );
      return;
    }

    const tasks = orchestratorStore.tasks || [];
    const ids = tasks.map((t) => t.id);
    const fromIdx = ids.indexOf(draggedId);
    const toIdx = ids.indexOf(targetId);

    if (fromIdx < 0 || toIdx < 0) {
      return;
    }

    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, draggedId);

    await orchestratorStore.reorderTasks(
      db,
      orchestratorStore.activeGroupId,
      ids,
    );
  }

  /**
   * Handle restore (upload and import JSON)
   */
  async handleRestore(db: ShadowClawDatabase, input: HTMLInputElement) {
    const files = input.files;
    if (!files || files.length === 0) {
      return;
    }

    const jsonFile = files[0];
    if (!jsonFile.name.endsWith(".json")) {
      showInfo("Please select a .json file");

      return;
    }

    const confirmed = await this.requestConfirmation({
      title: "Restore Tasks",
      message: "Restore from backup will replace all current tasks. Continue?",
      confirmLabel: "Restore",
      cancelLabel: "Cancel",
    });

    if (!confirmed) {
      input.value = "";

      return;
    }

    try {
      const btn = this.shadowRoot?.querySelector(".tasks__restore-btn");
      btn?.toggleAttribute("disabled", true);

      if (btn) {
        btn.textContent = "⏳";
      }

      const text = await jsonFile.text();
      const tasks = JSON.parse(text);

      if (!Array.isArray(tasks)) {
        throw new Error("Invalid backup file format");
      }

      await orchestratorStore.restoreTasksFromBackup(db, tasks);
      input.value = "";
      showSuccess("Tasks restored successfully!");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Failed to restore from backup: ${message}`);
      console.error("Restore error:", err);
    } finally {
      const btn = this.shadowRoot?.querySelector(".tasks__restore-btn");
      btn?.toggleAttribute("disabled", false);

      if (btn) {
        btn.textContent = "♻️ Restore";
      }
    }
  }

  async renderPreview(prompt: string, allowCollapse = false) {
    if (!prompt.trim()) {
      return '<span class="tasks__preview-empty">No content</span>';
    }

    const lines = prompt.split("\n");
    const isLong = prompt.length > 120 || lines.length > 1;

    const rendered = await renderMarkdown(prompt, {
      breaks: true,
      renderFrontmatter: this.renderFrontmatter,
    });

    if (allowCollapse && isLong) {
      const summaryText = prompt.trim();

      return `
        <details class="tasks__content-details">
          <summary class="tasks__content-summary">
            <span class="tasks__summary-text">${escapeHtml(summaryText)}</span>
            <span class="tasks__summary-label">(View more)</span>
          </summary>
          <div class="tasks__prompt">${rendered}</div>
        </details>
      `;
    }

    return `<div class="tasks__prompt">${rendered}</div>`;
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

    showInfo(options.message, 4000);

    return false;
  }

  async updateTaskList(db: ShadowClawDatabase) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const list = root.querySelector(".tasks__list");
    if (!list) {
      return;
    }

    const tasks = orchestratorStore.tasks;

    if (tasks.length === 0) {
      setSanitizedHtml(
        list,
        `<shadow-claw-empty-state
          class="tasks__empty"
          message="No scheduled tasks for this group."
          hint="Ask the agent to create one using 'create_task'."
        ></shadow-claw-empty-state>`,
      );

      return;
    }

    // Capture render content first to avoid partially cleared list while awaiting
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const item = document.createElement("div");
      item.className = "tasks__item";
      item.setAttribute("role", "listitem");
      item.setAttribute("tabindex", "0");
      item.setAttribute("aria-describedby", "reorder-instructions");
      item.setAttribute(
        "aria-label",
        `${task.name || "Task"}, position ${i + 1} of ${tasks.length}`,
      );
      item.setAttribute("data-task-id", task.id);

      if (this._keyboardGrabbedId === task.id) {
        item.classList.add("keyboard-grabbed");
        item.setAttribute("aria-grabbed", "true");
      }

      const lastRunStr = task.lastRun
        ? new Date(task.lastRun).toLocaleString()
        : "Never";

      const isTools = task.type === "tools";
      const previewHtml = isTools
        ? this.renderToolsPreview(task.tools || [], true)
        : await this.renderPreview(task.prompt, true);

      const scheduleDisplay = task.schedule
        ? `⏰ ${escapeHtml(task.schedule)}`
        : "⏸ Unscheduled";
      const toggleHtml = task.schedule
        ? `
            <label class="tasks__toggle">
              <input type="checkbox" ${task.enabled ? "checked" : ""} data-id="${escapeHtml(task.id)}" class="tasks__toggle-input" aria-label="${task.enabled ? "Disable" : "Enable"} task scheduled ${escapeHtml(task.schedule)}">
              ${task.enabled ? "Enabled" : "Disabled"}
            </label>`
        : "";

      const badges = [isTools ? "Tools" : "Prompt"];
      if (task.freshContext) {
        badges.push("Fresh Context");
      }
      if (task.subagent) {
        badges.push("Subagent");
      }
      const badgesDisplay = badges.join(" · ");

      const nameHtml = task.name
        ? `<div class="tasks__name" style="font-weight: 600; font-size: var(--shadow-claw-font-size-md); margin-bottom: 0.25rem;">${escapeHtml(task.name)}</div>`
        : "";

      const dragHandleHtml = `<span class="tasks__drag-handle" draggable="true" aria-hidden="true" title="Drag to reorder">⠿</span>`;

      setSanitizedHtml(
        item,
        `<div class="tasks__item-header">
          <div style="display: flex; align-items: flex-start; flex: 1; min-width: 0;">
            ${dragHandleHtml}
            <div class="tasks__item-info">
              ${nameHtml}
              <div class="tasks__schedule-row">
                <div class="tasks__schedule">${scheduleDisplay} <span class="tasks__type-badge">(${escapeHtml(badgesDisplay)})</span></div>
              </div>
              <div class="tasks__prompt-container">
                ${previewHtml}
              </div>
              <div class="tasks__last-run">Last run: ${escapeHtml(lastRunStr)}</div>
            </div>
          </div>
          <div class="tasks__actions">
            ${toggleHtml}
            <button type="button" class="tasks__copy-id-btn" data-id="${escapeHtml(task.id)}" aria-label="Copy task ID" title="Copy task ID">
              <svg xmlns="http://www.w3.org/2000/svg" height="1em" width="1em" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true" style="vertical-align: middle; margin-right: 0.125rem; margin-top: -0.125rem;"><path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"/></svg> Copy ID
            </button>
            <button type="button" class="tasks__run-btn" data-id="${escapeHtml(task.id)}" aria-label="Run task">Run</button>
            <button type="button" class="tasks__edit-btn" data-id="${escapeHtml(task.id)}" aria-label="Edit task">✎ Edit</button>
            <button type="button" class="tasks__delete-btn" data-id="${escapeHtml(task.id)}" aria-label="Delete task">Delete</button>
          </div>
        </div>`,
      );

      // Bind events
      const toggle = item.querySelector(
        ".tasks__toggle-input",
      ) as HTMLInputElement | null;

      toggle?.addEventListener("change", (e) => {
        const target = e.target as HTMLInputElement;
        orchestratorStore.toggleTask(db, task, target.checked);
      });

      const copyIdBtn = item.querySelector(".tasks__copy-id-btn");
      copyIdBtn?.addEventListener("click", () => this.handleCopyId(task.id));

      const runBtn = item.querySelector(".tasks__run-btn");
      runBtn?.addEventListener("click", () => this.handleRun(task));

      const editBtn = item.querySelector(".tasks__edit-btn");
      editBtn?.addEventListener("click", () => this.handleEdit(task));

      const deleteBtn = item.querySelector(".tasks__delete-btn");
      deleteBtn?.addEventListener("click", () =>
        this.handleDelete(db, task.id),
      );

      const handleEl = item.querySelector(
        ".tasks__drag-handle",
      ) as HTMLElement | null;

      handleEl?.addEventListener("dragstart", (e) => {
        this._draggedTaskId = task.id;
        item.classList.add("dragging");
        e.dataTransfer?.setData("text/plain", task.id);
      });

      handleEl?.addEventListener("dragend", () => {
        item.classList.remove("dragging");
        this._draggedTaskId = null;
        list
          .querySelectorAll(".drag-over")
          .forEach((el) => el.classList.remove("drag-over"));
      });

      handleEl?.addEventListener(
        "touchstart",
        (e) => {
          const touch = e.touches[0];
          if (!touch) {
            return;
          }
          this._touchId = touch.identifier;
          this._touchDraggedTaskId = task.id;
          item.classList.add("dragging");
          e.preventDefault();
        },
        { passive: false },
      );

      item.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (this._draggedTaskId && this._draggedTaskId !== task.id) {
          item.classList.add("drag-over");
        }
      });

      item.addEventListener("dragleave", () => {
        item.classList.remove("drag-over");
      });

      item.addEventListener("drop", (e) => {
        e.preventDefault();
        item.classList.remove("drag-over");
        if (this._draggedTaskId && this._draggedTaskId !== task.id) {
          this.handleReorder(this._draggedTaskId, task.id);
        }
      });

      item.addEventListener("keydown", (e) => {
        this._handleKeyboard(e, task.id, task.name || "Task");
      });

      fragment.appendChild(item);
    }

    list.replaceChildren();
    list.appendChild(fragment);

    this._bindTouchListEvents(list);
  }

  _announce(message: string) {
    const region = this.shadowRoot?.querySelector("#live-region");
    if (region) {
      region.textContent = "";
      requestAnimationFrame(() => {
        region.textContent = message;
      });
    }
  }

  _bindTouchListEvents(list: Element) {
    if ((list as any)._touchBound) {
      return;
    }
    (list as any)._touchBound = true;

    list.addEventListener(
      "touchmove",
      (e) => {
        if (this._touchDraggedTaskId === null) {
          return;
        }

        const touch = this._findTouch(e as TouchEvent);
        if (!touch) {
          return;
        }

        e.preventDefault();

        const target = this._itemAtPoint(touch.clientX, touch.clientY);
        list
          .querySelectorAll(".drag-over")
          .forEach((el) => el.classList.remove("drag-over"));

        if (
          target &&
          target.getAttribute("data-task-id") !== this._touchDraggedTaskId
        ) {
          target.classList.add("drag-over");
        }

        this._updateAutoScrollSpeed(touch.clientY);
      },
      { passive: false },
    );

    list.addEventListener("touchend", (e) => {
      if (this._touchDraggedTaskId === null) {
        return;
      }

      const touch = this._findChangedTouch(e as TouchEvent);
      if (!touch) {
        return;
      }

      const target = this._itemAtPoint(touch.clientX, touch.clientY);
      const targetId = target?.getAttribute("data-task-id");

      list
        .querySelectorAll(".dragging")
        .forEach((el) => el.classList.remove("dragging"));

      list
        .querySelectorAll(".drag-over")
        .forEach((el) => el.classList.remove("drag-over"));

      if (targetId && targetId !== this._touchDraggedTaskId) {
        this.handleReorder(this._touchDraggedTaskId, targetId);
      }

      this._stopAutoScroll();
      this._touchDraggedTaskId = null;
      this._touchId = null;
    });

    list.addEventListener("touchcancel", () => {
      list
        .querySelectorAll(".dragging")
        .forEach((el) => el.classList.remove("dragging"));

      list
        .querySelectorAll(".drag-over")
        .forEach((el) => el.classList.remove("drag-over"));
      this._stopAutoScroll();
      this._touchDraggedTaskId = null;
      this._touchId = null;
    });
  }

  _findChangedTouch(e: TouchEvent): Touch | undefined {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === this._touchId) {
        return t;
      }
    }
  }

  _findTouch(e: TouchEvent): Touch | undefined {
    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i];
      if (t.identifier === this._touchId) {
        return t;
      }
    }
  }

  _focusNext(current: HTMLElement) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const focusables = Array.from(
      root.querySelectorAll(
        '.tasks__item[tabindex="0"], button:not([disabled]), input:not([type="hidden"]):not([disabled])',
      ),
    ) as HTMLElement[];
    const idx = focusables.indexOf(current);
    if (idx !== -1 && idx < focusables.length - 1) {
      focusables[idx + 1].focus();
    }
  }

  _focusNextItem(current: HTMLElement) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const items = Array.from(
      root.querySelectorAll(".tasks__item"),
    ) as HTMLElement[];
    const currentItem = current.closest(".tasks__item") as HTMLElement;
    const idx = items.indexOf(currentItem);
    if (idx !== -1 && idx < items.length - 1) {
      items[idx + 1].focus();
    }
  }

  _focusPrev(current: HTMLElement) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const focusables = Array.from(
      root.querySelectorAll(
        '.tasks__item[tabindex="0"], button:not([disabled]), input:not([type="hidden"]):not([disabled])',
      ),
    ) as HTMLElement[];
    const idx = focusables.indexOf(current);
    if (idx > 0) {
      focusables[idx - 1].focus();
    }
  }

  _focusPrevItem(current: HTMLElement) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const items = Array.from(
      root.querySelectorAll(".tasks__item"),
    ) as HTMLElement[];
    const currentItem = current.closest(".tasks__item") as HTMLElement;
    const idx = items.indexOf(currentItem);
    if (idx > 0) {
      items[idx - 1].focus();
    }
  }

  _handleKeyboard(e: KeyboardEvent, taskId: string, name: string) {
    const tasks = orchestratorStore.tasks || [];
    const ids = tasks.map((t) => t.id);
    const total = ids.length;

    if (this._keyboardGrabbedId === null) {
      // Navigation & Selection
      if (e.key === "ArrowDown") {
        e.preventDefault();
        this._focusNextItem(e.target as HTMLElement);
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        this._focusPrevItem(e.target as HTMLElement);
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        this._focusNext(e.target as HTMLElement);
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        this._focusPrev(e.target as HTMLElement);
        return;
      }

      // Grab for reorder
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        this._keyboardGrabbedId = taskId;
        const pos = ids.indexOf(taskId) + 1;
        this._announce(
          `${name} grabbed. Current position ${pos} of ${total}. Use Arrow Up and Down to move, Space or Enter to drop.`,
        );
        getDb()
          .then((db) => this.updateTaskList(db))
          .catch(console.error);
      }

      return;
    }

    // Currently grabbed
    if (e.key === "Escape") {
      e.preventDefault();
      this._announce(
        `Reorder cancelled. ${name} returned to original position.`,
      );
      this._keyboardGrabbedId = null;
      getDb()
        .then((db) => this.updateTaskList(db))
        .catch(console.error);
      return;
    }

    if (e.key === " " || e.key === "Spacebar" || e.key === "Enter") {
      // Drop
      e.preventDefault();
      const pos = ids.indexOf(this._keyboardGrabbedId) + 1;
      const droppedName =
        tasks.find((t) => t.id === this._keyboardGrabbedId)?.name || "Task";
      this._announce(
        `${droppedName} dropped at position ${pos} of ${total}. Reordering complete.`,
      );
      this._keyboardGrabbedId = null;
      getDb()
        .then((db) => this.updateTaskList(db))
        .catch(console.error);
      return;
    }

    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const currentIdx = ids.indexOf(this._keyboardGrabbedId);
      const newIdx = e.key === "ArrowUp" ? currentIdx - 1 : currentIdx + 1;
      if (newIdx < 0 || newIdx >= total) {
        return;
      }

      // Swap
      ids.splice(currentIdx, 1);
      ids.splice(newIdx, 0, this._keyboardGrabbedId);
      this._announce(`Moved to position ${newIdx + 1} of ${total}.`);
      this.handleReorder(this._keyboardGrabbedId, ids[currentIdx], ids);
    }
  }

  _itemAtPoint(x: number, y: number): Element | null {
    const root = this.shadowRoot;
    if (!root) {
      return null;
    }

    const el = root.elementFromPoint(x, y);
    return el?.closest?.(".tasks__item") || null;
  }

  _startAutoScroll() {
    if (this._autoScrollActive) {
      return;
    }
    this._autoScrollActive = true;

    const scrollLoop = () => {
      if (!this._autoScrollActive) {
        return;
      }

      const root = this.shadowRoot;
      const content = root?.querySelector(
        ".tasks__content",
      ) as HTMLElement | null;
      if (content && this._autoScrollSpeed !== 0) {
        content.scrollTop += this._autoScrollSpeed;
      }

      requestAnimationFrame(scrollLoop);
    };

    requestAnimationFrame(scrollLoop);
  }

  _stopAutoScroll() {
    this._autoScrollActive = false;
    this._autoScrollSpeed = 0;
  }

  _updateAutoScrollSpeed(clientY: number) {
    const root = this.shadowRoot;
    const content = root?.querySelector(
      ".tasks__content",
    ) as HTMLElement | null;
    if (!content) {
      this._autoScrollSpeed = 0;
      return;
    }

    const rect = content.getBoundingClientRect();
    const threshold = 50; // pixels from top/bottom to start scrolling

    const distTop = clientY - rect.top;
    const distBottom = rect.bottom - clientY;

    if (distTop >= 0 && distTop < threshold) {
      // Near the top: scroll up. Speed is faster the closer to the edge.
      this._autoScrollSpeed = -((threshold - distTop) / threshold) * 8;
      this._startAutoScroll();
    } else if (distBottom >= 0 && distBottom < threshold) {
      // Near the bottom: scroll down.
      this._autoScrollSpeed = ((threshold - distBottom) / threshold) * 8;
      this._startAutoScroll();
    } else {
      this._autoScrollSpeed = 0;
    }
  }
}

if (!customElements.get(elementName)) {
  customElements.define(elementName, ShadowClawTasks);
}
