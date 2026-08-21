import{r as e}from"./config-64zJ5TLN.js";import{n as t}from"./txPromise-EBECky1b.js";import{t as n}from"./getConfig-D89uJgo5.js";import{d as r,h as i}from"./custom-element-security-MwgLnC6q.js";import{t as a}from"./orchestrator-DrMg2dnI.js";import{n as o,r as s,t as c}from"./toast-D3gxhZpN.js";import{t as l}from"./shadow-claw-element-na_3JW5e.js";import"./shadow-claw-empty-state-CbZ2vrOx.js";import{t as u}from"./effect-BEsuusE8.js";import"./shadow-claw-page-header-action-button-Cn1xDjfA.js";import"./shadow-claw-page-header-DyG_qg9T.js";import{t as d}from"./markdown-DXtaNEac.js";import{t as f}from"./file-viewer-C3DgeHSd.js";import{t as p}from"./config-value-oBfKgLT4.js";import"./shadow-claw-dialog-n4xdcUp-.js";const m=new CSSStyleSheet;m.replaceSync(`*,
*::before,
*::after {
  font-family: var(--shadow-claw-font-sans);
  scrollbar-color: var(--shadow-claw-border-color) transparent;
  scrollbar-width: thin;
}

::-webkit-scrollbar {
  height: 0.5rem;
  width: 0.5rem;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--shadow-claw-border-color);
  border-radius: 0.25rem;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--shadow-claw-text-tertiary);
}

.hidden,
[hidden] {
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

.tasks {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  width: 100%;
}

.tasks__content {
  flex: 1;
  min-height: 0;
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

@media (min-width: 40.625rem) {
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

@media (min-width: 40.625rem) {
  .tasks__list {
    gap: 0.75rem;
  }
}

.tasks__item {
  background-color: var(--shadow-claw-bg-secondary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-m, 1rem);
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
  min-width: 0;
  width: 100%;
}

.tasks__item-info:not(:has(.tasks__name)) {
  padding-top: 0.25rem;
}

.tasks__schedule {
  color: var(--shadow-claw-accent-primary);
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
}

@media (min-width: 40.625rem) {
  .tasks__schedule {
    font-size: 0.75rem;
  }
}

.tasks__prompt {
  color: var(--shadow-claw-text-primary);
  font-size: var(--shadow-claw-font-size-sm);
  margin: 0.875rem 0;
  word-break: break-word;
}

.tasks__prompt p:first-child {
  margin-top: 0;
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
  max-width: 100%;
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
  padding: 0;
}

.tasks__prompt code.hljs {
  background: transparent;
  color: var(--shadow-claw-text-primary);
  padding: 0;
}

.tasks__prompt a,
.tasks__prompt a:visited {
  color: var(--shadow-claw-link, #5e79d9) !important;
  text-decoration: underline;
  text-underline-offset: 0.125rem;
}

.tasks__prompt a:hover {
  color: var(--shadow-claw-link-hover, #4156a1) !important;
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
  color: var(--shadow-claw-text-secondary);
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
.tasks__edit-btn,
.tasks__copy-id-btn {
  background: transparent;
  border: 0.0625rem solid;
  border-radius: var(--shadow-claw-radius-m);
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
  content: "▶";
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
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  display: -webkit-box;
  line-height: 1.35;
  overflow: hidden;
  white-space: pre-wrap;
  word-break: break-word;
}

.tasks__tool-remove-btn:hover {
  background-color: var(--shadow-claw-error-color-alpha);
  color: var(--shadow-claw-error-color);
}

.tasks__tool-suppress {
  align-items: center;
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  display: flex;
  font-size: 0.75rem;
  gap: 0.375rem;
}

.tasks__delete-btn {
  border-color: var(--shadow-claw-error-color);
  color: var(--shadow-claw-error-color);
}

.tasks__delete-btn:hover,
.tasks__delete-btn:focus-visible {
  background-color: var(--shadow-claw-error-color);
  color: var(--shadow-claw-on-error);
}

.tasks__edit-btn,
.tasks__copy-id-btn {
  border-color: var(--shadow-claw-border-color);
  color: var(--shadow-claw-text-secondary);
}

.tasks__edit-btn:hover,
.tasks__edit-btn:focus-visible,
.tasks__copy-id-btn:hover,
.tasks__copy-id-btn:focus-visible {
  border-color: var(--shadow-claw-text-primary);
  box-shadow: var(--shadow-claw-shadow-md);
  color: var(--shadow-claw-text-primary);
}

.tasks__run-btn {
  background: transparent;
  border: 0.0625rem solid var(--shadow-claw-success-color, #0a9142);
  border-radius: var(--shadow-claw-radius-m);
  color: var(--shadow-claw-success-color, #0a9142);
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
@media (min-width: 40.625rem) {
  .tasks__item {
    padding: 0.75rem;
  }

  .tasks__item-header {
    align-items: flex-start;
    flex-direction: row;
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
  .tasks__edit-btn,
  .tasks__copy-id-btn {
    flex: 1 1 auto;
    min-width: 4.375rem;
  }
}

.tasks__empty {
  align-items: center;
  color: var(--shadow-claw-text-tertiary);
  display: flex;
  flex-direction: column;
  height: 100%;
  justify-content: center;
  text-align: center;
}

.tasks__last-run {
  color: var(--shadow-claw-text-tertiary);
  font-size: 0.6875rem;
  margin-top: 0.25rem;
}

/* Dialog styles */
dialog {
  background-color: var(--shadow-claw-bg-primary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-l);
  box-shadow: var(--shadow-claw-shadow-lg);
  color: var(--shadow-claw-text-primary);
  max-width: calc(100vw - 2rem);
  padding: 0;
  width: 100%;
}

@media (min-width: 40.625rem) {
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
  border-bottom: 0.0625rem solid var(--shadow-claw-border-color);
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
  color: var(--shadow-claw-text-secondary);
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
  color: var(--shadow-claw-text-primary);
}

.tasks__dialog-body {
  padding: 1rem;
}

.tasks__form-group {
  margin-bottom: 1rem;
}

.tasks__form-group:last-of-type {
  margin-bottom: 0;
}

.tasks__form-label {
  color: var(--shadow-claw-text-primary);
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  margin-bottom: 0.375rem;
  text-transform: uppercase;
}

.tasks__form-input,
.tasks__form-textarea {
  background-color: var(--shadow-claw-bg-secondary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-s);
  box-sizing: border-box;
  color: var(--shadow-claw-text-primary);
  font-family: inherit;
  font-size: var(--shadow-claw-font-size-sm);
  padding: 0.5rem;
  transition: border-color 0.15s;
  width: 100%;
}

.tasks__form-input:focus,
.tasks__form-textarea:focus {
  background-color: var(--shadow-claw-bg-primary);
  border-color: var(--shadow-claw-accent-primary);
  outline: none;
}

.tasks__form-textarea {
  min-height: 6.25rem;
  resize: vertical;
}

.tasks__form-hint {
  color: var(--shadow-claw-text-tertiary);
  font-size: 0.6875rem;
  margin-top: 0.25rem;
}

.tasks__dialog-footer {
  border-top: 0.0625rem solid var(--shadow-claw-border-color);
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  padding: 1rem;
}

.tasks__btn-cancel,
.tasks__btn-save {
  border: 0.0625rem solid;
  border-radius: var(--shadow-claw-radius-pill);
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.5rem 1rem;
  transition: all 0.15s;
}

.tasks__btn-cancel {
  background-color: transparent;
  border-color: var(--shadow-claw-border-color);
  color: var(--shadow-claw-text-primary);
}

.tasks__btn-cancel:hover,
.tasks__btn-cancel:focus-visible {
  border-color: var(--shadow-claw-text-primary);
  box-shadow: var(--shadow-claw-shadow-md);
}

.tasks__btn-save {
  background-color: var(--shadow-claw-text-primary);
  border-color: var(--shadow-claw-text-primary);
  color: var(--shadow-claw-bg-primary);
}

.tasks__btn-save:hover,
.tasks__btn-save:focus-visible {
  background-color: var(--shadow-claw-accent-primary);
  border-color: var(--shadow-claw-accent-primary);
  color: var(--shadow-claw-on-primary);
}

.tasks__btn-save:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.tasks__hidden-restore {
  display: none;
}

.tasks__schedule-row {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

@media (min-width: 40.625rem) {
  .tasks__script-badge {
    font-size: 0.625rem;
  }
}

.tasks__preview-container {
  margin-top: 1rem;
}

.tasks__preview {
  background-color: var(--shadow-claw-bg-secondary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-s);
  margin-top: 0.375rem;
  min-height: 3rem;
  padding: 0.75rem;
}

.tasks__preview-empty {
  color: var(--shadow-claw-text-tertiary, #9ca3af);
  font-style: italic;
}

.tasks__type-options {
  display: flex;
  gap: 1rem;
  margin-top: 0.25rem;
}

.tasks__type-options label {
  align-items: center;
  color: var(--shadow-claw-text-primary);
  cursor: pointer;
  display: flex;
  font-size: var(--shadow-claw-font-size-sm);
  gap: 0.375rem;
}

.tasks__tools-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.tasks__tool-item {
  background-color: var(--shadow-claw-bg-secondary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-s);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
}

.tasks__tool-header {
  align-items: center;
  display: flex;
  justify-content: space-between;
}

.tasks__tool-title {
  color: var(--shadow-claw-text-secondary);
  font-size: 0.75rem;
  font-weight: 600;
}

.tasks__tool-remove-btn {
  background: transparent;
  border: none;
  color: var(--shadow-claw-error-color);
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0.25rem;
}

.tasks__tool-remove-btn:hover {
  text-decoration: underline;
}

.tasks__add-tool-btn {
  background: transparent;
  border: 0.0625rem dashed var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-s);
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0.5rem;
  text-align: center;
  transition: all 0.15s;
  width: 100%;
}

.tasks__add-tool-btn:hover {
  border-color: var(--shadow-claw-text-primary);
  color: var(--shadow-claw-text-primary);
}

.tasks__tool-suppress {
  align-items: center;
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  display: flex;
  font-size: 0.75rem;
  gap: 0.375rem;
}

.tasks__checkbox-option {
  margin-top: 0.5rem;
}

.tasks__checkbox-option label {
  align-items: center;
  color: var(--shadow-claw-text-primary);
  cursor: pointer;
  display: flex;
  font-size: var(--shadow-claw-font-size-sm);
  gap: 0.375rem;
}

.tasks__checkbox-option input[type="checkbox"] {
  accent-color: var(--shadow-claw-accent-primary);
  cursor: pointer;
  flex-shrink: 0;
  height: 1rem;
  width: 1rem;
}

.tasks__drag-handle {
  align-items: center;
  cursor: grab;
  display: inline-flex;
  flex-shrink: 0;
  font-size: 0.75rem;
  justify-content: center;
  margin-right: 0.25rem;
  opacity: 0.4;
  padding: 0.25rem 0.5rem;
  touch-action: none;
  user-select: none;
}

.tasks__drag-handle:active {
  cursor: grabbing;
}

.tasks__item:hover .tasks__drag-handle {
  opacity: 0.8;
}

.tasks__item.dragging {
  opacity: 0.4;
}

.tasks__item.drag-over {
  border-top: 2px solid var(--shadow-claw-accent-primary);
}

.tasks__item:focus-visible {
  outline: 2px dashed var(--shadow-claw-accent-primary);
  outline-offset: -0.125rem;
}

.tasks__item.keyboard-grabbed {
  background: var(--shadow-claw-bg-tertiary);
  outline: 2px dashed var(--shadow-claw-accent-primary);
  outline-offset: -0.125rem;
}

.sr-only {
  border: 0;
  clip: rect(0, 0, 0, 0);
  height: 0.0625rem;
  margin: -0.0625rem;
  overflow: hidden;
  padding: 0;
  position: absolute;
  white-space: nowrap;
  width: 0.0625rem;
}
`);const h=new DOMParser().parseFromString(`<template>
  <section aria-label="Tasks" class="tasks">
    <shadow-claw-page-header icon="✓" title="Tasks">
      <shadow-claw-page-header-action-button
        class="tasks__add-btn"
        slot="actions"
        title="Add a new scheduled task"
        variant="primary"
      >
        + Add Task
      </shadow-claw-page-header-action-button>
      <shadow-claw-page-header-action-button
        class="tasks__backup-btn"
        slot="actions"
        title="Backup tasks to file"
      >
        💾 Backup
      </shadow-claw-page-header-action-button>
      <shadow-claw-page-header-action-button
        class="tasks__restore-btn"
        slot="actions"
        title="Restore tasks from backup"
      >
        ♻️ Restore
      </shadow-claw-page-header-action-button>
      <shadow-claw-page-header-action-button
        class="tasks__clear-btn"
        slot="actions"
        title="Delete all tasks"
        variant="danger"
      >
        🗑️ Clear All
      </shadow-claw-page-header-action-button>
    </shadow-claw-page-header>
    <input
      accept=".json,application/json"
      aria-label="Restore tasks from JSON backup"
      class="tasks__hidden-restore"
      type="file"
    />
    <div class="tasks__content">
      <div class="tasks__terminal-slot" data-terminal-slot hidden></div>
      <div aria-live="polite" class="tasks__list" role="list"></div>
    </div>
    <shadow-claw-dialog
      dialog-aria-labelledby="tasksDialogTitle"
      dialog-class="tasks__dialog"
    >
      <div class="tasks__dialog-header">
        <h3 class="tasks__dialog-title" id="tasksDialogTitle">Add Task</h3>
        <button
          aria-label="Close task dialog"
          class="tasks__dialog-close"
          type="button"
        >
          ✕
        </button>
      </div>
      <form class="tasks__dialog-form">
        <div class="tasks__dialog-body">
          <div class="tasks__form-group">
            <label class="tasks__form-label" for="tasksNameInput">
              Task Name
            </label>
            <input
              class="tasks__form-input"
              id="tasksNameInput"
              name="name"
              placeholder="e.g., Daily Report Backup"
              type="text"
            />
          </div>
          <div class="tasks__form-group">
            <label class="tasks__form-label" for="tasksScheduleInput">
              Schedule (Cron Expression)
            </label>
            <input
              aria-describedby="tasksScheduleHint"
              class="tasks__form-input"
              id="tasksScheduleInput"
              name="schedule"
              placeholder="e.g., 0 9 * * * (daily at 9 AM)"
              type="text"
            />
            <div class="tasks__form-hint" id="tasksScheduleHint">
              Standard cron format. Leave empty for an unscheduled task.
            </div>
          </div>
          <div class="tasks__form-group">
            <label class="tasks__form-label">Task Type</label>
            <div class="tasks__type-options">
              <label>
                <input type="radio" name="taskType" value="prompt" checked />
                Prompt
              </label>
              <label>
                <input type="radio" name="taskType" value="tools" /> WebMCP
                Tools
              </label>
            </div>
          </div>

          <div class="tasks__form-group tasks__prompt-group">
            <label
              class="tasks__form-label"
              id="taskLabel"
              for="tasksPromptInput"
            >
              Task Prompt
            </label>
            <textarea
              class="tasks__form-textarea"
              id="tasksPromptInput"
              name="prompt"
              placeholder="Enter the task prompt..."
            ></textarea>
          </div>

          <div
            class="tasks__form-group tasks__tools-group"
            style="display: none"
          >
            <label class="tasks__form-label">WebMCP Tools List</label>
            <div class="tasks__tools-list"></div>
            <button type="button" class="tasks__add-tool-btn">
              + Add Tool
            </button>
          </div>

          <div class="tasks__form-group tasks__execution-options-group">
            <label class="tasks__form-label">Context & Execution Options</label>
            <div class="tasks__checkbox-option">
              <label>
                <input
                  type="checkbox"
                  name="freshContext"
                  id="tasksFreshContextInput"
                />
                Fresh Context (Bypass conversation history)
              </label>
            </div>
            <div class="tasks__checkbox-option">
              <label>
                <input
                  type="checkbox"
                  name="subagent"
                  id="tasksSubagentInput"
                />
                Run as Subagent (Isolated background execution, no UI output)
              </label>
            </div>
          </div>

          <div class="tasks__form-group tasks__preview-container">
            <label class="tasks__form-label">Preview</label>
            <div class="tasks__preview tasks__prompt" id="tasksPreview"></div>
          </div>
        </div>
        <div class="tasks__dialog-footer">
          <button class="tasks__btn-cancel" type="button">Cancel</button>
          <button class="tasks__btn-save tasks__dialog-submit" type="submit">
            Add Task
          </button>
        </div>
      </form>
    </shadow-claw-dialog>
    <div id="live-region" class="sr-only" aria-live="assertive"></div>
    <div id="reorder-instructions" class="sr-only">
      Press M to grab this task. Use Up and Down arrows to move, Space or Enter
      to drop, Escape to cancel.
    </div>
  </section>
</template>
`,`text/html`),g=h.querySelector(`template`);let _=[];_=g?Array.from(g.content.children):Array.from(h.head.children).concat(Array.from(h.body.children));var v=_;const y=`shadow-claw-tasks`;async function b(e,t){if(!e||typeof e.transaction!=`function`)return!0;try{return p(await n(e,t),!0)}catch{return!0}}var x=class extends l{static styles=m;static template=v;editingTask=null;editingTools=[];renderFrontmatter=!0;tasks=[];_draggedTaskId=null;_touchId=null;_touchDraggedTaskId=null;_keyboardGrabbedId=null;_autoScrollActive=!1;_autoScrollSpeed=0;constructor(){super()}async connectedCallback(){let n=this.shadowRoot;if(!n)throw Error(`shadowRoot not found`);n.addEventListener(`click`,e=>{e instanceof MouseEvent&&t().then(t=>this.handlePreviewLinkClick(e,t)).catch(console.error)}),n.querySelector(`.tasks__backup-btn`)?.addEventListener(`click`,()=>this.handleBackup());let i=n.querySelector(`.tasks__restore-btn`),o=n.querySelector(`.tasks__hidden-restore`);i?.addEventListener(`click`,()=>{o instanceof HTMLInputElement&&o.click()}),o?.addEventListener(`change`,e=>{if(e.target instanceof HTMLInputElement){let n=e.target;t().then(e=>this.handleRestore(e,n)).catch(console.error)}}),n.querySelector(`.tasks__clear-btn`)?.addEventListener(`click`,()=>{t().then(e=>this.handleClearAll(e)).catch(console.error)}),n.querySelector(`.tasks__add-btn`)?.addEventListener(`click`,()=>this.handleAdd());let s=n.querySelector(`dialog`),c=n.querySelector(`.tasks__dialog-close`),l=n.querySelector(`.tasks__btn-cancel`),d=n.querySelector(`.tasks__dialog-form`);c?.addEventListener(`click`,()=>{s?.close()}),l?.addEventListener(`click`,()=>{s?.close()}),d?.addEventListener(`submit`,e=>{e.preventDefault(),d&&t().then(e=>this.handleEditSubmit(e,d)).catch(console.error)}),s?.addEventListener(`click`,e=>{e.target===s&&s.close()});let f=n.querySelector(`textarea[name='prompt']`),p=n.querySelector(`.tasks__preview`),m=n.querySelectorAll(`input[name='taskType']`),h=n.querySelector(`.tasks__prompt-group`),g=n.querySelector(`.tasks__tools-group`),_=n.querySelector(`.tasks__add-tool-btn`),v=async()=>{p instanceof HTMLElement&&((Array.from(m).find(e=>e.checked)?.getAttribute(`value`)||`prompt`)===`tools`?r(p,this.renderToolsPreview(this.editingTools)):f instanceof HTMLTextAreaElement&&r(p,await this.renderPreview(f.value)))};f?.addEventListener(`input`,v),m.forEach(e=>{e.addEventListener(`change`,e=>{e.target.value===`tools`?(h?.setAttribute(`style`,`display: none;`),g?.removeAttribute(`style`),f?.removeAttribute(`required`)):(g?.setAttribute(`style`,`display: none;`),h?.removeAttribute(`style`)),v()})}),_?.addEventListener(`click`,()=>{this.editingTools.push({name:``,input:{}}),this.renderToolsEditor(),v()});let y=await t();this.renderFrontmatter=await b(y,e.MARKDOWN_FRONTMATTER_TASKS);try{let e=await(await fetch(`https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/atom-one-dark.min.css`)).text(),t=new CSSStyleSheet;t.replaceSync(e),this.shadowRoot?.adoptedStyleSheets&&this.shadowRoot.adoptedStyleSheets.push(t)}catch(e){console.warn(`Failed to load highlight.js styles:`,e)}n.addEventListener(`dragover`,e=>{this._draggedTaskId!==null&&this._updateAutoScrollSpeed(e.clientY)}),n.addEventListener(`dragend`,()=>{this._stopAutoScroll()}),n.addEventListener(`drop`,()=>{this._stopAutoScroll()}),this.render(),this.dispatchTerminalSlotReady(),this.cleanup=u(()=>{a.tasks,this.updateTaskList(y)})}disconnectedCallback(){this.cleanup()}cleanup=()=>{};dispatchTerminalSlotReady(){this.dispatchEvent(new CustomEvent(`shadow-claw-terminal-slot-ready`,{bubbles:!0,composed:!0}))}escapeHtml(e){let t=document.createElement(`div`);return t.textContent=e,t.innerHTML}handleAdd(){this.editingTask=null,this.editingTools=[];let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`dialog`),n=e.querySelector(`.tasks__dialog-form`),i=e.querySelector(`.tasks__dialog-title`),a=e.querySelector(`.tasks__dialog-submit`);if(!n||!(n instanceof HTMLFormElement))return;i&&(i.textContent=`Add Task`),a&&(a.textContent=`Add Task`),n.reset();let o=n.querySelector(`input[name='name']`);o instanceof HTMLInputElement&&(o.value=``);let s=n.querySelector(`input[name='taskType'][value='prompt']`);s&&(s.checked=!0,s.dispatchEvent(new Event(`change`))),this.renderToolsEditor();let c=e.querySelector(`.tasks__preview`);c instanceof HTMLElement&&this.renderPreview(``,!1).then(e=>{r(c,e)}),t?.showModal()}handleEdit(e){this.editingTask=e,this.editingTools=JSON.parse(JSON.stringify(e.tools||[]));let t=this.shadowRoot;if(!t)return;let n=t.querySelector(`dialog`),i=t.querySelector(`.tasks__dialog-form`),a=t.querySelector(`.tasks__dialog-title`),o=t.querySelector(`.tasks__dialog-submit`);if(!i||!(i instanceof HTMLFormElement))return;a&&(a.textContent=`Edit Task`),o&&(o.textContent=`Save Changes`);let s=i.querySelector(`input[name='name']`);s instanceof HTMLInputElement&&(s.value=e.name||``);let c=i.querySelector(`input[name='schedule']`),l=i.querySelector(`textarea[name='prompt']`);c instanceof HTMLInputElement&&(c.value=e.schedule||``),l instanceof HTMLTextAreaElement&&(l.value=e.prompt||``);let u=i.querySelector(`input[name='freshContext']`);u instanceof HTMLInputElement&&(u.checked=!!e.freshContext);let d=i.querySelector(`input[name='subagent']`);d instanceof HTMLInputElement&&(d.checked=!!e.subagent);let f=i.querySelector(`input[name='taskType'][value='${e.type||`prompt`}']`);f&&(f.checked=!0,f.dispatchEvent(new Event(`change`))),this.renderToolsEditor();let p=t.querySelector(`.tasks__preview`);p instanceof HTMLElement&&(e.type===`tools`?r(p,this.renderToolsPreview(this.editingTools)):this.renderPreview(e.prompt).then(e=>{r(p,e)})),n?.showModal()}handleRun(e){a.runTask(e,!0)}renderToolsEditor(){let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`.tasks__tools-list`);t&&(t.innerHTML=``,this.editingTools.forEach((n,i)=>{let a=document.createElement(`div`);a.className=`tasks__tool-item`;let o=document.createElement(`div`);o.className=`tasks__tool-header`;let s=document.createElement(`div`);s.className=`tasks__tool-title`,s.textContent=`Tool ${i+1}`;let c=document.createElement(`button`);c.type=`button`,c.className=`tasks__tool-remove-btn`,c.textContent=`Remove`,c.addEventListener(`click`,()=>{this.editingTools.splice(i,1),this.renderToolsEditor();let t=e.querySelector(`.tasks__preview`);t&&r(t,this.renderToolsPreview(this.editingTools))}),o.appendChild(s),o.appendChild(c);let l=document.createElement(`input`);l.type=`text`,l.className=`tasks__form-input`,l.placeholder=`Tool Name (e.g. show_toast)`,l.value=n.name||``,l.addEventListener(`input`,t=>{n.name=t.target.value;let i=e.querySelector(`.tasks__preview`);i&&r(i,this.renderToolsPreview(this.editingTools))});let u=document.createElement(`textarea`);u.className=`tasks__form-textarea`,u.placeholder=`{
  "key": "value"
}`;try{u.value=n.input&&Object.keys(n.input).length?JSON.stringify(n.input,null,2):``}catch{u.value=``}u.addEventListener(`change`,t=>{let i=t.target.value;if(!i.trim())n.input={};else try{n.input=JSON.parse(i),t.target.style.borderColor=``}catch{t.target.style.borderColor=`var(--shadow-claw-error-color)`}let a=e.querySelector(`.tasks__preview`);a&&r(a,this.renderToolsPreview(this.editingTools))});let d=document.createElement(`label`);d.className=`tasks__tool-suppress`;let f=document.createElement(`input`);f.type=`checkbox`,f.checked=!!n.suppressOutput,f.addEventListener(`change`,t=>{n.suppressOutput=t.target.checked;let i=e.querySelector(`.tasks__preview`);i&&r(i,this.renderToolsPreview(this.editingTools))}),d.appendChild(f),d.appendChild(document.createTextNode(` Suppress Output`));let p=document.createElement(`label`);p.className=`tasks__tool-suppress`;let m=document.createElement(`input`);m.type=`checkbox`,m.checked=!!n.suppressToast,m.addEventListener(`change`,t=>{n.suppressToast=t.target.checked;let i=e.querySelector(`.tasks__preview`);i&&r(i,this.renderToolsPreview(this.editingTools))}),p.appendChild(m),p.appendChild(document.createTextNode(` Suppress Toast`)),a.appendChild(o),a.appendChild(l),a.appendChild(u),a.appendChild(d),a.appendChild(p),t.appendChild(a)}))}renderToolsPreview(e,t=!1){if(!e||e.length===0)return`<span class="tasks__preview-empty">No tools configured</span>`;let n=e.map((e,t)=>{let n=`{}`;try{n=JSON.stringify(e.input,null,2)}catch{n=`Invalid JSON`}return`<div><strong>${t+1}. ${i(e.name||`Unnamed Tool`)}</strong><pre><code>${i(n)}</code></pre></div>`}).join(``);return t&&e.length>2?`
        <details class="tasks__content-details">
          <summary class="tasks__content-summary">
            <span class="tasks__summary-text">${e.length} Tools configured</span>
            <span class="tasks__summary-label">(View more)</span>
          </summary>
          <div class="tasks__prompt">${n}</div>
        </details>
      `:`<div class="tasks__prompt">${n}</div>`}resolveWorkspaceLinkPath(e){let t=e.trim();if(!t||t.startsWith(`#`))return null;let n=t;if(/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(t)||t.startsWith(`//`)){let e;try{e=new URL(t,window.location.href)}catch{return null}if(!(e.protocol===`http:`||e.protocol===`https:`)||e.host!==window.location.host)return null;n=`${e.pathname}${e.search}${e.hash}`}let r=n.split(/[?#]/,1)[0].replace(/\\/g,`/`);if(r=r.replace(/^\/+/,``),r=r.replace(/^\.\//,``),!r)return null;let i=r.split(`/`).filter(Boolean);return i.some(e=>e===`..`)?null:i.join(`/`)}async handleBackup(){try{let e=this.shadowRoot?.querySelector(`.tasks__backup-btn`);e?.toggleAttribute(`disabled`,!0),e&&(e.textContent=`⏳`);let t=a.getTasksForBackup(),n=JSON.stringify(t,null,2),r=new Blob([n],{type:`application/json`}),i=URL.createObjectURL(r),o=document.createElement(`a`);o.href=i,o.download=`shadowclaw-tasks-backup-${Date.now()}.json`,document.body.appendChild(o),o.click(),document.body.removeChild(o),URL.revokeObjectURL(i)}catch(e){c(`Failed to create backup: ${e instanceof Error?e.message:String(e)}`),console.error(`Backup error:`,e)}finally{let e=this.shadowRoot?.querySelector(`.tasks__backup-btn`);e?.toggleAttribute(`disabled`,!1),e&&(e.textContent=`💾 Backup`)}}async handleClearAll(e){if(await this.requestConfirmation({title:`Clear All Tasks`,message:`Delete ALL tasks? This cannot be undone!`,confirmLabel:`Delete All`,cancelLabel:`Cancel`}))try{let t=this.shadowRoot?.querySelector(`.tasks__clear-btn`);t?.toggleAttribute(`disabled`,!0),t&&(t.textContent=`⏳`),await a.clearAllTasks(e)}catch(e){c(`Failed to clear tasks: ${e instanceof Error?e.message:String(e)}`),console.error(`Clear error:`,e)}finally{let e=this.shadowRoot?.querySelector(`.tasks__clear-btn`);e?.toggleAttribute(`disabled`,!1),e&&(e.textContent=`🗑️ Clear All`)}}async handleCopyId(e){try{await navigator.clipboard.writeText(e),s(`Task ID copied to clipboard!`)}catch{c(`Failed to copy task ID.`)}}async handleDelete(e,t){if(await this.requestConfirmation({title:`Delete Scheduled Task`,message:`Are you sure you want to delete this scheduled task?`,confirmLabel:`Delete`,cancelLabel:`Cancel`}))try{await a.deleteTask(e,t)}catch(e){console.error(`Failed to delete task:`,e)}}async handleEditSubmit(e,t){let n=new FormData(t),r=n.get(`name`),i=n.get(`schedule`),s=n.get(`prompt`),l=n.get(`taskType`)||`prompt`,u=r?String(r).trim():``,d=i?String(i).trim():``;if(l===`prompt`&&!s){o(`Please provide a task prompt.`);return}let f=!!n.get(`freshContext`),p=!!n.get(`subagent`);try{let t;if(this.editingTask)t={...this.editingTask,name:u||void 0,schedule:d,type:l,prompt:String(s||``),tools:JSON.parse(JSON.stringify(this.editingTools)),freshContext:f,subagent:p};else{let e=a.activeGroupId;t={id:crypto.randomUUID?crypto.randomUUID():`task-${Date.now()}-${Math.random()}`,groupId:e,name:u||void 0,schedule:d,type:l,prompt:String(s||``),tools:JSON.parse(JSON.stringify(this.editingTools)),enabled:!0,lastRun:null,createdAt:Date.now(),freshContext:f,subagent:p}}await a.upsertTask(e,t),(this.shadowRoot?.querySelector(`dialog`))?.close(),this.editingTask=null}catch(e){c(`Failed to save task: ${e instanceof Error?e.message:String(e)}`),console.error(`Save error:`,e)}}async handlePreviewLinkClick(e,t){if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;let n=e.target;if(!(n instanceof Element))return;let r=n.closest(`a`);if(!(r instanceof HTMLAnchorElement))return;let i=r.getAttribute(`href`)||``,o=this.resolveWorkspaceLinkPath(i);if(!o)return;e.preventDefault();let s=[o],l=o.split(`/`).filter(Boolean).pop()||``;/\.[^./]+$/u.test(l)||s.push(`${o}.md`,`${o}/index.md`);for(let e of s)try{await f.openFile(t,e,a.activeGroupId);return}catch{}c(`Failed to open linked file: ${o}`,5e3)}async handleRestore(e,t){let n=t.files;if(!n||n.length===0)return;let r=n[0];if(!r.name.endsWith(`.json`)){o(`Please select a .json file`);return}if(!await this.requestConfirmation({title:`Restore Tasks`,message:`Restore from backup will replace all current tasks. Continue?`,confirmLabel:`Restore`,cancelLabel:`Cancel`})){t.value=``;return}try{let n=this.shadowRoot?.querySelector(`.tasks__restore-btn`);n?.toggleAttribute(`disabled`,!0),n&&(n.textContent=`⏳`);let i=await r.text(),o=JSON.parse(i);if(!Array.isArray(o))throw Error(`Invalid backup file format`);await a.restoreTasksFromBackup(e,o),t.value=``,s(`Tasks restored successfully!`)}catch(e){c(`Failed to restore from backup: ${e instanceof Error?e.message:String(e)}`),console.error(`Restore error:`,e)}finally{let e=this.shadowRoot?.querySelector(`.tasks__restore-btn`);e?.toggleAttribute(`disabled`,!1),e&&(e.textContent=`♻️ Restore`)}}async renderPreview(e,t=!1){if(!e.trim())return`<span class="tasks__preview-empty">No content</span>`;let n=e.split(`
`),r=e.length>120||n.length>1,a=await d(e,{breaks:!0,renderFrontmatter:this.renderFrontmatter});return t&&r?`
        <details class="tasks__content-details">
          <summary class="tasks__content-summary">
            <span class="tasks__summary-text">${i(e.trim())}</span>
            <span class="tasks__summary-label">(View more)</span>
          </summary>
          <div class="tasks__prompt">${a}</div>
        </details>
      `:`<div class="tasks__prompt">${a}</div>`}async requestConfirmation(e){let t=document.querySelector(`shadow-claw`);return t&&typeof t.requestDialog==`function`?await t.requestDialog({mode:`confirm`,...e}):(o(e.message,4e3),!1)}async updateTaskList(e){let t=this.shadowRoot;if(!t)return;let n=t.querySelector(`.tasks__list`);if(!n)return;let o=a.tasks;if(o.length===0){r(n,`<shadow-claw-empty-state
          class="tasks__empty"
          message="No scheduled tasks for this group."
          hint="Ask the agent to create one using 'create_task'."
        ></shadow-claw-empty-state>`);return}let s=document.createDocumentFragment();for(let t=0;t<o.length;t++){let c=o[t],l=document.createElement(`div`);l.className=`tasks__item`,l.setAttribute(`role`,`listitem`),l.setAttribute(`tabindex`,`0`),l.setAttribute(`aria-describedby`,`reorder-instructions`),l.setAttribute(`aria-label`,`${c.name||`Task`}, position ${t+1} of ${o.length}`),l.setAttribute(`data-task-id`,c.id),this._keyboardGrabbedId===c.id&&(l.classList.add(`keyboard-grabbed`),l.setAttribute(`aria-grabbed`,`true`));let u=c.lastRun?new Date(c.lastRun).toLocaleString():`Never`,d=c.type===`tools`,f=d?this.renderToolsPreview(c.tools||[],!0):await this.renderPreview(c.prompt,!0),p=c.schedule?`⏰ ${i(c.schedule)}`:`⏸ Unscheduled`,m=c.schedule?`
            <label class="tasks__toggle">
              <input type="checkbox" ${c.enabled?`checked`:``} data-id="${i(c.id)}" class="tasks__toggle-input" aria-label="${c.enabled?`Disable`:`Enable`} task scheduled ${i(c.schedule)}">
              ${c.enabled?`Enabled`:`Disabled`}
            </label>`:``,h=[d?`Tools`:`Prompt`];c.freshContext&&h.push(`Fresh Context`),c.subagent&&h.push(`Subagent`);let g=h.join(` · `);r(l,`<div class="tasks__item-header">
          <div style="display: flex; align-items: flex-start; flex: 1; min-width: 0;">
            <span class="tasks__drag-handle" draggable="true" aria-hidden="true" title="Drag to reorder">⠿</span>
            <div class="tasks__item-info">
              ${c.name?`<div class="tasks__name" style="font-weight: 600; font-size: var(--shadow-claw-font-size-md); margin-bottom: 0.25rem;">${i(c.name)}</div>`:``}
              <div class="tasks__schedule-row">
                <div class="tasks__schedule">${p} <span class="tasks__type-badge">(${i(g)})</span></div>
              </div>
              <div class="tasks__prompt-container">
                ${f}
              </div>
              <div class="tasks__last-run">Last run: ${i(u)}</div>
            </div>
          </div>
          <div class="tasks__actions">
            ${m}
            <button type="button" class="tasks__copy-id-btn" data-id="${i(c.id)}" aria-label="Copy task ID" title="Copy task ID">
              <svg xmlns="http://www.w3.org/2000/svg" height="1em" width="1em" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true" style="vertical-align: middle; margin-right: 0.125rem; margin-top: -0.125rem;"><path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"/></svg> Copy ID
            </button>
            <button type="button" class="tasks__run-btn" data-id="${i(c.id)}" aria-label="Run task">Run</button>
            <button type="button" class="tasks__edit-btn" data-id="${i(c.id)}" aria-label="Edit task">✎ Edit</button>
            <button type="button" class="tasks__delete-btn" data-id="${i(c.id)}" aria-label="Delete task">Delete</button>
          </div>
        </div>`),l.querySelector(`.tasks__toggle-input`)?.addEventListener(`change`,t=>{let n=t.target;a.toggleTask(e,c,n.checked)}),l.querySelector(`.tasks__copy-id-btn`)?.addEventListener(`click`,()=>this.handleCopyId(c.id)),l.querySelector(`.tasks__run-btn`)?.addEventListener(`click`,()=>this.handleRun(c)),l.querySelector(`.tasks__edit-btn`)?.addEventListener(`click`,()=>this.handleEdit(c)),l.querySelector(`.tasks__delete-btn`)?.addEventListener(`click`,()=>this.handleDelete(e,c.id));let _=l.querySelector(`.tasks__drag-handle`);_?.addEventListener(`dragstart`,e=>{this._draggedTaskId=c.id,l.classList.add(`dragging`),e.dataTransfer?.setData(`text/plain`,c.id)}),_?.addEventListener(`dragend`,()=>{l.classList.remove(`dragging`),this._draggedTaskId=null,n.querySelectorAll(`.drag-over`).forEach(e=>e.classList.remove(`drag-over`))}),_?.addEventListener(`touchstart`,e=>{let t=e.touches[0];t&&(this._touchId=t.identifier,this._touchDraggedTaskId=c.id,l.classList.add(`dragging`),e.preventDefault())},{passive:!1}),l.addEventListener(`dragover`,e=>{e.preventDefault(),this._draggedTaskId&&this._draggedTaskId!==c.id&&l.classList.add(`drag-over`)}),l.addEventListener(`dragleave`,()=>{l.classList.remove(`drag-over`)}),l.addEventListener(`drop`,e=>{e.preventDefault(),l.classList.remove(`drag-over`),this._draggedTaskId&&this._draggedTaskId!==c.id&&this.handleReorder(this._draggedTaskId,c.id)}),l.addEventListener(`keydown`,e=>{this._handleKeyboard(e,c.id,c.name||`Task`)}),s.appendChild(l)}n.replaceChildren(),n.appendChild(s),this._bindTouchListEvents(n)}async handleReorder(e,n,r){let i=await t();if(!i)return;if(r){await a.reorderTasks(i,a.activeGroupId,r);return}let o=(a.tasks||[]).map(e=>e.id),s=o.indexOf(e),c=o.indexOf(n);s<0||c<0||(o.splice(s,1),o.splice(c,0,e),await a.reorderTasks(i,a.activeGroupId,o))}_announce(e){let t=this.shadowRoot?.querySelector(`#live-region`);t&&(t.textContent=``,requestAnimationFrame(()=>{t.textContent=e}))}_bindTouchListEvents(e){e._touchBound||(e._touchBound=!0,e.addEventListener(`touchmove`,t=>{if(this._touchDraggedTaskId===null)return;let n=this._findTouch(t);if(!n)return;t.preventDefault();let r=this._itemAtPoint(n.clientX,n.clientY);e.querySelectorAll(`.drag-over`).forEach(e=>e.classList.remove(`drag-over`)),r&&r.getAttribute(`data-task-id`)!==this._touchDraggedTaskId&&r.classList.add(`drag-over`),this._updateAutoScrollSpeed(n.clientY)},{passive:!1}),e.addEventListener(`touchend`,t=>{if(this._touchDraggedTaskId===null)return;let n=this._findChangedTouch(t);if(!n)return;let r=this._itemAtPoint(n.clientX,n.clientY)?.getAttribute(`data-task-id`);e.querySelectorAll(`.dragging`).forEach(e=>e.classList.remove(`dragging`)),e.querySelectorAll(`.drag-over`).forEach(e=>e.classList.remove(`drag-over`)),r&&r!==this._touchDraggedTaskId&&this.handleReorder(this._touchDraggedTaskId,r),this._stopAutoScroll(),this._touchDraggedTaskId=null,this._touchId=null}),e.addEventListener(`touchcancel`,()=>{e.querySelectorAll(`.dragging`).forEach(e=>e.classList.remove(`dragging`)),e.querySelectorAll(`.drag-over`).forEach(e=>e.classList.remove(`drag-over`)),this._stopAutoScroll(),this._touchDraggedTaskId=null,this._touchId=null}))}_findChangedTouch(e){for(let t=0;t<e.changedTouches.length;t++){let n=e.changedTouches[t];if(n.identifier===this._touchId)return n}}_findTouch(e){for(let t=0;t<e.touches.length;t++){let n=e.touches[t];if(n.identifier===this._touchId)return n}}_itemAtPoint(e,t){let n=this.shadowRoot;return n&&n.elementFromPoint(e,t)?.closest?.(`.tasks__item`)||null}_startAutoScroll(){if(this._autoScrollActive)return;this._autoScrollActive=!0;let e=()=>{if(!this._autoScrollActive)return;let t=this.shadowRoot?.querySelector(`.tasks__content`);t&&this._autoScrollSpeed!==0&&(t.scrollTop+=this._autoScrollSpeed),requestAnimationFrame(e)};requestAnimationFrame(e)}_stopAutoScroll(){this._autoScrollActive=!1,this._autoScrollSpeed=0}_updateAutoScrollSpeed(e){let t=this.shadowRoot?.querySelector(`.tasks__content`);if(!t){this._autoScrollSpeed=0;return}let n=t.getBoundingClientRect(),r=e-n.top,i=n.bottom-e;r>=0&&r<50?(this._autoScrollSpeed=-((50-r)/50)*8,this._startAutoScroll()):i>=0&&i<50?(this._autoScrollSpeed=(50-i)/50*8,this._startAutoScroll()):this._autoScrollSpeed=0}_focusNext(e){let t=this.shadowRoot;if(!t)return;let n=Array.from(t.querySelectorAll(`.tasks__item[tabindex="0"], button:not([disabled]), input:not([type="hidden"]):not([disabled])`)),r=n.indexOf(e);r!==-1&&r<n.length-1&&n[r+1].focus()}_focusNextItem(e){let t=this.shadowRoot;if(!t)return;let n=Array.from(t.querySelectorAll(`.tasks__item`)),r=e.closest(`.tasks__item`),i=n.indexOf(r);i!==-1&&i<n.length-1&&n[i+1].focus()}_focusPrev(e){let t=this.shadowRoot;if(!t)return;let n=Array.from(t.querySelectorAll(`.tasks__item[tabindex="0"], button:not([disabled]), input:not([type="hidden"]):not([disabled])`)),r=n.indexOf(e);r>0&&n[r-1].focus()}_focusPrevItem(e){let t=this.shadowRoot;if(!t)return;let n=Array.from(t.querySelectorAll(`.tasks__item`)),r=e.closest(`.tasks__item`),i=n.indexOf(r);i>0&&n[i-1].focus()}_handleKeyboard(e,n,r){let i=a.tasks||[],o=i.map(e=>e.id),s=o.length;if(this._keyboardGrabbedId===null){if(e.key===`ArrowDown`){e.preventDefault(),this._focusNextItem(e.target);return}if(e.key===`ArrowUp`){e.preventDefault(),this._focusPrevItem(e.target);return}if(e.key===`ArrowRight`){e.preventDefault(),this._focusNext(e.target);return}if(e.key===`ArrowLeft`){e.preventDefault(),this._focusPrev(e.target);return}if(e.key===`m`||e.key===`M`){e.preventDefault(),this._keyboardGrabbedId=n;let i=o.indexOf(n)+1;this._announce(`${r} grabbed. Current position ${i} of ${s}. Use Arrow Up and Down to move, Space or Enter to drop.`),t().then(e=>this.updateTaskList(e)).catch(console.error)}return}if(e.key===`Escape`){e.preventDefault(),this._announce(`Reorder cancelled. ${r} returned to original position.`),this._keyboardGrabbedId=null,t().then(e=>this.updateTaskList(e)).catch(console.error);return}if(e.key===` `||e.key===`Spacebar`||e.key===`Enter`){e.preventDefault();let n=o.indexOf(this._keyboardGrabbedId)+1,r=i.find(e=>e.id===this._keyboardGrabbedId)?.name||`Task`;this._announce(`${r} dropped at position ${n} of ${s}. Reordering complete.`),this._keyboardGrabbedId=null,t().then(e=>this.updateTaskList(e)).catch(console.error);return}if(e.key===`ArrowUp`||e.key===`ArrowDown`){e.preventDefault();let t=o.indexOf(this._keyboardGrabbedId),n=e.key===`ArrowUp`?t-1:t+1;if(n<0||n>=s)return;o.splice(t,1),o.splice(n,0,this._keyboardGrabbedId),this._announce(`Moved to position ${n+1} of ${s}.`),this.handleReorder(this._keyboardGrabbedId,o[t],o)}}};customElements.get(y)||customElements.define(y,x);export{x as ShadowClawTasks};