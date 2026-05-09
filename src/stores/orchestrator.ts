import { Signal } from "signal-polyfill";

import { DEFAULT_GROUP_ID, CONFIG_KEYS } from "../config.js";

import { deleteTask } from "../db/deleteTask.js";
import { getAllTasks } from "../db/getAllTasks.js";
import { getRecentMessages } from "../db/getRecentMessages.js";
import { saveTask } from "../db/saveTask.js";
import { clearGroupMessages } from "../db/clearGroupMessages.js";
import { cloneGroupMessages } from "../db/cloneGroupMessages.js";
import { cloneGroupTasks } from "../db/cloneGroupTasks.js";
import { getConfig } from "../db/getConfig.js";
import { setConfig } from "../db/setConfig.js";
import {
  listGroups,
  createGroup,
  renameGroup,
  deleteGroupMetadata,
  reorderGroups,
  cloneGroup,
  saveGroupMetadata,
} from "../db/groups.js";

import { listGroupFiles } from "../storage/listGroupFiles.js";
import { copyGroupDirectory } from "../storage/copyGroupDirectory.js";
import { readGroupFile } from "../storage/readGroupFile.js";
import { requestStorageAccess } from "../storage/requestStorageAccess.js";
import { getStorageStatus } from "../storage/storage.js";
import { writeGroupFile } from "../storage/writeGroupFile.js";
import { showError } from "../toast.js";
import type {
  MessageAttachment,
  ShadowClawDatabase,
  StoredMessage,
  Task,
  ThinkingLogEntry,
  ModelDownloadProgressPayload,
  TokenUsage,
  ToolActivity,
  ContextUsage,
  GroupMeta,
} from "../types.js";
import type { Orchestrator } from "../orchestrator.js";
import type { StorageStatus } from "../storage/storage.js";

export type OrchestratorState = "idle" | "thinking" | "responding" | "error";

type TaskSyncOutboxOperation =
  | {
      type: "upsert";
      id: string;
      task: Task;
      queuedAt: number;
    }
  | {
      type: "delete";
      id: string;
      queuedAt: number;
    };

interface ServerScheduledTask {
  id: string;
  group_id?: string;
  groupId?: string;
  schedule: string;
  prompt: string;

  enabled: number | boolean;
  last_run?: number | null;
  lastRun?: number | null;
  created_at?: number;
  createdAt?: number;
}

/**
 * Lazy-cached probe: returns true only when the server's schedule API is
 * reachable.
 *
 * The result is cached per base URL for the lifetime of the page.
 */
const _scheduleServerAvailableCache = new Map<string, boolean>();
async function isScheduleServerAvailable(baseUrl: string): Promise<boolean> {
  const cached = _scheduleServerAvailableCache.get(baseUrl);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const base = baseUrl.replace(/\/$/, "");
    const res = await fetch(`${base}/tasks`, { method: "HEAD" });
    // A 200/405 means the route exists; a redirect or HTML 404 means static host.
    const available =
      res.status !== 404 && res.status !== 301 && res.status !== 302;
    _scheduleServerAvailableCache.set(baseUrl, available);

    return available;
  } catch {
    _scheduleServerAvailableCache.set(baseUrl, false);

    return false;
  }
}

/**
 * Sync a task to the server-side SQLite store.
 */
async function syncTaskToServer(task: Task, baseUrl: string): Promise<boolean> {
  if (!(await isScheduleServerAvailable(baseUrl))) {
    return true; // Silently succeed on static-only deployments.
  }

  try {
    const base = baseUrl.replace(/\/$/, "");
    const res = await fetch(`${base}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(task),
    });

    return res.ok;
  } catch {
    return false;
  }
}

type DeleteTaskServerResult = "deleted" | "missing" | "failed";

/**
 * Delete a task from the server-side SQLite store.
 */
async function deleteTaskFromServer(
  id: string,
  baseUrl: string,
): Promise<DeleteTaskServerResult> {
  if (!(await isScheduleServerAvailable(baseUrl))) {
    return "missing"; // No server to delete from on static-only deployments.
  }

  try {
    const base = baseUrl.replace(/\/$/, "");
    const res = await fetch(`${base}/tasks/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });

    if (res.ok) {
      return "deleted";
    }

    // "Not found" means there is nothing left to delete on the server.
    // Some deployments may also reject DELETE on this endpoint with 405.
    if (res.status === 404 || res.status === 405) {
      return "missing";
    }

    return "failed";
  } catch {
    return "failed";
  }
}

