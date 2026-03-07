// @ts-ignore
import { Signal } from "signal-polyfill";

import { DEFAULT_GROUP_ID } from "../config.mjs";

import { deleteTask } from "../db/deleteTask.mjs";
import { getAllTasks } from "../db/getAllTasks.mjs";
import { getRecentMessages } from "../db/getRecentMessages.mjs";
import { saveTask } from "../db/saveTask.mjs";

import { listGroupFiles } from "../storage/listGroupFiles.mjs";
import { requestStorageAccess } from "../storage/requestStorageAccess.mjs";
import { getStorageStatus } from "../storage/storage.mjs";

/**
 * @typedef {'idle'|'thinking'|'responding'|'error'} OrchestratorState
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 * @typedef {import("../orchestrator.mjs").Orchestrator} Orchestrator
 * @typedef {import("../storage/storage.mjs").StorageStatus} StorageStatus
 * @typedef {import("../types.mjs").StoredMessage} StoredMessage
 * @typedef {import("../types.mjs").Task} Task
 * @typedef {import("../types.mjs").ThinkingLogEntry} ThinkingLogEntry
 * @typedef {import("../types.mjs").TokenUsage} TokenUsage
 * @typedef {import("../types.mjs").ToolActivity} ToolActivity
 */

/**
 * @typedef {Object} OrchestratorStoreState
 *
 * @property {boolean} isTyping
 * @property {boolean} ready
 * @property {OrchestratorState} state
 * @property {StoredMessage[]} messages
 * @property {string[]} files
 * @property {string} activeGroupId
 * @property {string} currentPath
 * @property {string|null} error
 * @property {ThinkingLogEntry[]} activityLog
 * @property {TokenUsage|null} tokenUsage
 * @property {ToolActivity|null} toolActivity
 */

export class OrchestratorStore {
  constructor() {
    /** @type {Signal.State<StoredMessage[]>} */
    this._messages = new Signal.State([]);
    /** @type {Signal.State<boolean>} */
    this._isTyping = new Signal.State(false);
    /** @type {Signal.State<StorageStatus|null>} */
    this._storageStatus = new Signal.State(null);
    /** @type {Signal.State<ToolActivity|null>} */
    this._toolActivity = new Signal.State(null);
    /** @type {Signal.State<ThinkingLogEntry[]>} */
    this._activityLog = new Signal.State([]);
    /** @type {Signal.State<'idle'|'thinking'|'responding'|'error'>} */
    this._state = new Signal.State("idle");
    /** @type {Signal.State<TokenUsage|null>} */
    this._tokenUsage = new Signal.State(null);
    /** @type {Signal.State<string|null>} */
    this._error = new Signal.State(null);
    /** @type {Signal.State<string>} */
    this._activeGroupId = new Signal.State(DEFAULT_GROUP_ID);
    /** @type {Signal.State<boolean>} */
    this._ready = new Signal.State(false);
    /** @type {Signal.State<Task[]>} */
    this._tasks = new Signal.State([]);
    /** @type {Signal.State<string[]>} */
    this._files = new Signal.State([]);
    /** @type {Signal.State<string>} */
    this._currentPath = new Signal.State(".");

    /** @type {Orchestrator|null} */
    this.orchestrator = null;
  }

  // --- Getters for reactive state ---
  get messages() {
    return this._messages.get();
  }

  get isTyping() {
    return this._isTyping.get();
  }

  get toolActivity() {
    return this._toolActivity.get();
  }

  get activityLog() {
    return this._activityLog.get();
  }

  get state() {
    return this._state.get();
  }

  get tokenUsage() {
    return this._tokenUsage.get();
  }

  get error() {
    return this._error.get();
  }

  get activeGroupId() {
    return this._activeGroupId.get();
  }

  get ready() {
    return this._ready.get();
  }

  get tasks() {
    return this._tasks.get();
  }

  get files() {
    return this._files.get();
  }

  get currentPath() {
    return this._currentPath.get();
  }

  get storageStatus() {
    return this._storageStatus.get();
  }

