import { renderMarkdown } from "../../content/markdown.js";
import { effect } from "../../core/effect.js";

import { getDb, ShadowClawDatabase } from "../../db/db.js";
import { Task } from "../../db/types.js";

import { setSanitizedHtml } from "../../security/trusted-types.js";
import { fileViewerStore } from "../../stores/file-viewer.js";
import { orchestratorStore } from "../../stores/orchestrator.js";

import { showError, showInfo, showSuccess } from "../../ui/toast.js";
import { escapeHtml } from "../../utils/utils.js";

import "../common/shadow-claw-empty-state/shadow-claw-empty-state.js";
import "../common/shadow-claw-page-header-action-button/shadow-claw-page-header-action-button.js";
import "../shadow-claw-dialog/shadow-claw-dialog.js";
import "../shadow-claw-page-header/shadow-claw-page-header.js";

import ShadowClawElement from "../shadow-claw-element.js";
import shadowClawTasksStyles from "./shadow-claw-tasks.css" with { type: "css" };
import shadowClawTasksTemplate from "./shadow-claw-tasks.html" with { type: "html" };

const elementName = "shadow-claw-tasks";

export class ShadowClawTasks extends ShadowClawElement {
  static styles = shadowClawTasksStyles;
  static template = shadowClawTasksTemplate;

  editingTask: any | null = null;
  editingTools: any[] = [];
  tasks: any[] = [];

  constructor() {
    super();
  }

  async connectedCallback() {

    const root = this.shadowRoot;
    if (!root) {
      throw new Error("shadowRoot not found");
    }

    const db = await getDb();

    root.addEventListener("click", (event: Event) => {
      if (event instanceof MouseEvent) {
        void this.handlePreviewLinkClick(event, db);
      }
    });

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

    this.render();
    this.dispatchTerminalSlotReady();

    // Re-render when tasks change
    this.cleanup = effect(() => {
      orchestratorStore.tasks;
      this.updateTaskList(db);
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
        this.handleRestore(db, e.target);
      }
    });

    // Clear all button
    const clearBtn = root.querySelector(".tasks__clear-btn");
    clearBtn?.addEventListener("click", () => this.handleClearAll(db));

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
        this.handleEditSubmit(db, form);
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
    const scheduleInput = form.querySelector("input[name='schedule']");
    const promptInput = form.querySelector("textarea[name='prompt']");
    if (scheduleInput instanceof HTMLInputElement) {
      scheduleInput.value = task.schedule || "";
    }

    if (promptInput instanceof HTMLTextAreaElement) {
      promptInput.value = task.prompt || "";
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

      item.appendChild(header);
      item.appendChild(nameInput);
      item.appendChild(paramsInput);
      item.appendChild(suppressLabel);
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
    const schedule = formData.get("schedule");
    const prompt = formData.get("prompt");
    const type = (formData.get("taskType") as "prompt" | "tools") || "prompt";

    const scheduleStr = schedule ? String(schedule).trim() : "";

    if (type === "prompt" && !prompt) {
      showInfo("Please provide a task prompt.");

      return;
    }

    try {
      let taskToSave;

      if (this.editingTask) {
        // Update existing task
        taskToSave = {
          ...this.editingTask,
          schedule: scheduleStr,
          type,
          prompt: String(prompt || ""),
          tools: JSON.parse(JSON.stringify(this.editingTools)),
        };
      } else {
        // Create new task
        const currentGroupId = orchestratorStore.activeGroupId;
        taskToSave = {
          id: crypto.randomUUID
            ? crypto.randomUUID()
            : `task-${Date.now()}-${Math.random()}`,
          groupId: currentGroupId,
          schedule: scheduleStr,
          type,
          prompt: String(prompt || ""),
          tools: JSON.parse(JSON.stringify(this.editingTools)),
          enabled: true,
          lastRun: null,
          createdAt: Date.now(),
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

    const rendered = await renderMarkdown(prompt, { breaks: true });

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

    for (const task of tasks) {
      const item = document.createElement("div");
      item.className = "tasks__item";
      item.setAttribute("role", "listitem");

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

      setSanitizedHtml(
        item,
        `<div class="tasks__item-header">
          <div class="tasks__item-info">
            <div class="tasks__schedule-row">
              <div class="tasks__schedule">${scheduleDisplay} <span class="tasks__type-badge">(${isTools ? "Tools" : "Prompt"})</span></div>
            </div>
            <div class="tasks__prompt-container">
              ${previewHtml}
            </div>
            <div class="tasks__last-run">Last run: ${escapeHtml(lastRunStr)}</div>
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

      fragment.appendChild(item);
    }

    list.replaceChildren();
    list.appendChild(fragment);
  }
}

if (!customElements.get(elementName)) {
  customElements.define(elementName, ShadowClawTasks);
}