async function fetchServerTasksForGroup(
  groupId: string,
  baseUrl: string,
): Promise<Task[] | null> {
  if (!(await isScheduleServerAvailable(baseUrl))) {
    return null; // No server on static-only deployments.
  }

  try {
    const base = baseUrl.replace(/\/$/, "");
    const res = await fetch(
      `${base}/tasks?groupId=${encodeURIComponent(groupId)}`,
      {
        method: "GET",
      },
    );

    if (!res.ok || typeof (res as any).json !== "function") {
      return null;
    }

    const payload = await (res as any).json();
    if (!Array.isArray(payload)) {
      return null;
    }

    return payload
      .filter((task): task is ServerScheduledTask => {
        return (
          !!task &&
          typeof task === "object" &&
          typeof (task as any).id === "string" &&
          typeof (task as any).schedule === "string" &&
          typeof (task as any).prompt === "string"
        );
      })
      .map((task) => ({
        id: task.id,
        groupId: task.group_id || task.groupId || groupId,
        schedule: task.schedule,
        prompt: task.prompt,

        enabled: task.enabled === true || task.enabled === 1,
        lastRun:
          typeof task.lastRun === "number"
            ? task.lastRun
            : typeof task.last_run === "number"
              ? task.last_run
              : null,
        createdAt:
          typeof task.createdAt === "number"
            ? task.createdAt
            : typeof task.created_at === "number"
              ? task.created_at
              : Date.now(),
      }));
  } catch {
    return null;
  }
}

export interface OrchestratorStoreState {
  isTyping: boolean;
  ready: boolean;
  state: OrchestratorState;
  messages: StoredMessage[];
  contextUsage: ContextUsage | null;
  files: string[];
  activeGroupId: string;
  currentPath: string;
  error: string | null;
  activityLog: ThinkingLogEntry[];
  tokenUsage: TokenUsage | null;
  toolActivity: ToolActivity | null;
  modelDownloadProgress: ModelDownloadProgressPayload | null;
  streamingText: string | null;
}

export class OrchestratorStore {
  public _messages: Signal.State<StoredMessage[]>;
  public _isTyping: Signal.State<boolean>;
  public _storageStatus: Signal.State<StorageStatus | null>;
  public _toolActivity: Signal.State<ToolActivity | null>;
  public _modelDownloadProgress: Signal.State<ModelDownloadProgressPayload | null>;
  public _activityLog: Signal.State<ThinkingLogEntry[]>;
  public _state: Signal.State<OrchestratorState>;
  public _tokenUsage: Signal.State<TokenUsage | null>;
  public _error: Signal.State<string | null>;
  public _activeGroupId: Signal.State<string>;
  public _ready: Signal.State<boolean>;
  public _tasks: Signal.State<Task[]>;
  public _files: Signal.State<string[]>;
  public _currentPath: Signal.State<string>;
  public _groups: Signal.State<GroupMeta[]>;
  public _unreadGroupIds: Signal.State<Set<string>>;
  public _streamingText: Signal.State<string | null>;
  public _contextUsage: Signal.State<ContextUsage | null>;
  public _useProxy: Signal.State<boolean>;
  public _proxyUrl: Signal.State<string>;
  public _gitProxyUrl: Signal.State<string>;
  public _activePage: Signal.State<string>;
  public orchestrator: Orchestrator | null;
  private _db: ShadowClawDatabase | null;
  private _taskSyncOutbox: TaskSyncOutboxOperation[];
  private _replayingTaskSyncOutbox: boolean;
  private _onlineReplayHandler: (() => void) | null;

  private deriveGroupName(groupId: string): string {
    if (groupId.startsWith("tg:")) {
      return `Telegram ${groupId.slice(3)}`;
    }

    if (groupId.startsWith("im:")) {
      return `iMessage ${groupId.slice(3)}`;
    }

    if (groupId.startsWith("br:")) {
      return groupId === DEFAULT_GROUP_ID ? "Main" : "Browser Conversation";
    }

    return "Conversation";
  }

