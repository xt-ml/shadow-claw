import { getDb, ShadowClawDatabase } from "../../db/db.js";
import { effect } from "../../effect.js";
import { renderMarkdown } from "../../markdown.js";
import { fileViewerStore } from "../../stores/file-viewer.js";
import { orchestratorStore } from "../../stores/orchestrator.js";
import { showError, showInfo, showSuccess, showWarning } from "../../toast.js";
import { Task } from "../../types.js";
import { escapeHtml } from "../../utils.js";

import ShadowClawElement from "../shadow-claw-element.js";
import "../common/shadow-claw-empty-state/shadow-claw-empty-state.js";

import "../shadow-claw-page-header/shadow-claw-page-header.js";

const elementName = "shadow-claw-tasks";
export class ShadowClawTasks extends ShadowClawElement {
  static componentPath = `components/${elementName}`;
  static styles = `${ShadowClawTasks.componentPath}/${elementName}.css`;
  static template = `${ShadowClawTasks.componentPath}/${elementName}.html`;

  tasks: any[] = [];
  cleanup: () => void = () => {};
  editingTask: any | null = null;

  constructor() {
    super();

    this.handleScriptLabel = this.handleScriptLabel.bind(this);
  }

  async connectedCallback() {
    await Promise.all([this.onStylesReady, this.onTemplateReady]);

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

    // Script label toggle
    const isScriptCheckbox = root.getElementById("isScriptCheckbox");
    const taskLabel = root.getElementById("taskLabel");
    const promptTextarea = root.querySelector("textarea[name='prompt']");
    const previewDiv = root.querySelector(".tasks__preview");

    const updatePreview = async () => {
      if (
        promptTextarea instanceof HTMLTextAreaElement &&
        isScriptCheckbox instanceof HTMLInputElement &&
        previewDiv instanceof HTMLElement
      ) {
        previewDiv.innerHTML = await this.renderPreview(
          promptTextarea.value,
          isScriptCheckbox.checked,
        );
      }
    };

    isScriptCheckbox?.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      this.handleScriptLabel(taskLabel, target.checked);
      updatePreview();
    });

    promptTextarea?.addEventListener("input", updatePreview);
  }

  disconnectedCallback() {
    this.cleanup();
  }

  dispatchTerminalSlotReady() {
    this.dispatchEvent(
      new CustomEvent("shadow-claw-terminal-slot-ready", {
        bubbles: true,
        composed: true,
      }),
    );
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
      list.innerHTML = `
        <shadow-claw-empty-state
          class="tasks__empty"
          message="No scheduled tasks for this group."
          hint="Ask the agent to create one using 'create_task'."
        ></shadow-claw-empty-state>
      `;

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

      const previewHtml = await this.renderPreview(
        task.prompt,
        !!task.isScript,
        true,
      );

      item.innerHTML = `
        <div class="tasks__item-header">
          <div class="tasks__item-info">
            <div class="tasks__schedule-row">
              <div class="tasks__schedule">⏰ ${task.schedule}</div>
              ${task.isScript ? '<span class="tasks__script-badge">JS SCRIPT</span>' : ""}
            </div>
            <div class="tasks__prompt-container">
              ${previewHtml}
            </div>
            <div class="tasks__last-run">Last run: ${lastRunStr}</div>
          </div>
          <div class="tasks__actions">
            <label class="tasks__toggle">
              <input type="checkbox" ${task.enabled ? "checked" : ""} data-id="${task.id}" class="tasks__toggle-input" aria-label="${task.enabled ? "Disable" : "Enable"} task scheduled ${escapeHtml(task.schedule)}">
              ${task.enabled ? "Enabled" : "Disabled"}
            </label>
            <button type="button" class="tasks__run-btn" data-id="${task.id}" aria-label="Run task scheduled ${escapeHtml(task.schedule)}">Run</button>
            <button type="button" class="tasks__edit-btn" data-id="${task.id}" aria-label="Edit task scheduled ${escapeHtml(task.schedule)}">✎ Edit</button>
            <button type="button" class="tasks__delete-btn" data-id="${task.id}" aria-label="Delete task scheduled ${escapeHtml(task.schedule)}">Delete</button>
          </div>
        </div>
      `;

      // Bind events
      const toggle = item.querySelector(
        ".tasks__toggle-input",
      ) as HTMLInputElement | null;

      toggle?.addEventListener("change", (e) => {
        const target = e.target as HTMLInputElement;
        orchestratorStore.toggleTask(db, task, target.checked);
      });

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

    list.innerHTML = "";
    list.appendChild(fragment);
  }

  /**
   * Run a task
   */
  handleRun(task: Task) {
    orchestratorStore.runTask(task);
  }

  /**
   * Delete a task
   */
  async handleDelete(db: ShadowClawDatabase, id: string) {
    if (!confirm("Are you sure you want to delete this scheduled task?")) {
      return;
    }

    try {
      await orchestratorStore.deleteTask(db, id);
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  }

  /**
   * Open dialog to add a new task
   */
  handleAdd() {
    this.editingTask = null;
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

    // Reset preview
    const previewDiv = root.querySelector(".tasks__preview");
    if (previewDiv instanceof HTMLElement) {
      this.renderPreview("", false).then((html) => {
        previewDiv.innerHTML = html;
      });
    }

    // Reset label
    this.handleScriptLabel(root.getElementById("taskLabel"), false);

    // Show dialog
    dialog?.showModal();
  }

  /**
   * Open edit dialog for a task
   */
  handleEdit(task: Task) {
    this.editingTask = task;
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

    // Set initial label state
    this.handleScriptLabel(root.getElementById("taskLabel"), !!task.isScript);

    // Set form values
    const scheduleInput = form.querySelector("input[name='schedule']");
    const promptInput = form.querySelector("textarea[name='prompt']");
    const isScriptInput = form.querySelector("input[name='isScript']");
    if (scheduleInput instanceof HTMLInputElement) {
      scheduleInput.value = task.schedule;
    }

    if (promptInput instanceof HTMLTextAreaElement) {
      promptInput.value = task.prompt;
    }

    if (isScriptInput instanceof HTMLInputElement) {
      isScriptInput.checked = !!task.isScript;
    }

    // Set initial preview
    const previewDiv = root.querySelector(".tasks__preview");
    if (previewDiv instanceof HTMLElement) {
      this.renderPreview(task.prompt, !!task.isScript).then((html) => {
        previewDiv.innerHTML = html;
      });
    }

    // Show dialog
    dialog?.showModal();
  }

  /**
   * Handle form submission (add or edit)
   */
  async handleEditSubmit(db: ShadowClawDatabase, form: HTMLFormElement) {
    const formData = new FormData(form);
    const schedule = formData.get("schedule");
    const prompt = formData.get("prompt");
    const isScript = formData.get("isScript") === "on";

    if (!schedule || !prompt) {
      showInfo("Please fill in all fields");

      return;
    }

    try {
      let taskToSave;

      if (this.editingTask) {
        // Update existing task
        taskToSave = {
          ...this.editingTask,
          schedule: String(schedule),
          prompt: String(prompt),
          isScript,
        };
      } else {
        // Create new task
        const currentGroupId = orchestratorStore.activeGroupId;
        taskToSave = {
          id: crypto.randomUUID
            ? crypto.randomUUID()
            : `task-${Date.now()}-${Math.random()}`,
          groupId: currentGroupId,
          schedule: String(schedule),
          prompt: String(prompt),
          isScript,
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

  /**
   * Render a preview of the task prompt
   */
  async renderPreview(
    prompt: string,
    isScript: boolean,
    allowCollapse = false,
  ) {
    if (!prompt.trim()) {
      return '<span class="tasks__preview-empty">No content</span>';
    }

    const lines = prompt.split("\n");
    const isLong = prompt.length > 120 || lines.length > 1;

    const rendered = isScript
      ? await renderMarkdown("```javascript\n" + prompt + "\n```", {
          breaks: true,
        })
      : await renderMarkdown(prompt, { breaks: true });

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

  handleScriptLabel(label: HTMLElement | null, on = false) {
    if (!label) {
      return;
    }

    const root = this.shadowRoot;
    const textarea = root?.querySelector("textarea[name='prompt']");

    if (on) {
      label.textContent = "JavaScript Code";
      textarea?.classList.add("tasks__form-textarea--script");
    } else {
      label.textContent = "Task Prompt";
      textarea?.classList.remove("tasks__form-textarea--script");
    }
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
   * Handle backup (download all tasks as JSON)
   */
  async handleBackup() {
    try {
      const btn = this.shadowRoot?.querySelector(".tasks__backup-btn");
      if (btn instanceof HTMLButtonElement) {
        btn.disabled = true;
      }

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
      if (btn instanceof HTMLButtonElement) {
        btn.disabled = false;
      }

      if (btn) {
        btn.textContent = "💾 Backup";
      }
    }
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

    if (
      !confirm("Restore from backup will replace all current tasks. Continue?")
    ) {
      input.value = "";

      return;
    }

    try {
      const btn = this.shadowRoot?.querySelector(".tasks__restore-btn");
      if (btn instanceof HTMLButtonElement) {
        btn.disabled = true;
      }

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
      if (btn instanceof HTMLButtonElement) {
        btn.disabled = false;
      }

      if (btn) {
        btn.textContent = "♻️ Restore";
      }
    }
  }

  /**
   * Handle clear all (delete all tasks)
   */
  async handleClearAll(db: ShadowClawDatabase) {
    if (!confirm("Delete ALL tasks? This cannot be undone!")) {
      return;
    }

    try {
      const btn = this.shadowRoot?.querySelector(".tasks__clear-btn");
      if (btn instanceof HTMLButtonElement) {
        btn.disabled = true;
      }

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
      if (btn instanceof HTMLButtonElement) {
        btn.disabled = false;
      }

      if (btn) {
        btn.textContent = "🗑️ Clear All";
      }
    }
  }
}

customElements.define(elementName, ShadowClawTasks);
