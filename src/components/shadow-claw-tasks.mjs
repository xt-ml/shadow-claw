import { getDb } from "../db/db.mjs";
import { saveTask } from "../db/saveTask.mjs";
import { effect } from "../effect.mjs";
import { orchestratorStore } from "../stores/orchestrator.mjs";

/**
 * @typedef {import("../types.mjs").Task} Task
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

export class ShadowClawTasks extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    /** @type {any[]} */
    this.tasks = [];
    /** @type {() => void} */
    this.cleanup = () => {};
    /** @type {Task|null} */
    this.editingTask = null;
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
          align-items: center;
          background-color: var(--shadow-claw-bg-primary, #ffffff);
          border-bottom: 1px solid var(--shadow-claw-border-color, #e5e7eb);
          display: flex;
          justify-content: space-between;
          padding: 16px;
        }

        .header h2 {
          font-size: 18px;
          font-weight: 600;
          margin: 0;
        }

        .content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .task-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .task-item {
          background-color: var(--shadow-claw-bg-secondary, #f9fafb);
          border-radius: 8px;
          border: 1px solid var(--shadow-claw-border-color, #e5e7eb);
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px;
        }

        .task-header {
          align-items: flex-start;
          display: flex;
          justify-content: space-between;
        }

        .task-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .task-schedule {
          color: var(--shadow-claw-accent-primary, #3b82f6);
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .task-prompt {
          color: var(--shadow-claw-text-primary, #111827);
          font-size: 14px;
          word-break: break-word;
        }

        .task-actions {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          justify-content: flex-end;
          margin-left: 1rem;
          max-width: 12.5rem;
          min-width: 12.5rem;
          width: 12.5rem;
        }

        .task-toggle {
          align-items: center;
          color: var(--shadow-claw-text-secondary, #6b7280);
          cursor: pointer;
          display: flex;
          flex-basis: 100%;
          font-size: 13px;
          gap: 8px;
          margin-bottom: 8px;
          order: -1;
          user-select: none;
        }

        .task-toggle input[type="checkbox"] {
          accent-color: var(--shadow-claw-accent-primary);
          cursor: pointer;
          height: 16px;
          width: 16px;
        }

        .delete-btn,
        .edit-btn {
          background: transparent;
          border-radius: var(--shadow-claw-radius-m);
          border: 1px solid;
          cursor: pointer;
          flex: 1;
          font-size: 11px;
          min-width: 70px;
          padding: 6px 10px;
          transition: all 0.15s;
          white-space: nowrap;
        }

        .delete-btn {
          border-color: var(--shadow-claw-error-color, #ef4444);
          color: var(--shadow-claw-error-color, #ef4444);
        }

        .delete-btn:hover {
          background-color: var(--shadow-claw-error-color, #ef4444);
          color: white;
        }

        .edit-btn {
          border-color: var(--shadow-claw-accent-primary);
          color: var(--shadow-claw-accent-primary);
        }

        .edit-btn:hover {
          background-color: var(--shadow-claw-accent-primary);
          color: var(--shadow-claw-on-primary);
        }

        .run-btn {
          background: transparent;
          border-radius: var(--shadow-claw-radius-m);
          border: 1px solid var(--shadow-claw-success-color, #10b981);
          color: var(--shadow-claw-success-color, #10b981);
          cursor: pointer;
          flex: 1;
          font-size: 11px;
          font-weight: 600;
          min-width: 70px;
          padding: 6px 10px;
          transition: all 0.15s;
          white-space: nowrap;
        }

        .run-btn:hover {
          background-color: var(--shadow-claw-success-color);
          border-color: var(--shadow-claw-success-color);
          color: var(--shadow-claw-on-primary, white);
        }

        .empty-state {
          align-items: center;
          color: var(--shadow-claw-text-tertiary, #9ca3af);
          display: flex;
          flex-direction: column;
          height: 100%;
          justify-content: center;
          text-align: center;
        }

        .empty-state p {
          font-size: 14px;
          margin-top: 8px;
        }

        .last-run {
          color: var(--shadow-claw-text-tertiary, #9ca3af);
          font-size: 11px;
          margin-top: 4px;
        }

        /* Dialog styles */
        dialog {
          background-color: var(--shadow-claw-bg-primary, #ffffff);
          color: var(--shadow-claw-text-primary, #111827);
          border: 1px solid var(--shadow-claw-border-color);
          border-radius: var(--shadow-claw-radius-l);
          box-shadow: var(--shadow-claw-shadow-lg);
          padding: 0;
          max-width: 500px;
          width: 90%;
        }

        dialog::backdrop {
          background-color: rgba(0, 0, 0, 0.5);
        }

        .edit-dialog-header {
          align-items: center;
          border-bottom: 1px solid var(--shadow-claw-border-color, #e5e7eb);
          display: flex;
          justify-content: space-between;
          padding: 16px;
        }

        .edit-dialog-header h3 {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
        }

        .edit-dialog-close {
          align-items: center;
          background: none;
          border: none;
          color: var(--shadow-claw-text-secondary, #6b7280);
          cursor: pointer;
          display: flex;
          font-size: 20px;
          height: 24px;
          justify-content: center;
          padding: 0;
          width: 24px;
        }

        .edit-dialog-close:hover {
          color: var(--shadow-claw-text-primary, #111827);
        }

        .edit-dialog-body {
          padding: 16px;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-group:last-of-type {
          margin-bottom: 0;
        }

        .form-label {
          color: var(--shadow-claw-text-primary, #111827);
          display: block;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 6px;
          text-transform: uppercase;
        }

        .form-input,
        .form-textarea {
          background-color: var(--shadow-claw-bg-secondary, #f9fafb);
          border-radius: var(--shadow-claw-radius-s);
          border: 1px solid var(--shadow-claw-border-color, #e5e7eb);
          box-sizing: border-box;
          color: var(--shadow-claw-text-primary, #111827);
          font-family: inherit;
          font-size: 14px;
          padding: 8px;
          transition: border-color 0.15s;
          width: 100%;
        }

        .form-input:focus,
        .form-textarea:focus {
          outline: none;
          border-color: var(--shadow-claw-accent-primary, #3b82f6);
          background-color: var(--shadow-claw-bg-primary, #ffffff);
        }

        .form-textarea {
          resize: vertical;
          min-height: 100px;
        }

        .form-hint {
          font-size: 11px;
          color: var(--shadow-claw-text-tertiary, #9ca3af);
          margin-top: 4px;
        }

        .edit-dialog-footer {
          padding: 16px;
          border-top: 1px solid var(--shadow-claw-border-color, #e5e7eb);
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .btn-cancel,
        .btn-save {
          padding: 8px 16px;
          font-size: 12px;
          border-radius: var(--shadow-claw-radius-m);
          border: 1px solid;
          cursor: pointer;
          transition: all 0.15s;
          font-weight: 600;
        }

        .btn-cancel {
          background-color: var(--shadow-claw-bg-secondary, #f9fafb);
          border-color: var(--shadow-claw-border-color, #e5e7eb);
          color: var(--shadow-claw-text-primary, #111827);
        }

        .btn-cancel:hover {
          background-color: var(--shadow-claw-bg-tertiary, #f3f4f6);
        }

        .btn-save {
          background-color: var(--shadow-claw-accent-primary, #3b82f6);
          border-color: var(--shadow-claw-accent-primary, #3b82f6);
          color: var(--shadow-claw-on-primary, white);
        }

        .btn-save:hover {
          background-color: var(--shadow-claw-accent-hover, #2563eb);
          border-color: var(--shadow-claw-accent-hover, #2563eb);
        }

        .btn-save:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      </style>
      <div class="header">
        <h2>✓ Tasks</h2>
        <div style="display: flex; gap: 8px;">
          <button class="add-btn" style="padding: 4px 12px; font-size: 12px; background-color: var(--shadow-claw-accent-primary); border: 1px solid var(--shadow-claw-accent-primary); border-radius: var(--shadow-claw-radius-m); cursor: pointer; color: var(--shadow-claw-on-primary); font-weight: 600;">+ Add Task</button>
          <button class="backup-btn" style="padding: 4px 12px; font-size: 12px; background-color: var(--shadow-claw-bg-tertiary); border: 1px solid var(--shadow-claw-border-color); border-radius: var(--shadow-claw-radius-m); cursor: pointer; color: var(--shadow-claw-text-secondary);">💾 Backup</button>
          <button class="restore-btn" style="padding: 4px 12px; font-size: 12px; background-color: var(--shadow-claw-bg-tertiary); border: 1px solid var(--shadow-claw-border-color); border-radius: var(--shadow-claw-radius-m); cursor: pointer; color: var(--shadow-claw-text-secondary);">♻️ Restore</button>
          <button class="clear-btn" style="padding: 4px 12px; font-size: 12px; background-color: var(--shadow-claw-bg-tertiary); border: 1px solid var(--shadow-claw-border-color, #e5e7eb); border-color: var(--shadow-claw-error-color, #ef4444); border-radius: var(--shadow-claw-radius-m); cursor: pointer; color: var(--shadow-claw-error-color, #ef4444);">🗑️ Clear All</button>
        </div>
      </div>
      <input type="file" class="hidden-restore" style="display: none;" accept=".json,application/json">
      <div class="content">
        <div class="task-list"></div>
      </div>
      <!-- Add/Edit Task Dialog -->
      <dialog class="edit-dialog-modal">
        <div class="edit-dialog-header">
          <h3 class="dialog-title">Add Task</h3>
          <button type="button" class="edit-dialog-close">✕</button>
        </div>
        <form class="edit-dialog-form">
          <div class="edit-dialog-body">
            <div class="form-group">
              <label class="form-label">Schedule (Cron Expression)</label>
              <input type="text" class="form-input" name="schedule" placeholder="e.g., 0 9 * * * (daily at 9 AM)" required>
              <div class="form-hint">Standard cron format (sec min hour day month weekday)</div>
            </div>
            <div class="form-group">
              <label class="form-label">Task Prompt</label>
              <textarea class="form-textarea" name="prompt" placeholder="Enter the task prompt..." required></textarea>
            </div>
          </div>
          <div class="edit-dialog-footer">
            <button type="button" class="btn-cancel">Cancel</button>
            <button type="submit" class="btn-save dialog-submit">Add Task</button>
          </div>
        </form>
      </dialog>
    `;
  }

  connectedCallback() {
    const db = getDb();

    if (!db) {
      throw new Error(
        "shadow-claw-tasks cannot get the db on connectedCallback",
      );
    }

    this.render();

    // Re-render when tasks change
    this.cleanup = effect(() => {
      orchestratorStore.tasks;
      this.updateTaskList(db);
    });

    const root = this.shadowRoot;
    if (!root) return;

    // Backup button
    const backupBtn = root.querySelector(".backup-btn");
    backupBtn?.addEventListener("click", () => this.handleBackup());

    // Restore button
    const restoreBtn = root.querySelector(".restore-btn");
    const restoreInput = root.querySelector(".hidden-restore");
    restoreBtn?.addEventListener("click", () => {
      if (restoreInput instanceof HTMLInputElement) restoreInput.click();
    });

    restoreInput?.addEventListener("change", (e) => {
      if (e.target instanceof HTMLInputElement)
        this.handleRestore(db, e.target);
    });

    // Clear all button
    const clearBtn = root.querySelector(".clear-btn");
    clearBtn?.addEventListener("click", () => this.handleClearAll(db));

    // Add task button
    const addBtn = root.querySelector(".add-btn");
    addBtn?.addEventListener("click", () => this.handleAdd());

    // Dialog controls
    const dialog = root.querySelector("dialog");
    const closeBtn = root.querySelector(".edit-dialog-close");
    const cancelBtn = root.querySelector(".btn-cancel");
    const form = /** @type {HTMLFormElement | null} */ (
      root.querySelector(".edit-dialog-form")
    );

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
    template.innerHTML = ShadowClawTasks.getTemplate();

    root.innerHTML = "";
    root.appendChild(template.content.cloneNode(true));
  }

  /**
   * @param {ShadowClawDatabase} db
   */
  updateTaskList(db) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const list = root.querySelector(".task-list");
    if (!list) {
      return;
    }

    const tasks = orchestratorStore.tasks;

    if (tasks.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <p>No scheduled tasks for this group.</p>
          <p style="font-size: 12px;">Ask the agent to create one using "create_task".</p>
        </div>
      `;

      return;
    }

    list.innerHTML = "";
    tasks.forEach((/** @type {Task} */ task) => {
      const item = document.createElement("div");
      item.className = "task-item";

      const lastRunStr = task.lastRun
        ? new Date(task.lastRun).toLocaleString()
        : "Never";

      item.innerHTML = `
        <div class="task-header">
          <div class="task-info">
            <div class="task-schedule">⏰ ${task.schedule}</div>
            <div class="task-prompt">${this.escapeHtml(task.prompt)}</div>
            <div class="last-run">Last run: ${lastRunStr}</div>
          </div>
          <div class="task-actions">
            <label class="task-toggle">
              <input type="checkbox" ${task.enabled ? "checked" : ""} data-id="${task.id}" class="toggle-input">
              ${task.enabled ? "Enabled" : "Disabled"}
            </label>
            <button class="run-btn" data-id="${task.id}">Run</button>
            <button class="edit-btn" data-id="${task.id}">✎ Edit</button>
            <button class="delete-btn" data-id="${task.id}">Delete</button>
          </div>
        </div>
      `;

      // Bind events
      const toggle = /** @type {HTMLInputElement | null} */ (
        item.querySelector(".toggle-input")
      );

      toggle?.addEventListener("change", (e) => {
        const target = /** @type {HTMLInputElement} */ (e.target);
        orchestratorStore.toggleTask(db, task, target.checked);
      });

      const runBtn = item.querySelector(".run-btn");
      runBtn?.addEventListener("click", () => this.handleRun(task));

      const editBtn = item.querySelector(".edit-btn");
      editBtn?.addEventListener("click", () => this.handleEdit(task));

      const deleteBtn = item.querySelector(".delete-btn");
      deleteBtn?.addEventListener("click", () =>
        this.handleDelete(db, task.id),
      );

      list.appendChild(item);
    });
  }

  /**
   * Run a task
   *
   * @param {Task} task
   */
  handleRun(task) {
    orchestratorStore.runTask(task.prompt);
  }

  /**
   * Delete a task
   *
   * @param {ShadowClawDatabase} db
   * @param {string} id
   */
  async handleDelete(db, id) {
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
    const form = root.querySelector(".edit-dialog-form");
    const title = root.querySelector(".dialog-title");
    const submitBtn = root.querySelector(".dialog-submit");

    if (!form || !(form instanceof HTMLFormElement)) {
      return;
    }

    // Update dialog for add mode
    if (title) title.textContent = "Add Task";
    if (submitBtn) submitBtn.textContent = "Add Task";

    // Clear form
    form.reset();

    // Show dialog
    dialog?.showModal();
  }

  /**
   * Open edit dialog for a task
   *
   * @param {Task} task
   */
  handleEdit(task) {
    this.editingTask = task;
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const dialog = root.querySelector("dialog");
    const form = root.querySelector(".edit-dialog-form");
    const title = root.querySelector(".dialog-title");
    const submitBtn = root.querySelector(".dialog-submit");

    if (!form || !(form instanceof HTMLFormElement)) {
      return;
    }

    // Update dialog for edit mode
    if (title) title.textContent = "Edit Task";
    if (submitBtn) submitBtn.textContent = "Save Changes";

    // Set form values
    const scheduleInput = form.querySelector("input[name='schedule']");
    const promptInput = form.querySelector("textarea[name='prompt']");
    if (scheduleInput instanceof HTMLInputElement) {
      scheduleInput.value = task.schedule;
    }
    if (promptInput instanceof HTMLTextAreaElement) {
      promptInput.value = task.prompt;
    }

    // Show dialog
    dialog?.showModal();
  }

  /**
   * Handle form submission (add or edit)
   *
   * @param {ShadowClawDatabase} db
   * @param {HTMLFormElement} form
   */
  async handleEditSubmit(db, form) {
    const formData = new FormData(form);
    const schedule = formData.get("schedule");
    const prompt = formData.get("prompt");

    if (!schedule || !prompt) {
      alert("Please fill in all fields");
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
          enabled: true,
          lastRun: null,
          createdAt: Date.now(),
        };
      }

      await saveTask(db, taskToSave);
      await orchestratorStore.loadTasks(db);

      const root = this.shadowRoot;
      const dialog = root?.querySelector("dialog");
      dialog?.close();

      this.editingTask = null;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert(`Failed to save task: ${message}`);
      console.error("Save error:", err);
    }
  }

  /**
   * Escape HTML special characters
   * @param {string} text
   * @returns {string}
   */
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Handle backup (download all tasks as JSON)
   */
  async handleBackup() {
    try {
      const btn = this.shadowRoot?.querySelector(".backup-btn");
      if (btn instanceof HTMLButtonElement) btn.disabled = true;
      if (btn) btn.textContent = "⏳";

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
      alert(`Failed to create backup: ${message}`);
      console.error("Backup error:", err);
    } finally {
      const btn = this.shadowRoot?.querySelector(".backup-btn");
      if (btn instanceof HTMLButtonElement) btn.disabled = false;
      if (btn) btn.textContent = "💾 Backup";
    }
  }

  /**
   * Handle restore (upload and import JSON)
   *
   * @param {ShadowClawDatabase} db
   * @param {HTMLInputElement} input
   */
  async handleRestore(db, input) {
    const files = input.files;
    if (!files || files.length === 0) return;

    const jsonFile = files[0];
    if (!jsonFile.name.endsWith(".json")) {
      alert("Please select a .json file");
      return;
    }

    if (
      !confirm("Restore from backup will replace all current tasks. Continue?")
    ) {
      input.value = "";
      return;
    }

    try {
      const btn = this.shadowRoot?.querySelector(".restore-btn");
      if (btn instanceof HTMLButtonElement) btn.disabled = true;
      if (btn) btn.textContent = "⏳";

      const text = await jsonFile.text();
      const tasks = JSON.parse(text);

      if (!Array.isArray(tasks)) {
        throw new Error("Invalid backup file format");
      }

      await orchestratorStore.restoreTasksFromBackup(db, tasks);
      input.value = "";
      alert("Tasks restored successfully!");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert(`Failed to restore from backup: ${message}`);
      console.error("Restore error:", err);
    } finally {
      const btn = this.shadowRoot?.querySelector(".restore-btn");
      if (btn instanceof HTMLButtonElement) btn.disabled = false;
      if (btn) btn.textContent = "♻️ Restore";
    }
  }

  /**
   * Handle clear all (delete all tasks)
   *
   * @param {ShadowClawDatabase} db
   */
  async handleClearAll(db) {
    if (!confirm("Delete ALL tasks? This cannot be undone!")) {
      return;
    }

    try {
      const btn = this.shadowRoot?.querySelector(".clear-btn");
      if (btn instanceof HTMLButtonElement) btn.disabled = true;
      if (btn) btn.textContent = "⏳";
      await orchestratorStore.clearAllTasks(db);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert(`Failed to clear tasks: ${message}`);
      console.error("Clear error:", err);
    } finally {
      const btn = this.shadowRoot?.querySelector(".clear-btn");
      if (btn instanceof HTMLButtonElement) btn.disabled = false;
      if (btn) btn.textContent = "🗑️ Clear All";
    }
  }
}

customElements.define("tasks-page", ShadowClawTasks);
