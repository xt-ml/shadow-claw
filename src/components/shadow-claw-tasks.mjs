import { getDb } from "../db/db.mjs";
import { saveTask } from "../db/saveTask.mjs";
import { effect } from "../effect.mjs";
import { renderMarkdown } from "../markdown.mjs";
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

    this.handleScriptLabel = this.handleScriptLabel.bind(this);
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
          border-bottom: 0.0625rem solid var(--shadow-claw-border-color, #e5e7eb);
          display: flex;
          justify-content: space-between;
          padding: 1rem;
        }

        .header h2 {
          font-size: 1.125rem;
          font-weight: 600;
          margin: 0;
        }

        .content {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
        }

        .task-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .task-item {
          background-color: var(--shadow-claw-bg-secondary, #f9fafb);
          border-radius: 0.5rem;
          border: 0.0625rem solid var(--shadow-claw-border-color, #e5e7eb);
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding: 0.75rem;
        }

        .task-header {
          align-items: flex-start;
          display: flex;
          justify-content: space-between;
        }

        .task-info {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
        }

        .task-schedule {
          color: var(--shadow-claw-accent-primary, #3b82f6);
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
        }

        .task-prompt {
          color: var(--shadow-claw-text-primary, #111827);
          font-size: 0.875rem;
          word-break: break-word;
        }

        .task-prompt p {
          margin-bottom: 0.5rem;
        }

        .task-prompt p:last-child {
          margin-bottom: 0;
        }

        .task-prompt pre {
          background-color: var(--shadow-claw-bg-tertiary);
          border-radius: 0.375rem;
          margin: 0.75rem 0;
          overflow-x: auto;
          padding: 0.5rem;
        }

        .task-prompt pre code.hljs {
          background-color: transparent;
          border-radius: 0.375rem;
          color: var(--shadow-claw-text-primary);
          display: block;
          font-family: var(--shadow-claw-font-mono);
          font-size: 0.8125rem;
          padding: 0;
        }

        .task-prompt code {
          background-color: var(--shadow-claw-bg-tertiary);
          border-radius: 0.1875rem;
          color: var(--shadow-claw-text-primary);
          font-family: var(--shadow-claw-font-mono);
          font-size: 0.8125rem;
          padding: 0.125rem 0.375rem;
        }

        .task-prompt code.hljs {
          background: transparent;
          color: var(--shadow-claw-text-primary);
          padding: 0;
        }

        .task-actions {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 0.375rem;
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
          font-size: 0.8125rem;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
          order: -1;
          user-select: none;
        }

        .task-toggle input[type="checkbox"] {
          accent-color: var(--shadow-claw-accent-primary);
          cursor: pointer;
          height: 1rem;
          width: 1rem;
        }

        .delete-btn,
        .edit-btn {
          background: transparent;
          border-radius: var(--shadow-claw-radius-m);
          border: 0.0625rem solid;
          cursor: pointer;
          flex: 1;
          font-size: 0.6875rem;
          min-width: 4.375rem;
          padding: 0.375rem 0.625rem;
          transition: all 0.15s;
          white-space: nowrap;
        }

        /* Accordion styles */
        .task-content-details {
          width: 100%;
        }

        .task-content-summary {
          align-items: flex-start;
          color: var(--shadow-claw-text-tertiary);
          cursor: pointer;
          display: flex;
          font-size: 0.75rem;
          font-weight: 500;
          gap: 0.5rem;
          list-style: none;
          margin-top: 0.25rem;
          outline: none;
          padding: 0.25rem 0;
          user-select: none;
        }

        .task-content-summary::-webkit-details-marker {
          display: none;
        }

        .task-content-summary:hover {
          color: var(--shadow-claw-accent-primary);
        }

        .task-content-summary::before {
          content: '▶';
          display: inline-block;
          font-size: 0.625rem;
          transition: transform 0.2s ease;
        }

        .task-content-details[open] .task-content-summary::before {
          transform: rotate(90deg);
        }

        .task-content-summary .summary-label {
          flex-shrink: 0;
          text-decoration: underline;
          text-underline-offset: 0.125rem;
        }

        .task-content-summary .summary-text {
          display: -webkit-box;
          line-height: 1.35;
          overflow: hidden;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          white-space: pre-wrap;
          word-break: break-word;
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
          border: 0.0625rem solid var(--shadow-claw-success-color, #10b981);
          color: var(--shadow-claw-success-color, #10b981);
          cursor: pointer;
          flex: 1;
          font-size: 0.6875rem;
          font-weight: 600;
          min-width: 4.375rem;
          padding: 0.375rem 0.625rem;
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
          font-size: 0.875rem;
          margin-top: 0.5rem;
        }

        .last-run {
          color: var(--shadow-claw-text-tertiary, #9ca3af);
          font-size: 0.6875rem;
          margin-top: 0.25rem;
        }

        /* Dialog styles */
        dialog {
          background-color: var(--shadow-claw-bg-primary, #ffffff);
          border-radius: var(--shadow-claw-radius-l);
          border: 0.0625rem solid var(--shadow-claw-border-color);
          box-shadow: var(--shadow-claw-shadow-lg);
          color: var(--shadow-claw-text-primary, #111827);
          max-width: 31.25rem;
          padding: 0;
          width: 90%;
        }

        dialog::backdrop {
          background-color: rgba(0, 0, 0, 0.5);
        }

        .edit-dialog-header {
          align-items: center;
          border-bottom: 0.0625rem solid var(--shadow-claw-border-color, #e5e7eb);
          display: flex;
          justify-content: space-between;
          padding: 1rem;
        }

        .edit-dialog-header h3 {
          font-size: 1rem;
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
          font-size: 1.25rem;
          height: 1.5rem;
          justify-content: center;
          padding: 0;
          width: 1.5rem;
        }

        .edit-dialog-close:hover {
          color: var(--shadow-claw-text-primary, #111827);
        }

        .edit-dialog-body {
          padding: 1rem;
        }

        #isScriptCheckbox {
          accent-color: var(--shadow-claw-accent-primary);
          cursor: pointer;
          height: 1rem;
          width: 1rem;
        }

        .form-group {
          margin-bottom: 1rem;
        }

        .form-group:last-of-type {
          margin-bottom: 0;
        }

        .form-label {
          color: var(--shadow-claw-text-primary, #111827);
          display: block;
          font-size: 0.75rem;
          font-weight: 600;
          margin-bottom: 0.375rem;
          text-transform: uppercase;
        }

        .form-input,
        .form-textarea {
          background-color: var(--shadow-claw-bg-secondary, #f9fafb);
          border-radius: var(--shadow-claw-radius-s);
          border: 0.0625rem solid var(--shadow-claw-border-color, #e5e7eb);
          box-sizing: border-box;
          color: var(--shadow-claw-text-primary, #111827);
          font-family: inherit;
          font-size: 0.875rem;
          padding: 0.5rem;
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
          min-height: 6.25rem;
        }

        .form-textarea.is-script {
          font-family: var(--shadow-claw-font-mono, monospace);
          white-space: pre;
        }

        .form-hint {
          font-size: 0.6875rem;
          color: var(--shadow-claw-text-tertiary, #9ca3af);
          margin-top: 0.25rem;
        }

        .edit-dialog-footer {
          padding: 1rem;
          border-top: 0.0625rem solid var(--shadow-claw-border-color, #e5e7eb);
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
        }

        .btn-cancel,
        .btn-save {
          padding: 0.5rem 1rem;
          font-size: 0.75rem;
          border-radius: var(--shadow-claw-radius-m);
          border: 0.0625rem solid;
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

        .header-actions {
          display: flex;
          gap: 0.5rem;
        }

        .add-btn {
          background-color: var(--shadow-claw-accent-primary);
          border-radius: var(--shadow-claw-radius-m);
          border: 0.0625rem solid var(--shadow-claw-accent-primary);
          color: var(--shadow-claw-on-primary);
          cursor: pointer;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.25rem 0.75rem;
        }

        .backup-btn,
        .restore-btn {
          background-color: var(--shadow-claw-bg-tertiary);
          border-radius: var(--shadow-claw-radius-m);
          border: 0.0625rem solid var(--shadow-claw-border-color);
          color: var(--shadow-claw-text-secondary);
          cursor: pointer;
          font-size: 0.75rem;
          padding: 0.25rem 0.75rem;
        }

        .clear-btn {
          background-color: var(--shadow-claw-bg-tertiary);
          border-radius: var(--shadow-claw-radius-m);
          border: 0.0625rem solid var(--shadow-claw-error-color, #ef4444);
          color: var(--shadow-claw-error-color, #ef4444);
          cursor: pointer;
          font-size: 0.75rem;
          padding: 0.25rem 0.75rem;
        }

        .hidden-restore {
          display: none;
        }

        .form-group-row {
          align-items: center;
          display: flex;
          gap: 0.5rem;
        }

        .form-label-inline {
          cursor: pointer;
          margin-bottom: 0;
        }

        .empty-state-hint {
          font-size: 0.75rem;
        }

        .task-schedule-row {
          align-items: center;
          display: flex;
          gap: 0.375rem;
        }

        .script-badge {
          background: var(--shadow-claw-accent-primary);
          border-radius: 0.25rem;
          color: var(--shadow-claw-on-primary);
          font-size: 0.625rem;
          font-weight: bold;
          padding: 0.0625rem 0.25rem;
        }

        .task-preview-container {
          margin-top: 1rem;
        }

        .task-preview {
          background-color: var(--shadow-claw-bg-secondary);
          border-radius: var(--shadow-claw-radius-s);
          border: 0.0625rem solid var(--shadow-claw-border-color);
          margin-top: 0.375rem;
          min-height: 3rem;
          padding: 0.75rem;
        }
      </style>
      <div class="header">
        <h2>✓ Tasks</h2>
        <div class="header-actions">
          <button class="add-btn">+ Add Task</button>
          <button class="backup-btn">💾 Backup</button>
          <button class="restore-btn">♻️ Restore</button>
          <button class="clear-btn">🗑️ Clear All</button>
        </div>
      </div>
      <input type="file" class="hidden-restore" accept=".json,application/json">
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
              <label class="form-label" id="taskLabel">Task Prompt</label>
              <textarea class="form-textarea" name="prompt" placeholder="Enter the task prompt..." required></textarea>
            </div>
            <div class="form-group form-group-row">
              <input type="checkbox" name="isScript" id="isScriptCheckbox">
              <label for="isScriptCheckbox" class="form-label form-label-inline">Is JavaScript</label>
            </div>
            <div class="form-group task-preview-container">
              <label class="form-label">Preview</label>
              <div class="task-preview task-prompt"></div>
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

  async connectedCallback() {
    const db = getDb();

    if (!db) {
      throw new Error(
        "shadow-claw-tasks cannot get the db on connectedCallback",
      );
    }

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
      if (e.target instanceof HTMLInputElement) {
        this.handleRestore(db, e.target);
      }
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

    // Script label toggle
    const isScriptCheckbox = root.getElementById("isScriptCheckbox");
    const taskLabel = root.getElementById("taskLabel");
    const promptTextarea = root.querySelector("textarea[name='prompt']");
    const previewDiv = root.querySelector(".task-preview");

    const updatePreview = () => {
      if (
        promptTextarea instanceof HTMLTextAreaElement &&
        isScriptCheckbox instanceof HTMLInputElement &&
        previewDiv instanceof HTMLElement
      ) {
        previewDiv.innerHTML = this.renderPreview(
          promptTextarea.value,
          isScriptCheckbox.checked,
        );
      }
    };

    isScriptCheckbox?.addEventListener("change", (e) => {
      const target = /** @type {HTMLInputElement} */ (e.target);
      this.handleScriptLabel(taskLabel, target.checked);
      updatePreview();
    });

    promptTextarea?.addEventListener("input", updatePreview);
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
          <p class="empty-state-hint">Ask the agent to create one using "create_task".</p>
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
            <div class="task-schedule-row">
              <div class="task-schedule">⏰ ${task.schedule}</div>
              ${task.isScript ? '<span class="script-badge">JS SCRIPT</span>' : ""}
            </div>
            <div class="task-prompt-container">
              ${this.renderPreview(task.prompt, !!task.isScript, true)}
            </div>
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
    orchestratorStore.runTask(task);
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
    if (title) {
      title.textContent = "Add Task";
    }

    if (submitBtn) {
      submitBtn.textContent = "Add Task";
    }

    // Clear form
    form.reset();

    // Reset preview
    const previewDiv = root.querySelector(".task-preview");
    if (previewDiv instanceof HTMLElement) {
      previewDiv.innerHTML = this.renderPreview("", false);
    }

    // Reset label
    this.handleScriptLabel(root.getElementById("taskLabel"), false);

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
    const previewDiv = root.querySelector(".task-preview");
    if (previewDiv instanceof HTMLElement) {
      previewDiv.innerHTML = this.renderPreview(task.prompt, !!task.isScript);
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
    const isScript = formData.get("isScript") === "on";

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
   * Render a preview of the task prompt
   *
   * @param {string} prompt
   * @param {boolean} isScript
   * @param {boolean} [allowCollapse=false]
   * @returns {string}
   */
  renderPreview(prompt, isScript, allowCollapse = false) {
    if (!prompt.trim()) {
      return '<span style="color: var(--shadow-claw-text-tertiary); font-style: italic;">No content</span>';
    }

    const lines = prompt.split("\n");
    const isLong = prompt.length > 120 || lines.length > 1;

    const rendered = isScript
      ? renderMarkdown("```javascript\n" + prompt + "\n```")
      : renderMarkdown(prompt);

    if (allowCollapse && isLong) {
      const summaryText = prompt.trim();

      return `
        <details class="task-content-details">
          <summary class="task-content-summary">
            <span class="summary-text">${this.escapeHtml(summaryText)}</span>
            <span class="summary-label">(View more)</span>
          </summary>
          <div class="task-prompt">${rendered}</div>
        </details>
      `;
    }

    return `<div class="task-prompt">${rendered}</div>`;
  }

  /**
   * @param {HTMLElement|null} label
   *
   * @param {boolean} [on=false]
   */
  handleScriptLabel(label, on = false) {
    if (!label) {
      return;
    }

    const root = this.shadowRoot;
    const textarea = root?.querySelector("textarea[name='prompt']");

    if (on) {
      label.textContent = "JavaScript Code";
      textarea?.classList.add("is-script");
    } else {
      label.textContent = "Task Prompt";
      textarea?.classList.remove("is-script");
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

customElements.define("shadow-claw-tasks", ShadowClawTasks);