  /**
   * Initialize the store with an Orchestrator instance
   *
   * @param {ShadowClawDatabase} db
   * @param {Orchestrator} orch
   *
   * @returns {Promise<void>}
   */
  async init(db, orch) {
    this.orchestrator = orch;

    // Subscribe to orchestrator events
    orch.events.on("message", (/** @type {StoredMessage} */ msg) => {
      this._messages.set([...this._messages.get(), msg]);
    });

    orch.events.on("typing", (/** @type {{typing: boolean}} */ { typing }) => {
      this._isTyping.set(typing);
    });

    orch.events.on(
      "tool-activity",
      (/** @type {{tool: string, status: string}} */ { tool, status }) => {
        this._toolActivity.set(status === "running" ? { tool, status } : null);
      },
    );

    orch.events.on("thinking-log", (/** @type {ThinkingLogEntry} */ entry) => {
      // Reset log when a new invocation starts
      if (entry.level === "info" && entry.label === "Starting") {
        this._activityLog.set([entry]);
      } else {
        this._activityLog.set([...this._activityLog.get(), entry]);
      }
    });

    orch.events.on("state-change", (/** @type {string} */ state) => {
      this._state.set(state);
      if (state === "idle") {
        this._toolActivity.set(null);
      }
    });

    orch.events.on("error", (/** @type {{error: string}} */ { error }) => {
      console.error("[Orchestrator Error Event]", error);

      this._error.set(error);
      this._state.set("error");
    });

    orch.events.on("session-reset", () => {
      this._messages.set([]);
      this._activityLog.set([]);
      this._tokenUsage.set(null);
      this._toolActivity.set(null);
      this._isTyping.set(false);
      this._state.set("idle");
    });

    orch.events.on("context-compacted", () => {
      this.loadHistory();
    });

    orch.events.on("token-usage", (/** @type {TokenUsage} */ usage) => {
      this._tokenUsage.set(usage);
    });

    orch.events.on("ready", () => {
      this._ready.set(true);
    });

    orch.events.on("task-change", () => {
      this.loadTasks(db);
    });

    orch.events.on("file-change", () => {
      this.loadFiles(db);
    });

    // Load initial history, tasks, and files
    await Promise.all([
      this.loadHistory(),
      this.loadTasks(db),
      this.loadFiles(db),
    ]);

    this._ready.set(true);
  }

  /**
   * Send a message
   *
   * @param {string} text
   *
   * @returns {void}
   */
  sendMessage(text) {
    this.orchestrator?.submitMessage?.(text, this._activeGroupId.get());
  }