  private async ensureGroupExists(
    db: ShadowClawDatabase,
    groupId: string,
    timestamp?: number,
  ): Promise<void> {
    const groups = this._groups.get();
    if (groups.some((g) => g.groupId === groupId)) {
      return;
    }

    const nextGroups = [
      ...groups,
      {
        groupId,
        name: this.deriveGroupName(groupId),
        createdAt: timestamp || Date.now(),
      },
    ];

    this._groups.set(nextGroups);

    try {
      await saveGroupMetadata(db, nextGroups);
    } catch (error) {
      console.error("Failed to persist new conversation metadata:", error);
    }
  }

  constructor() {
    this._messages = new Signal.State([]);
    this._isTyping = new Signal.State(false);
    this._storageStatus = new Signal.State(null);
    this._toolActivity = new Signal.State(null);
    this._modelDownloadProgress = new Signal.State(null);
    this._activityLog = new Signal.State([]);
    this._state = new Signal.State("idle");
    this._tokenUsage = new Signal.State(null);
    this._error = new Signal.State(null);
    this._activeGroupId = new Signal.State(DEFAULT_GROUP_ID);
    this._ready = new Signal.State(false);
    this._tasks = new Signal.State([]);
    this._files = new Signal.State([]);
    this._currentPath = new Signal.State(".");
    this._groups = new Signal.State([]);
    this._unreadGroupIds = new Signal.State(new Set());
    this._streamingText = new Signal.State(null);
    this._contextUsage = new Signal.State(null);
    this._useProxy = new Signal.State(false);
    this._proxyUrl = new Signal.State("/proxy");
    this._gitProxyUrl = new Signal.State("/git-proxy");
    this._activePage = new Signal.State("chat");
    this.orchestrator = null;
    this._db = null;
    this._taskSyncOutbox = [];
    this._replayingTaskSyncOutbox = false;
    this._onlineReplayHandler = null;
  }

  private parseTaskSyncOutbox(raw: string | null | undefined) {
    if (!raw) {
      return [] as TaskSyncOutboxOperation[];
    }

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [] as TaskSyncOutboxOperation[];
      }

      const normalized = parsed
        .filter((entry): entry is any => !!entry && typeof entry === "object")
        .filter((entry) => entry.type === "upsert" || entry.type === "delete")
        .filter((entry) => typeof entry.id === "string" && entry.id.length > 0)
        .map((entry) => ({
          ...entry,
          queuedAt:
            typeof entry.queuedAt === "number" ? entry.queuedAt : Date.now(),
        })) as TaskSyncOutboxOperation[];

