import { getDb } from "../db/db.mjs";
import { saveTask } from "../db/saveTask.mjs";
import { effect } from "../effect.mjs";
import { renderMarkdown } from "../markdown.mjs";
import { orchestratorStore } from "../stores/orchestrator.mjs";
import { showError, showInfo, showSuccess } from "../toast.mjs";

import "./shadow-claw-page-header.mjs";

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
        /* Utility classes refactored from inline styles */
        .hidden, [hidden] {
          display: none !important;
        }

        :host {
          display: flex;
          flex-direction: column;
          font-family: var(--shadow-claw-font-sans, system-ui, sans-serif);
          height: 100%;
          overflow: hidden;
        }

        .tasks__header-btn {
          background-color: var(--shadow-claw-bg-tertiary);
          border-radius: var(--shadow-claw-radius-m);
          border: 0.0625rem solid var(--shadow-claw-border-color);
          color: var(--shadow-claw-text-secondary);
          cursor: pointer;
          font-size: 0.75rem;
          padding: 0.5rem 0.75rem;
          white-space: nowrap;
        }

        .tasks__add-btn {
          background-color: var(--shadow-claw-accent-primary);
          border-color: var(--shadow-claw-accent-primary);
          color: var(--shadow-claw-on-primary);
          font-weight: 600;
        }

        .tasks__clear-btn {
          border-color: var(--shadow-claw-error-color, #ef4444);
          color: var(--shadow-claw-error-color, #ef4444);
        }

        .tasks__content {
          flex: 1;
          overflow-y: auto;
          padding: 0.75rem;
        }

        .tasks__terminal-slot {
          margin-bottom: 0.75rem;
        }

        .tasks__terminal-slot:empty {
          display: none;
          margin-bottom: 0;
        }

        @media (min-width: 650px) {
          .tasks__content {
            padding: 1rem;
          }

          .tasks__terminal-slot {
            margin-bottom: 1rem;
          }
        }

        .tasks__list {
          display: flex;
          flex-direction: column;
          gap: 0.625rem;
        }

        @media (min-width: 650px) {
          .tasks__list {
            gap: 0.75rem;
          }
        }

        .tasks__item {
          background-color: var(--shadow-claw-bg-secondary, #f9fafb);
          border-radius: 0.5rem;
          border: 0.0625rem solid var(--shadow-claw-border-color, #e5e7eb);
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 0.625rem;
        }

        .tasks__item-header {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .tasks__item-info {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
          width: 100%;
        }

        .tasks__schedule {
          color: var(--shadow-claw-accent-primary, #3b82f6);
          font-size: 0.6875rem;
          font-weight: 600;
          text-transform: uppercase;
        }

        @media (min-width: 650px) {
          .tasks__schedule {
            font-size: 0.75rem;
          }
        }

        .tasks__prompt {
          color: var(--shadow-claw-text-primary, #111827);
          font-size: 0.875rem;
          word-break: break-word;
        }

        .tasks__prompt p {
          margin-bottom: 0.5rem;
        }

        .tasks__prompt p:last-child {
          margin-bottom: 0;
        }

        .tasks__prompt pre {
          background-color: var(--shadow-claw-bg-tertiary);
          border-radius: 0.375rem;
          margin: 0.75rem 0;
          overflow-x: auto;
          padding: 0.5rem;
        }

        .tasks__prompt pre code.hljs {
          background-color: transparent;
          border-radius: 0.375rem;
          color: var(--shadow-claw-text-primary);
          display: block;
          font-family: var(--shadow-claw-font-mono);
          font-size: 0.8125rem;
          padding: 0;
        }

        .tasks__prompt code {
          background-color: var(--shadow-claw-bg-tertiary);
          border-radius: 0.1875rem;
          color: var(--shadow-claw-text-primary);
          font-family: var(--shadow-claw-font-mono);
          font-size: 0.8125rem;
          padding: 0.125rem 0.375rem;
        }

        .tasks__prompt code.hljs {
          background: transparent;
          color: var(--shadow-claw-text-primary);
          padding: 0;
        }

        .tasks__prompt a,
        .tasks__prompt a:visited {
          color: var(--shadow-claw-link, #1e40af) !important;
          text-decoration: underline;
          text-underline-offset: 0.125rem;
        }

        .tasks__prompt a:hover {
          color: var(--shadow-claw-link-hover, #1e3a8a) !important;
        }

        .tasks__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          max-width: 100%;
          width: 100%;
        }

        .tasks__toggle {
          align-items: center;
          color: var(--shadow-claw-text-secondary, #6b7280);
          cursor: pointer;
          display: flex;
          flex-basis: 100%;
          font-size: 0.8125rem;
          gap: 0.5rem;
          order: -1;
          user-select: none;
        }

        .tasks__toggle input[type="checkbox"] {
          accent-color: var(--shadow-claw-accent-primary);
          cursor: pointer;
          flex-shrink: 0;
          height: 1rem;
          width: 1rem;
        }

        .tasks__delete-btn,
        .tasks__edit-btn {
          background: transparent;
          border-radius: var(--shadow-claw-radius-m);
          border: 0.0625rem solid;
          cursor: pointer;
          flex: 1 1 calc(50% - 0.25rem);
          font-size: 0.6875rem;
          min-width: 0;
          overflow: hidden;
          padding: 0.5rem 0.625rem;
          text-overflow: ellipsis;
          transition: all 0.15s;
          white-space: nowrap;
        }

        /* Accordion styles */
        .tasks__content-details {
          width: 100%;
        }

        .tasks__content-summary {
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

        .tasks__content-summary::-webkit-details-marker {
          display: none;
        }

        .tasks__content-summary:hover {
          color: var(--shadow-claw-accent-primary);
        }

        .tasks__content-summary::before {
          content: '▶';
          display: inline-block;
          font-size: 0.625rem;
          transition: transform 0.2s ease;
        }

        .tasks__content-details[open] .tasks__content-summary::before {
          transform: rotate(90deg);
        }

        .tasks__content-summary .tasks__summary-label {
          flex-shrink: 0;
          text-decoration: underline;
          text-underline-offset: 0.125rem;
        }

        .tasks__content-summary .tasks__summary-text {
          display: -webkit-box;
          line-height: 1.35;
          overflow: hidden;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .tasks__delete-btn {
          border-color: var(--shadow-claw-error-color, #ef4444);
          color: var(--shadow-claw-error-color, #ef4444);
        }

        .tasks__delete-btn:hover,
        .tasks__delete-btn:focus-visible {
          background-color: var(--shadow-claw-error-color, #ef4444);
          color: white;
        }

        .tasks__edit-btn {
          border-color: var(--shadow-claw-accent-primary);
          color: var(--shadow-claw-accent-primary);
        }

        .tasks__edit-btn:hover,
        .tasks__edit-btn:focus-visible {
          background-color: var(--shadow-claw-accent-primary);
          color: var(--shadow-claw-on-primary);
        }

        .tasks__run-btn {
          background: transparent;
          border-radius: var(--shadow-claw-radius-m);
          border: 0.0625rem solid var(--shadow-claw-success-color, #10b981);
          color: var(--shadow-claw-success-color, #10b981);
          cursor: pointer;
          flex: 1 1 100%;
          font-size: 0.6875rem;
          font-weight: 600;
          min-width: 0;
          overflow: hidden;
          padding: 0.5rem 0.625rem;
          text-overflow: ellipsis;
          transition: all 0.15s;
          white-space: nowrap;
        }

        .tasks__run-btn:hover,
        .tasks__run-btn:focus-visible {
          background-color: var(--shadow-claw-success-color);
          border-color: var(--shadow-claw-success-color);
          color: var(--shadow-claw-on-primary, white);
        }

        /* Tablet and up: horizontal layout */
        @media (min-width: 650px) {
          .tasks__item {
            padding: 0.75rem;
          }

          .tasks__item-header {
            flex-direction: row;
            align-items: flex-start;
            gap: 1rem;
          }

          .tasks__item-info {
            flex: 1;
            min-width: 0;
          }

          .tasks__actions {
            flex-shrink: 0;
            max-width: 12.5rem;
            min-width: 10rem;
            width: auto;
          }

          .tasks__run-btn {
            flex: 1 1 auto;
          }

          .tasks__delete-btn,
          .tasks__edit-btn {
            flex: 1 1 auto;
            min-width: 4.375rem;
          }
        }

        .tasks__empty {
          align-items: center;
          color: var(--shadow-claw-text-tertiary, #9ca3af);
          display: flex;
          flex-direction: column;
          height: 100%;
          justify-content: center;
          text-align: center;
        }

        .tasks__empty p {
          font-size: 0.875rem;
          margin-top: 0.5rem;
        }

        .tasks__last-run {
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
          max-width: calc(100vw - 2rem);
          padding: 0;
          width: 100%;
        }

        @media (min-width: 650px) {
          dialog {
            max-width: 31.25rem;
            width: 90%;
          }
        }

        dialog::backdrop {
          background-color: rgba(0, 0, 0, 0.5);
        }

        .tasks__dialog-header {
          align-items: center;
          border-bottom: 0.0625rem solid var(--shadow-claw-border-color, #e5e7eb);
          display: flex;
          justify-content: space-between;
          padding: 1rem;
        }

        .tasks__dialog-title {
          font-size: 1rem;
          font-weight: 600;
          margin: 0;
        }

        .tasks__dialog-close {
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

        .tasks__dialog-close:hover,
        .tasks__dialog-close:focus-visible {
          color: var(--shadow-claw-text-primary, #111827);
        }

        .tasks__dialog-body {
          padding: 1rem;
        }

        #isScriptCheckbox {
          accent-color: var(--shadow-claw-accent-primary);
          cursor: pointer;
          height: 1rem;
          width: 1rem;
        }

        .tasks__form-group {
          margin-bottom: 1rem;
        }

        .tasks__form-group:last-of-type {
          margin-bottom: 0;
        }

        .tasks__form-label {
          color: var(--shadow-claw-text-primary, #111827);
          display: block;
          font-size: 0.75rem;
          font-weight: 600;
          margin-bottom: 0.375rem;
          text-transform: uppercase;
        }

        .tasks__form-input,
        .tasks__form-textarea {
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

        .tasks__form-input:focus,
        .tasks__form-textarea:focus {
          outline: none;
          border-color: var(--shadow-claw-accent-primary, #3b82f6);
          background-color: var(--shadow-claw-bg-primary, #ffffff);
        }

        .tasks__form-textarea {
          resize: vertical;
          min-height: 6.25rem;
        }

        .tasks__form-textarea--script {
          font-family: var(--shadow-claw-font-mono, monospace);
          white-space: pre;
        }

        .tasks__form-hint {
          font-size: 0.6875rem;
          color: var(--shadow-claw-text-tertiary, #9ca3af);
          margin-top: 0.25rem;
        }

        .tasks__dialog-footer {
          padding: 1rem;
          border-top: 0.0625rem solid var(--shadow-claw-border-color, #e5e7eb);
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
        }

        .tasks__btn-cancel,
        .tasks__btn-save {
          padding: 0.5rem 1rem;
          font-size: 0.75rem;
          border-radius: var(--shadow-claw-radius-m);
          border: 0.0625rem solid;
          cursor: pointer;
          transition: all 0.15s;
          font-weight: 600;
        }

        .tasks__btn-cancel {
          background-color: var(--shadow-claw-bg-secondary, #f9fafb);
          border-color: var(--shadow-claw-border-color, #e5e7eb);
          color: var(--shadow-claw-text-primary, #111827);
        }

        .tasks__btn-cancel:hover,
        .tasks__btn-cancel:focus-visible {
          background-color: var(--shadow-claw-bg-tertiary, #f3f4f6);
        }

        .tasks__btn-save {
          background-color: var(--shadow-claw-accent-primary, #3b82f6);
          border-color: var(--shadow-claw-accent-primary, #3b82f6);
          color: var(--shadow-claw-on-primary, white);
        }

        .tasks__btn-save:hover,
        .tasks__btn-save:focus-visible {
          background-color: var(--shadow-claw-accent-hover, #2563eb);
          border-color: var(--shadow-claw-accent-hover, #2563eb);
        }

        .tasks__btn-save:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .tasks__hidden-restore {
          display: none;
        }

        .tasks__form-group-row {
          align-items: center;
          display: flex;
          gap: 0.5rem;
        }

        .tasks__form-label-inline {
          cursor: pointer;
          margin-bottom: 0;
        }

        .tasks__empty-hint {
          font-size: 0.75rem;
        }

        .tasks__schedule-row {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 0.375rem;
        }

        .tasks__script-badge {
          background: var(--shadow-claw-accent-primary);
          border-radius: 0.25rem;
          color: var(--shadow-claw-on-primary);
          font-size: 0.5625rem;
          font-weight: bold;
          padding: 0.0625rem 0.25rem;
        }

        @media (min-width: 650px) {
          .tasks__script-badge {
            font-size: 0.625rem;
          }
        }

        .tasks__preview-container {
          margin-top: 1rem;
        }

        .tasks__preview {
          background-color: var(--shadow-claw-bg-secondary);
          border-radius: var(--shadow-claw-radius-s);
          border: 0.0625rem solid var(--shadow-claw-border-color);
          margin-top: 0.375rem;
          min-height: 3rem;
          padding: 0.75rem;
        }

        .tasks__preview-empty {
          color: var(--shadow-claw-text-tertiary, #9ca3af);
          font-style: italic;
        }
      </style>
      <section class="tasks" aria-label="Tasks">
      <shadow-claw-page-header icon="✓" title="Tasks">
        <button slot="actions" type="button" class="tasks__add-btn tasks__header-btn">+ Add Task</button>
        <button slot="actions" type="button" class="tasks__backup-btn tasks__header-btn">💾 Backup</button>
        <button slot="actions" type="button" class="tasks__restore-btn tasks__header-btn">♻️ Restore</button>
        <button slot="actions" type="button" class="tasks__clear-btn tasks__header-btn">🗑️ Clear All</button>
      </shadow-claw-page-header>
      <input type="file" class="tasks__hidden-restore" accept=".json,application/json" aria-label="Restore tasks from JSON backup">
      <div class="tasks__content">
        <div class="tasks__terminal-slot" data-terminal-slot hidden></div>
        <div class="tasks__list" role="list" aria-live="polite"></div>
      </div>
      <!-- Add/Edit Task Dialog -->
      <dialog class="tasks__dialog" aria-labelledby="tasksDialogTitle">
        <div class="tasks__dialog-header">
          <h3 class="tasks__dialog-title" id="tasksDialogTitle">Add Task</h3>
          <button type="button" class="tasks__dialog-close" aria-label="Close task dialog">✕</button>
        </div>
        <form class="tasks__dialog-form">
          <div class="tasks__dialog-body">
            <div class="tasks__form-group">
              <label class="tasks__form-label" for="tasksScheduleInput">Schedule (Cron Expression)</label>
              <input type="text" class="tasks__form-input" id="tasksScheduleInput" name="schedule" placeholder="e.g., 0 9 * * * (daily at 9 AM)" required aria-describedby="tasksScheduleHint">
              <div class="tasks__form-hint" id="tasksScheduleHint">Standard cron format (sec min hour day month weekday)</div>
            </div>
            <div class="tasks__form-group">
              <label class="tasks__form-label" id="taskLabel" for="tasksPromptInput">Task Prompt</label>
              <textarea class="tasks__form-textarea" id="tasksPromptInput" name="prompt" placeholder="Enter the task prompt..." required></textarea>
            </div>
            <div class="tasks__form-group tasks__form-group-row">
              <input type="checkbox" name="isScript" id="isScriptCheckbox">
              <label for="isScriptCheckbox" class="tasks__form-label tasks__form-label-inline">Is JavaScript</label>
            </div>
            <div class="tasks__form-group tasks__preview-container">
              <label class="tasks__form-label">Preview</label>
              <div class="tasks__preview tasks__prompt" id="tasksPreview"></div>
            </div>
          </div>
          <div class="tasks__dialog-footer">
            <button type="button" class="tasks__btn-cancel">Cancel</button>
            <button type="submit" class="tasks__btn-save tasks__dialog-submit">Add Task</button>
          </div>
        </form>
      </dialog>
      </section>
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
    this.dispatchTerminalSlotReady();

    // Re-render when tasks change
    this.cleanup = effect(() => {
      orchestratorStore.tasks;
      this.updateTaskList(db);
    });

    const root = this.shadowRoot;
    if (!root) return;

    // Backup button
    const backupBtn = root.querySelector(".tasks__backup-btn");
    backupBtn?.addEventListener("click", () => this.handleBackup());

    // Restore button
    const restoreBtn = root.querySelector(".tasks__restore-btn");
    const restoreInput = root.querySelector(".tasks__hidden-restore");
    restoreBtn?.addEventListener("click", () => {
      if (restoreInput instanceof HTMLInputElement) restoreInput.click();
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
    const form = /** @type {HTMLFormElement | null} */ (
      root.querySelector(".tasks__dialog-form")
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
    const previewDiv = root.querySelector(".tasks__preview");

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

  dispatchTerminalSlotReady() {
    this.dispatchEvent(
      new CustomEvent("shadow-claw-terminal-slot-ready", {
        bubbles: true,
        composed: true,
      }),
    );
  }

  /**
   * @param {ShadowClawDatabase} db
   */
  updateTaskList(db) {
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
        <div class="tasks__empty" role="status">
          <p>No scheduled tasks for this group.</p>
          <p class="tasks__empty-hint">Ask the agent to create one using "create_task".</p>
        </div>
      `;

      return;
    }

    list.innerHTML = "";
    tasks.forEach((/** @type {Task} */ task) => {
      const item = document.createElement("div");
      item.className = "tasks__item";
      item.setAttribute("role", "listitem");

      const lastRunStr = task.lastRun
        ? new Date(task.lastRun).toLocaleString()
        : "Never";

      item.innerHTML = `
        <div class="tasks__item-header">
          <div class="tasks__item-info">
            <div class="tasks__schedule-row">
              <div class="tasks__schedule">⏰ ${task.schedule}</div>
              ${task.isScript ? '<span class="tasks__script-badge">JS SCRIPT</span>' : ""}
            </div>
            <div class="tasks__prompt-container">
              ${this.renderPreview(task.prompt, !!task.isScript, true)}
            </div>
            <div class="tasks__last-run">Last run: ${lastRunStr}</div>
          </div>
          <div class="tasks__actions">
            <label class="tasks__toggle">
              <input type="checkbox" ${task.enabled ? "checked" : ""} data-id="${task.id}" class="tasks__toggle-input" aria-label="${task.enabled ? "Disable" : "Enable"} task scheduled ${this.escapeHtml(task.schedule)}">
              ${task.enabled ? "Enabled" : "Disabled"}
            </label>
            <button type="button" class="tasks__run-btn" data-id="${task.id}" aria-label="Run task scheduled ${this.escapeHtml(task.schedule)}">Run</button>
            <button type="button" class="tasks__edit-btn" data-id="${task.id}" aria-label="Edit task scheduled ${this.escapeHtml(task.schedule)}">✎ Edit</button>
            <button type="button" class="tasks__delete-btn" data-id="${task.id}" aria-label="Delete task scheduled ${this.escapeHtml(task.schedule)}">Delete</button>
          </div>
        </div>
      `;

      // Bind events
      const toggle = /** @type {HTMLInputElement | null} */ (
        item.querySelector(".tasks__toggle-input")
      );

      toggle?.addEventListener("change", (e) => {
        const target = /** @type {HTMLInputElement} */ (e.target);
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

      await saveTask(db, taskToSave);
      await orchestratorStore.loadTasks(db);

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
   *
   * @param {string} prompt
   * @param {boolean} isScript
   * @param {boolean} [allowCollapse=false]
   * @returns {string}
   */
  renderPreview(prompt, isScript, allowCollapse = false) {
    if (!prompt.trim()) {
      return '<span class="tasks__preview-empty">No content</span>';
    }

    const lines = prompt.split("\n");
    const isLong = prompt.length > 120 || lines.length > 1;

    const rendered = isScript
      ? renderMarkdown("```javascript\n" + prompt + "\n```")
      : renderMarkdown(prompt);

    if (allowCollapse && isLong) {
      const summaryText = prompt.trim();

      return `
        <details class="tasks__content-details">
          <summary class="tasks__content-summary">
            <span class="tasks__summary-text">${this.escapeHtml(summaryText)}</span>
            <span class="tasks__summary-label">(View more)</span>
          </summary>
          <div class="tasks__prompt">${rendered}</div>
        </details>
      `;
    }

    return `<div class="tasks__prompt">${rendered}</div>`;
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
      textarea?.classList.add("tasks__form-textarea--script");
    } else {
      label.textContent = "Task Prompt";
      textarea?.classList.remove("tasks__form-textarea--script");
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
      const btn = this.shadowRoot?.querySelector(".tasks__backup-btn");
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
      showError(`Failed to create backup: ${message}`);
      console.error("Backup error:", err);
    } finally {
      const btn = this.shadowRoot?.querySelector(".tasks__backup-btn");
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
      if (btn instanceof HTMLButtonElement) btn.disabled = true;
      if (btn) btn.textContent = "⏳";

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
      const btn = this.shadowRoot?.querySelector(".tasks__clear-btn");
      if (btn instanceof HTMLButtonElement) btn.disabled = true;
      if (btn) btn.textContent = "⏳";
      await orchestratorStore.clearAllTasks(db);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Failed to clear tasks: ${message}`);
      console.error("Clear error:", err);
    } finally {
      const btn = this.shadowRoot?.querySelector(".tasks__clear-btn");
      if (btn instanceof HTMLButtonElement) btn.disabled = false;
      if (btn) btn.textContent = "🗑️ Clear All";
    }
  }
}

customElements.define("shadow-claw-tasks", ShadowClawTasks);