  /**
   * Run a task
   *
   * @param {Task} task
   *
   * @returns {void}
   */
  runTask(task) {
    if (task.isScript) {
      try {
        new Function(task.prompt).call(globalThis);
      } catch (err) {
        console.error(`Failed to execute script for task ${task.id}:`, err);
        alert(
          `Script Error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      return;
    }

    this.sendMessage(task.prompt);
  }

  /**
   * Start a new session
   *
   * @returns {Promise<void>}
   */
  async newSession() {
    return this.orchestrator?.newSession?.(this._activeGroupId.get());
  }

  /**
   * Compact context
   *
   * @param {ShadowClawDatabase} db
   *
   * @returns {Promise<void>}
   */
  async compactContext(db) {
    return this.orchestrator?.compactContext?.(db, this._activeGroupId.get());
  }

  /**
   * Clear error
   */
  clearError() {
    this._error.set(null);
    if (this._state.get() === "error") {
      this._state.set("idle");
    }
  }

  /**
   * Load message history
   *
   * @returns {Promise<void>}
   */
  async loadHistory() {
    const msgs = await getRecentMessages(this._activeGroupId.get(), 200);
    this._messages.set(msgs);
  }

  /**
   * Load tasks
   *
   * @param {ShadowClawDatabase} db
   *
   * @returns {Promise<void>}
   */
  async loadTasks(db) {
    const allTasks = await getAllTasks(db);

    const currentGroupId = this._activeGroupId.get();
    this._tasks.set(allTasks.filter((t) => t.groupId === currentGroupId));
  }

  /**
   * Toggle a task
   *
   * @param {ShadowClawDatabase} db
   * @param {import('../types.mjs').Task} task
   * @param {boolean} enabled
   */
  async toggleTask(db, task, enabled) {
    const updatedTask = { ...task, enabled };
    await saveTask(db, updatedTask);
    await this.loadTasks(db);
  }

  /**
   * Delete a task
   *
   * @param {ShadowClawDatabase} db
   * @param {string} id
   */
  async deleteTask(db, id) {
    await deleteTask(db, id);
    await this.loadTasks(db);
  }

  /**
   * Clear all tasks for the current group
   *
   * @param {ShadowClawDatabase} db
   *
   * @returns {Promise<void>}
   */
  async clearAllTasks(db) {
    const allTasks = await getAllTasks(db);
    const currentGroupId = this._activeGroupId.get();
    const groupTasks = allTasks.filter((t) => t.groupId === currentGroupId);

    for (const task of groupTasks) {
      await deleteTask(db, task.id);
    }

    await this.loadTasks(db);
  }

  /**
   * Get all tasks for backup
   * @returns {import('../types.mjs').Task[]}
   */
  getTasksForBackup() {
    return this._tasks.get();
  }

  /**
   * Restore tasks from backup
   *
   * @param {ShadowClawDatabase} db
   * @param {import('../types.mjs').Task[]} tasks
   *
   * @returns {Promise<void>}
   */
  async restoreTasksFromBackup(db, tasks) {
    // First, clear all existing tasks
    await this.clearAllTasks(db);

    const currentGroupId = this._activeGroupId.get();
    // Save each task with current group ID and new IDs
    for (const task of tasks) {
      const taskToSave = {
        ...task,
        groupId: currentGroupId,
        id: crypto.randomUUID
          ? crypto.randomUUID()
          : `task-${Date.now()}-${Math.random()}`,
      };

      await saveTask(db, taskToSave);
    }

    await this.loadTasks(db);
  }

  /**
   * Load files
   *
   * @param {ShadowClawDatabase} db
   *
   * @returns {Promise<void>}
   */
  async loadFiles(db) {
    const groupId = this._activeGroupId.get();
    const currentPath = this._currentPath.get();
    try {
      this._storageStatus.set(await getStorageStatus(db));

      const files = await listGroupFiles(db, groupId, currentPath);

      this._files.set(files);
    } catch (err) {
      console.error("Failed to load files in store:", err);
    }
  }

  /**
   * Request storage access
   *
   * @param {ShadowClawDatabase} db
   *
   * @returns {Promise<void>}
   */
  async grantStorageAccess(db) {
    try {
      await requestStorageAccess(db);
      await this.loadFiles(db); // Refresh files and status after granting access
    } catch (err) {
      console.error("Failed to grant storage access:", err);
    }
  }

  /**
   * Navigate into a folder
   *
   * @param {ShadowClawDatabase} db
   * @param {string} folderName
   *
   * @returns {Promise<void>}
   */
  async navigateIntoFolder(db, folderName) {
    const currentPath = this._currentPath.get();
    const newPath =
      currentPath === "."
        ? folderName.replace(/\/$/, "")
        : `${currentPath}/${folderName.replace(/\/$/, "")}`;
    this._currentPath.set(newPath);
    await this.loadFiles(db);
  }

  /**
   * Navigate back to parent folder
   *
   * @param {ShadowClawDatabase} db
   *
   * @returns {Promise<void>}
   */
  async navigateBackFolder(db) {
    const currentPath = this._currentPath.get();
    if (currentPath === ".") return;

    const parts = currentPath.split("/").filter(Boolean);

    parts.pop();

    const newPath = parts.length === 0 ? "." : parts.join("/");

    this._currentPath.set(newPath);

    await this.loadFiles(db);
  }

  /**
   * Reset to root folder
   *
   * @param {ShadowClawDatabase} db
   *
   * @returns {Promise<void>}
   */
  async resetToRootFolder(db) {
    this._currentPath.set(".");

    await this.loadFiles(db);
  }

  /**
   * Set active group
   *
   * @param {ShadowClawDatabase} db
   * @param {string} groupId
   */
  setActiveGroup(db, groupId) {
    this._activeGroupId.set(groupId);
    this._messages.set([]);
    this._activityLog.set([]);
    this._error.set(null);
    this._isTyping.set(false);
    this._toolActivity.set(null);
    this._currentPath.set(".");

    this.loadHistory();
    this.loadTasks(db);
    this.loadFiles(db);
  }

  /**
   * Get current state
   *
   * @returns {OrchestratorStoreState}
   */
  getState() {
    return {
      messages: this.messages,
      isTyping: this.isTyping,
      toolActivity: this.toolActivity,
      activityLog: this.activityLog,
      state: this.state,
      tokenUsage: this.tokenUsage,
      error: this.error,
      activeGroupId: this.activeGroupId,
      ready: this.ready,
      files: this.files,
      currentPath: this.currentPath,
    };
  }
}

export const orchestratorStore = new OrchestratorStore();