      return this.compactTaskSyncOutbox(normalized);
    } catch {
      return [] as TaskSyncOutboxOperation[];
    }
  }

  private compactTaskSyncOutbox(
    ops: TaskSyncOutboxOperation[],
  ): TaskSyncOutboxOperation[] {
    const lastIndexById = new Map<string, number>();
    ops.forEach((op, index) => {
      lastIndexById.set(op.id, index);
    });

    return ops.filter((op, index) => lastIndexById.get(op.id) === index);
  }

  private async persistTaskSyncOutbox(db: ShadowClawDatabase): Promise<void> {
    await setConfig(
      db,
      CONFIG_KEYS.TASK_SYNC_OUTBOX,
      JSON.stringify(this._taskSyncOutbox),
    );
  }

  private async queueTaskSyncOutboxOperation(
    db: ShadowClawDatabase,
    op: TaskSyncOutboxOperation,
  ): Promise<void> {
    this._taskSyncOutbox = this.compactTaskSyncOutbox([
      ...this._taskSyncOutbox,
      op,
    ]);

    await this.persistTaskSyncOutbox(db);
  }

  async replayTaskSyncOutbox(db: ShadowClawDatabase): Promise<void> {
    if (this._replayingTaskSyncOutbox || this._taskSyncOutbox.length === 0) {
      return;
    }

    this._replayingTaskSyncOutbox = true;

    try {
      const remaining: TaskSyncOutboxOperation[] = [];

      for (const op of this._taskSyncOutbox) {
        const base = this.getTaskServerBaseUrl();
        const ok =
          op.type === "upsert"
            ? await syncTaskToServer(op.task, base)
            : await deleteTaskFromServer(op.id, base);

        if (!ok) {
          remaining.push(op);
        }
      }

      this._taskSyncOutbox = this.compactTaskSyncOutbox(remaining);
      await this.persistTaskSyncOutbox(db);
    } finally {
      this._replayingTaskSyncOutbox = false;
    }
  }

  // --- Getters for reactive state ---

  private getTaskServerBaseUrl(): string {
    return this.orchestrator?.getTaskServerUrl() ?? "/schedule";
  }

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

  get modelDownloadProgress() {
    return this._modelDownloadProgress.get();
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

  get activePage() {
    return this._activePage.get();
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

  get groups() {
    return this._groups.get();
  }

  get storageStatus() {
    return this._storageStatus.get();
  }

  /**
   * Get the accumulated streaming text, or `null` if no stream is active.
   */
  get streamingText(): string | null {
    return this._streamingText.get();
  }

  /**
   * Get the set of groupIds with unread messages.
   */
  get unreadGroupIds(): Set<string> {
    return this._unreadGroupIds.get();
  }

  /**
   * Get context usage info, or `null` if not yet computed.
   */
  get contextUsage(): ContextUsage | null {
    return this._contextUsage.get();
  }

  get useProxy() {
    return this._useProxy.get();
  }

  get proxyUrl() {
    return this._proxyUrl.get();
  }

  get gitProxyUrl() {
    return this._gitProxyUrl.get();
  }

  setReady(ready: boolean = true): void {
    this._ready.set(ready);
  }

  /**
   * Initialize the store with an Orchestrator instance
   */
  async init(db: ShadowClawDatabase, orch: Orchestrator): Promise<void> {
    this._db = db;
    this.orchestrator = orch;

    this._taskSyncOutbox = this.parseTaskSyncOutbox(
      await getConfig(db, CONFIG_KEYS.TASK_SYNC_OUTBOX),
    );

    await this.replayTaskSyncOutbox(db);

    if (typeof window !== "undefined" && !this._onlineReplayHandler) {
      this._onlineReplayHandler = () => {
        if (this._db) {
          void this.replayTaskSyncOutbox(this._db);
        }
      };

      window.addEventListener("online", this._onlineReplayHandler);
    }

    // Subscribe to orchestrator events
    orch.events.on("message", (msg) => {
      if (msg.groupId) {
        void this.ensureGroupExists(db, msg.groupId, msg.timestamp);
      }

      // Only append messages belonging to the active conversation
      if (msg.groupId && msg.groupId !== this._activeGroupId.get()) {
        // Track as unread for the sidebar pulse indicator
        const unread = new Set(this._unreadGroupIds.get());
        unread.add(msg.groupId);
        this._unreadGroupIds.set(unread);

        return;
      }

      // When a streaming response finalizes, the `response` message arrives
      // but the streaming bubble already showed the text. Don't double-append;
      // just clear streaming state and let the persisted message appear.
      if (msg.isFromMe && this._streamingText.get() !== null) {
        this._streamingText.set(null);
      }

      this._messages.set([...this._messages.get(), msg]);
    });

    orch.events.on("typing", ({ groupId, typing }) => {
      if (groupId && groupId !== this._activeGroupId.get()) {
        return;
      }

      this._isTyping.set(typing);
    });

    orch.events.on("tool-activity", ({ groupId, tool, status }) => {
      if (groupId && groupId !== this._activeGroupId.get()) {
        return;
      }

      this._toolActivity.set(status === "running" ? { tool, status } : null);
    });

    orch.events.on("model-download-progress", (payload) => {
      this._modelDownloadProgress.set(
        payload.status === "done" ? null : payload,
      );
    });

    orch.events.on("thinking-log", (entry) => {
      // Only show activity for the active conversation
      if (entry.groupId && entry.groupId !== this._activeGroupId.get()) {
        return;
      }

      // Reset log when a new invocation starts
      if (entry.level === "info" && entry.label === "Starting") {
        this._activityLog.set([entry]);
      } else {
        this._activityLog.set([...this._activityLog.get(), entry]);
      }
    });

    orch.events.on("state-change", (state) => {
      this._state.set(state);
      if (state === "idle") {
        this._toolActivity.set(null);
        this._modelDownloadProgress.set(null);
        this._streamingText.set(null);
      }
    });

    orch.events.on("error", ({ error }) => {
      console.error("[Orchestrator Error Event]", error);

      this._error.set(error);
      this._state.set("error");
    });

    orch.events.on("session-reset", () => {
      this._messages.set([]);
      this._activityLog.set([]);
      this._tokenUsage.set(null);
      this._contextUsage.set(null);
      this._toolActivity.set(null);
      this._modelDownloadProgress.set(null);
      this._streamingText.set(null);
      this._isTyping.set(false);
      this._state.set("idle");
    });

    orch.events.on("context-compacted", (payload) => {
      // Only reload history if the compacted group is the one being viewed
      if (payload?.groupId && payload.groupId !== this._activeGroupId.get()) {
        return;
      }

      this.loadHistory();
    });

    orch.events.on("token-usage", (usage) => {
      this._tokenUsage.set(usage);
    });

    orch.events.on("context-usage", (usage) => {
      this._contextUsage.set(usage);
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

    // --- Streaming events ---

    orch.events.on("streaming-start", ({ groupId }) => {
      if (groupId !== this._activeGroupId.get()) {
        return;
      }

      this._streamingText.set("");
    });

    orch.events.on("streaming-chunk", ({ groupId, text }) => {
      if (groupId !== this._activeGroupId.get()) {
        return;
      }

      const current = this._streamingText.get();
      this._streamingText.set((current || "") + text);
    });

    orch.events.on("streaming-end", ({ groupId }) => {
      if (groupId !== this._activeGroupId.get()) {
        return;
      }

      // Tool calls are about to run; clear the streaming bubble
      this._streamingText.set(null);
    });

    orch.events.on("streaming-done", ({ groupId }) => {
      if (groupId !== this._activeGroupId.get()) {
        return;
      }
    });

    orch.events.on("streaming-error", ({ groupId }) => {
      if (groupId !== this._activeGroupId.get()) {
        return;
      }
    });

    // Restore last-active conversation, then load data
    await this.loadGroups(db);
    const lastGroup = await getConfig(db, CONFIG_KEYS.LAST_ACTIVE_GROUP);
    if (lastGroup && lastGroup !== this._activeGroupId.get()) {
      this._activeGroupId.set(lastGroup);
    }

    const lastPage = (await getConfig(db, CONFIG_KEYS.LAST_ACTIVE_PAGE)) as
      | string
      | null;
    if (lastPage) {
      this._activePage.set(lastPage);
    }

    // Initialize proxy values from orchestrator
    if (this.orchestrator) {
      this._useProxy.set(this.orchestrator.getUseProxy());
      this._proxyUrl.set(this.orchestrator.getProxyUrl());
      this._gitProxyUrl.set(this.orchestrator.getGitProxyUrl());
    }

    await Promise.all([
      this.loadHistory(),
      this.loadTasks(db),
      this.loadFiles(db),
    ]);
  }

  /**
   * Send a message
   */
  sendMessage(text: string, attachments: MessageAttachment[] = []): void {
    this.orchestrator?.submitMessage?.(
      text,
      this._activeGroupId.get(),
      attachments,
    );
  }

  /**
   * Run a task
   */
  runTask(task: Task): void {
    this.sendMessage(task.prompt);
  }

  /**
   * Start a new session
   */
  async newSession(db: ShadowClawDatabase): Promise<void> {
    await this.orchestrator?.newSession?.(db, this._activeGroupId.get());
    await this.loadHistory();
  }

  /**
   * Compact context
   */
  async compactContext(db: ShadowClawDatabase): Promise<any> {
    return this.orchestrator?.compactContext?.(db, this._activeGroupId.get());
  }

  /**
   * Stop the active in-flight request for the current group.
   */
  stopCurrentRequest() {
    this.orchestrator?.stopCurrentRequest?.(this._activeGroupId.get());
  }

  async restartCurrentRequest(): Promise<boolean> {
    if (!this.orchestrator?.restartCurrentRequest) {
      return false;
    }

    return this.orchestrator.restartCurrentRequest(this._activeGroupId.get());
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
   */
  async loadHistory() {
    const groupId = this._activeGroupId.get();
    const msgs = await getRecentMessages(groupId, 200);

    // Guard: if the user switched conversations during the async DB query,
    // discard these results to avoid overwriting the new conversation's messages.
    if (this._activeGroupId.get() !== groupId) {
      return;
    }

    this._messages.set(msgs);
  }

  /**
   * Load tasks
   */
  async loadTasks(db: ShadowClawDatabase): Promise<void> {
    const currentGroupId = this._activeGroupId.get();
    const allLocalTasks = await getAllTasks(db);
    const localGroupTasks = allLocalTasks.filter(
      (t) => t.groupId === currentGroupId,
    );
    this._tasks.set(localGroupTasks);

    // Reconcile server-side scheduled tasks into local IndexedDB so
    // server tasks become visible in the UI and can be deleted.
    const serverGroupTasks = await fetchServerTasksForGroup(
      currentGroupId,
      this.getTaskServerBaseUrl(),
    );
    if (!serverGroupTasks) {
      return;
    }

    const localTaskIds = new Set(allLocalTasks.map((task) => task.id));
    const serverOnlyTasks = serverGroupTasks.filter(
      (task) => !localTaskIds.has(task.id),
    );

    if (serverOnlyTasks.length === 0) {
      return;
    }

    for (const task of serverOnlyTasks) {
      await saveTask(db, task);
    }

    this._tasks.set([...localGroupTasks, ...serverOnlyTasks]);
  }

  /**
   * Toggle a task
   */
  async toggleTask(
    db: ShadowClawDatabase,
    task: Task,
    enabled: boolean,
  ): Promise<void> {
    const updatedTask = { ...task, enabled };
    await saveTask(db, updatedTask);
    await this.loadTasks(db);

    const serverOk = await syncTaskToServer(
      updatedTask,
      this.getTaskServerBaseUrl(),
    );
    if (!serverOk) {
      console.warn("Failed to update task on server — queued for replay.");

      await this.queueTaskSyncOutboxOperation(db, {
        type: "upsert",
        id: updatedTask.id,
        task: updatedTask,
        queuedAt: Date.now(),
      });
    }
  }

  /**
   * Save/update a task locally, then sync or queue replay if server is unavailable.
   */
  async upsertTask(
    db: ShadowClawDatabase,
    task: Task,
    options?: { reloadTasks?: boolean },
  ): Promise<void> {
    const shouldReload = options?.reloadTasks !== false;

    await saveTask(db, task);
    if (shouldReload) {
      await this.loadTasks(db);
    }

    const serverOk = await syncTaskToServer(task, this.getTaskServerBaseUrl());
    if (!serverOk) {
      console.warn("Failed to sync task to server — queued for replay.");
      await this.queueTaskSyncOutboxOperation(db, {
        type: "upsert",
        id: task.id,
        task,
        queuedAt: Date.now(),
      });
    }
  }

  /**
   * Delete a task
   */
  async deleteTask(db: ShadowClawDatabase, id: string): Promise<void> {
    const serverResult = await deleteTaskFromServer(
      id,
      this.getTaskServerBaseUrl(),
    );
    if (serverResult === "failed") {
      console.warn("Failed to delete task from server — queued for replay.");
      await this.queueTaskSyncOutboxOperation(db, {
        type: "delete",
        id,
        queuedAt: Date.now(),
      });

      throw new Error(
        "Failed to delete scheduled task on server; task kept locally.",
      );
    }

    await deleteTask(db, id);
    await this.loadTasks(db);
  }

  /**
   * Clear all tasks for the current group
   */
  async clearAllTasks(db: ShadowClawDatabase): Promise<void> {
    const allTasks = await getAllTasks(db);
    const currentGroupId = this._activeGroupId.get();
    const groupTasks = allTasks.filter((t) => t.groupId === currentGroupId);

    for (const task of groupTasks) {
      const serverResult = await deleteTaskFromServer(
        task.id,
        this.getTaskServerBaseUrl(),
      );
      if (serverResult === "failed") {
        console.warn(
          `Failed to delete task "${task.id}" from server — queued for replay.`,
        );
        await this.queueTaskSyncOutboxOperation(db, {
          type: "delete",
          id: task.id,
          queuedAt: Date.now(),
        });

        continue;
      }

      await deleteTask(db, task.id);
    }

    await this.loadTasks(db);
  }

  /**
   * Get all tasks for backup
   */
  getTasksForBackup(): Task[] {
    return this._tasks.get();
  }

  /**
   * Restore tasks from backup
   */
  async restoreTasksFromBackup(
    db: ShadowClawDatabase,
    tasks: Task[],
  ): Promise<void> {
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

      await this.upsertTask(db, taskToSave, { reloadTasks: false });
    }

    await this.loadTasks(db);
  }

  /**
   * Load files
   */
  async loadFiles(db: ShadowClawDatabase): Promise<void> {
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
   * Set and load the current file browser path.
   */
  async setCurrentPath(db: ShadowClawDatabase, path: string): Promise<void> {
    const normalizedPath = path.replace(/^\/+|\/+$/g, "");
    const nextPath = normalizedPath ? normalizedPath : ".";
    const groupId = this._activeGroupId.get();

    this._storageStatus.set(await getStorageStatus(db));

    const files = await listGroupFiles(db, groupId, nextPath);

    this._currentPath.set(nextPath);
    this._files.set(files);
  }

  /**
   * Request a manual host -> VM workspace sync for the active group.
   */
  syncHostWorkspaceToVM() {
    this.orchestrator?.syncTerminalWorkspace?.(this._activeGroupId.get());
  }

  /**
   * Request a manual VM -> host workspace flush for the active group.
   */
  syncVMWorkspaceToHost() {
    this.orchestrator?.flushTerminalWorkspace?.(this._activeGroupId.get());
  }

  /**
   * Request storage access
   */
  async grantStorageAccess(db: ShadowClawDatabase): Promise<void> {
    try {
      await requestStorageAccess(db);
      await this.loadFiles(db); // Refresh files and status after granting access
    } catch (err) {
      console.error("Failed to grant storage access:", err);
    }
  }

  /**
   * Navigate into a folder
   */
  async navigateIntoFolder(
    db: ShadowClawDatabase,
    folderName: string,
  ): Promise<void> {
    const currentPath = this._currentPath.get();
    const newPath =
      currentPath === "."
        ? folderName.replace(/\/$/, "")
        : `${currentPath}/${folderName.replace(/\/$/, "")}`;

    try {
      await this.setCurrentPath(db, newPath);
    } catch (err) {
      console.error("Failed to navigate into folder in store:", err);
      showError(`Folder not found: ${newPath}`, 4500);
      await this.loadFiles(db);
    }
  }

  /**
   * Navigate back to parent folder
   */
  async navigateBackFolder(db: ShadowClawDatabase): Promise<void> {
    const currentPath = this._currentPath.get();
    if (currentPath === ".") {
      return;
    }

    const parts = currentPath.split("/").filter(Boolean);

    parts.pop();

    const newPath = parts.length === 0 ? "." : parts.join("/");

    await this.setCurrentPath(db, newPath);
  }

  /**
   * Reset to root folder
   */
  async resetToRootFolder(db: ShadowClawDatabase): Promise<void> {
    await this.setCurrentPath(db, ".");
  }

  /**
   * Set active group
   */
  setActiveGroup(db: ShadowClawDatabase, groupId: string) {
    this._activeGroupId.set(groupId);
    this._messages.set([]);
    this._activityLog.set([]);
    this._error.set(null);
    this._isTyping.set(false);
    this._toolActivity.set(null);
    this._modelDownloadProgress.set(null);
    this._streamingText.set(null);
    this._currentPath.set(".");

    // Clear unread indicator for the group being viewed
    const unread = new Set(this._unreadGroupIds.get());
    if (unread.delete(groupId)) {
      this._unreadGroupIds.set(unread);
    }

    this.loadHistory();
    this.loadTasks(db);
    this.loadFiles(db);
  }

  /**
   * Set active page
   */
  async setActivePage(db: ShadowClawDatabase, page: string) {
    this._activePage.set(page);
    await setConfig(db, CONFIG_KEYS.LAST_ACTIVE_PAGE, page);
  }

  /**
   * Load conversations
   */
  async loadGroups(db: ShadowClawDatabase): Promise<void> {
    const groups = await listGroups(db);
    this._groups.set(groups);
  }

  /**
   * Create a conversation
   */
  async createConversation(
    db: ShadowClawDatabase,
    name: string,
  ): Promise<import("../types.js").GroupMeta> {
    const group = await createGroup(db, name);
    await this.loadGroups(db);
    this.setActiveGroup(db, group.groupId);

    return group;
  }

  /**
   * Rename a conversation
   */
  async renameConversation(
    db: ShadowClawDatabase,
    groupId: string,
    newName: string,
  ): Promise<void> {
    await renameGroup(db, groupId, newName);
    await this.loadGroups(db);
  }

  /**
   * Delete a conversation. Refuses to delete the last remaining group.
   * If the deleted group is active, switches to the first remaining group.
   */
  async deleteConversation(
    db: ShadowClawDatabase,
    groupId: string,
  ): Promise<void> {
    const groups = this._groups.get();
    if (groups.length <= 1) {
      return;
    }

    await deleteGroupMetadata(db, groupId);
    await clearGroupMessages(db, groupId);
    await this.loadGroups(db);

    if (this._activeGroupId.get() === groupId) {
      const remaining = this._groups.get();
      const next = remaining[0]?.groupId || DEFAULT_GROUP_ID;
      this.setActiveGroup(db, next);
    }
  }

  /**
   * Switch active conversation
   */
  async switchConversation(
    db: ShadowClawDatabase,
    groupId: string,
  ): Promise<void> {
    this.setActiveGroup(db, groupId);
    await setConfig(db, CONFIG_KEYS.LAST_ACTIVE_GROUP, groupId);
  }

  /**
   * Reorder conversations
   */
  async reorderConversations(
    db: ShadowClawDatabase,
    groupIds: string[],
  ): Promise<void> {
    await reorderGroups(db, groupIds);
    await this.loadGroups(db);
  }

  /**
   * Clone a conversation (metadata + messages + tasks + MEMORY.md)
   * and switch to the clone.
   */
  async cloneConversation(
    db: ShadowClawDatabase,
    sourceGroupId: string,
  ): Promise<GroupMeta | null> {
    const clone = await cloneGroup(db, sourceGroupId);
    if (!clone) {
      return null;
    }

    await cloneGroupMessages(db, sourceGroupId, clone.groupId);
    await cloneGroupTasks(db, sourceGroupId, clone.groupId);

    try {
      const memory = await readGroupFile(db, sourceGroupId, "MEMORY.md");
      if (memory) {
        await writeGroupFile(db, clone.groupId, "MEMORY.md", memory);
      }
    } catch {
      // Source has no MEMORY.md — nothing to copy
    }

    try {
      await copyGroupDirectory(db, sourceGroupId, clone.groupId, "attachments");
    } catch {
      // Source has no attachments directory — nothing to copy
    }

    await this.loadGroups(db);
    this.setActiveGroup(db, clone.groupId);

    return clone;
  }

  /**
   * Get current state
   */
  getState(): OrchestratorStoreState {
    return {
      messages: this.messages,
      isTyping: this.isTyping,
      toolActivity: this.toolActivity,
      activityLog: this.activityLog,
      state: this.state,
      tokenUsage: this.tokenUsage,
      modelDownloadProgress: this.modelDownloadProgress,
      error: this.error,
      activeGroupId: this.activeGroupId,
      ready: this.ready,
      files: this.files,
      currentPath: this.currentPath,
      streamingText: this.streamingText,
      contextUsage: this.contextUsage,
    };
  }

  /**
   * Toggle global CORS proxy
   */
  async setUseProxy(db: ShadowClawDatabase, enabled: boolean): Promise<void> {
    if (this.orchestrator) {
      await this.orchestrator.setUseProxy(db, enabled);

      this._useProxy.set(this.orchestrator.getUseProxy());
    }
  }

  /**
   * Set global CORS proxy URL
   */
  async setProxyUrl(db: ShadowClawDatabase, url: string): Promise<void> {
    if (this.orchestrator) {
      await this.orchestrator.setProxyUrl(db, url);

      this._proxyUrl.set(this.orchestrator.getProxyUrl());
    }
  }

  /**
   * Set Git CORS proxy URL
   */
  async setGitProxyUrl(db: ShadowClawDatabase, url: string): Promise<void> {
    if (this.orchestrator) {
      await this.orchestrator.setGitProxyUrl(db, url);
      this._gitProxyUrl.set(this.orchestrator.getGitProxyUrl());
    }
  }
}

export const orchestratorStore = new OrchestratorStore();
