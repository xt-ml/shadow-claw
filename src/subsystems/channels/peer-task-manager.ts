/**
 * A2A Task Lifecycle State Machine for WebRTC DataChannel Peer Protocol.
 *
 * Manages per-connection task state following the A2A v1.0 spec:
 *   SUBMITTED → WORKING → COMPLETED | FAILED | CANCELED
 *                       → INPUT_REQUIRED → WORKING
 *
 * Emits AG-UI events during task execution for streaming visibility.
 *
 * References:
 * - A2A spec §4.1.1 (Task), §4.1.3 (TaskState)
 * - ADR: docs/decisions/peer-protocol-a2a-agui.md (Phase 4)
 */

import type {
  A2ATask,
  A2AMessage,
  TaskStatusUpdateEvent,
  TaskArtifactUpdateEvent,
  Artifact,
  AGUIEvent,
  AGUIRunStarted,
  AGUIRunFinished,
  AGUIRunError,
  AGUITextMessageStart,
  AGUITextMessageContent,
  AGUITextMessageEnd,
  AGUIToolCallStart,
  AGUIToolCallEnd,
  AGUIStateSnapshot,
  SendMessageRequest,
  SendMessageResponse,
} from "./peer-protocol.js";

import {
  TaskState,
  Role,
  TERMINAL_STATES,
  INTERRUPTED_STATES,
} from "./peer-protocol.js";

import { ulid } from "../../utils/ulid.js";

// =============================================================================
// Task Manager Configuration
// =============================================================================

export interface TaskManagerConfig {
  /** Maximum number of tasks to retain in memory (LRU eviction) */
  maxTasks?: number;
  /** Maximum messages to retain in task history */
  maxHistoryPerTask?: number;
}

const DEFAULT_CONFIG: Required<TaskManagerConfig> = {
  maxTasks: 100,
  maxHistoryPerTask: 50,
};

// =============================================================================
// Event Emitter Types
// =============================================================================

export type TaskEventType = "statusUpdate" | "artifactUpdate" | "aguiEvent";

export interface TaskEvent {
  type: TaskEventType;
  taskId: string;
  contextId: string;
  payload: TaskStatusUpdateEvent | TaskArtifactUpdateEvent | AGUIEvent;
}

export type TaskEventListener = (event: TaskEvent) => void;

// =============================================================================
// Valid State Transitions
// =============================================================================

/**
 * Map of allowed transitions: from → Set of valid target states.
 * Based on A2A spec state diagram (§4.1.3).
 */
const VALID_TRANSITIONS = new Map<TaskState, Set<TaskState>>([
  [
    TaskState.SUBMITTED,
    new Set([
      TaskState.WORKING,
      TaskState.REJECTED,
      TaskState.CANCELED,
      TaskState.FAILED,
    ]),
  ],
  [
    TaskState.WORKING,
    new Set([
      TaskState.COMPLETED,
      TaskState.FAILED,
      TaskState.CANCELED,
      TaskState.INPUT_REQUIRED,
      TaskState.AUTH_REQUIRED,
    ]),
  ],
  [
    TaskState.INPUT_REQUIRED,
    new Set([TaskState.WORKING, TaskState.CANCELED, TaskState.FAILED]),
  ],
  [
    TaskState.AUTH_REQUIRED,
    new Set([TaskState.WORKING, TaskState.CANCELED, TaskState.FAILED]),
  ],
]);

// =============================================================================
// PeerTaskManager
// =============================================================================

/**
 * Per-connection task lifecycle state machine.
 *
 * Responsibilities:
 * 1. Creates tasks when SendMessage is received without a taskId
 * 2. Transitions states following A2A state diagram
 * 3. Emits AG-UI events during task execution
 * 4. Stores task history (recent messages per task)
 * 5. Handles CancelTask requests gracefully
 */
export class PeerTaskManager {
  private _tasks = new Map<string, A2ATask>();
  private _taskOrder: string[] = []; // LRU order (oldest first)
  private _config: Required<TaskManagerConfig>;
  private _listeners: Set<TaskEventListener> = new Set();
  /** Maps contextId → active (non-terminal) taskId */
  private _contextActiveTask = new Map<string, string>();

  constructor(config?: TaskManagerConfig) {
    this._config = { ...DEFAULT_CONFIG, ...config };
  }

  // ---------------------------------------------------------------------------
  // Event Subscription
  // ---------------------------------------------------------------------------

  /** Subscribe to task events */
  on(listener: TaskEventListener): void {
    this._listeners.add(listener);
  }

  /** Unsubscribe from task events */
  off(listener: TaskEventListener): void {
    this._listeners.delete(listener);
  }

  private _emit(event: TaskEvent): void {
    for (const listener of this._listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error("PeerTaskManager: listener error", err);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Task Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Handle an incoming SendMessage request. Creates or continues a task.
   * Returns the task in its current state (for the JSON-RPC response).
   */
  handleSendMessage(request: SendMessageRequest): SendMessageResponse {
    const message = request.message;
    const contextId = message.contextId ?? ulid();
    const taskId = message.taskId ?? this._contextActiveTask.get(contextId);

    if (taskId && this._tasks.has(taskId)) {
      // Continue existing task

      return this._continueTask(taskId, message);
    }

    // Create new task

    return this._createTask(contextId, message);
  }

  /**
   * Get a task by ID. Returns undefined if not found.
   */
  getTask(taskId: string): A2ATask | undefined {
    return this._tasks.get(taskId);
  }

  /**
   * Cancel a task. Returns true if cancellation was accepted.
   */
  cancelTask(taskId: string): boolean {
    const task = this._tasks.get(taskId);
    if (!task) {
      return false;
    }

    if (TERMINAL_STATES.has(task.status.state)) {
      return false; // Already terminal, cannot cancel
    }

    this._transitionState(task, TaskState.CANCELED, {
      messageId: ulid(),
      role: Role.AGENT,
      parts: [{ text: "Task canceled by peer request." }],
    });

    return true;
  }

  /**
   * Transition a task to WORKING state. Called when the local agent
   * starts processing the task.
   */
  markWorking(taskId: string): void {
    const task = this._tasks.get(taskId);
    if (!task) {
      return;
    }

    this._transitionState(task, TaskState.WORKING);
  }

  /**
   * Transition a task to COMPLETED state with an optional final message.
   */
  markCompleted(taskId: string, message?: A2AMessage): void {
    const task = this._tasks.get(taskId);
    if (!task) {
      return;
    }

    this._transitionState(task, TaskState.COMPLETED, message);
  }

  /**
   * Transition a task to FAILED state with an error message.
   */
  markFailed(taskId: string, errorMessage: string): void {
    const task = this._tasks.get(taskId);
    if (!task) {
      return;
    }

    this._transitionState(task, TaskState.FAILED, {
      messageId: ulid(),
      role: Role.AGENT,
      parts: [{ text: errorMessage }],
    });
  }

  /**
   * Transition a task to INPUT_REQUIRED state.
   */
  markInputRequired(taskId: string, message?: A2AMessage): void {
    const task = this._tasks.get(taskId);
    if (!task) {
      return;
    }

    this._transitionState(task, TaskState.INPUT_REQUIRED, message);
  }

  /**
   * Add an artifact to a task.
   */
  addArtifact(taskId: string, artifact: Artifact, append = false): void {
    const task = this._tasks.get(taskId);
    if (!task) {
      return;
    }

    if (!task.artifacts) {
      task.artifacts = [];
    }

    if (append) {
      const existing = task.artifacts.find(
        (a) => a.artifactId === artifact.artifactId,
      );
      if (existing) {
        existing.parts.push(...artifact.parts);
      } else {
        task.artifacts.push(artifact);
      }
    } else {
      task.artifacts.push(artifact);
    }

    const event: TaskArtifactUpdateEvent = {
      taskId: task.id,
      contextId: task.contextId ?? "",
      artifact,
      append,
      lastChunk: false,
    };

    this._emit({
      type: "artifactUpdate",
      taskId: task.id,
      contextId: task.contextId ?? "",
      payload: event,
    });
  }

  // ---------------------------------------------------------------------------
  // AG-UI Event Emission Helpers
  // ---------------------------------------------------------------------------

  /**
   * Emit a RUN_STARTED AG-UI event for a task.
   */
  emitRunStarted(taskId: string): void {
    const task = this._tasks.get(taskId);
    if (!task) {
      return;
    }

    const event: AGUIRunStarted = {
      type: "RUN_STARTED",
      threadId: task.contextId ?? task.id,
      runId: task.id,
      timestamp: Date.now(),
    };

    this._emitAGUI(task, event);
  }

  /**
   * Emit a RUN_FINISHED AG-UI event for a task.
   */
  emitRunFinished(taskId: string): void {
    const task = this._tasks.get(taskId);
    if (!task) {
      return;
    }

    const event: AGUIRunFinished = {
      type: "RUN_FINISHED",
      threadId: task.contextId ?? task.id,
      runId: task.id,
      timestamp: Date.now(),
    };

    this._emitAGUI(task, event);
  }

  /**
   * Emit a RUN_ERROR AG-UI event for a task.
   */
  emitRunError(taskId: string, message: string, code?: string): void {
    const task = this._tasks.get(taskId);
    if (!task) {
      return;
    }

    const event: AGUIRunError = {
      type: "RUN_ERROR",
      message,
      code,
      timestamp: Date.now(),
    };

    this._emitAGUI(task, event);
  }

  /**
   * Emit TEXT_MESSAGE_START AG-UI event.
   */
  emitTextMessageStart(
    taskId: string,
    messageId: string,
    role: "assistant" | "user" = "assistant",
  ): void {
    const task = this._tasks.get(taskId);
    if (!task) {
      return;
    }

    const event: AGUITextMessageStart = {
      type: "TEXT_MESSAGE_START",
      messageId,
      role,
      timestamp: Date.now(),
    };

    this._emitAGUI(task, event);
  }

  /**
   * Emit TEXT_MESSAGE_CONTENT AG-UI event (streaming delta).
   */
  emitTextMessageContent(
    taskId: string,
    messageId: string,
    delta: string,
  ): void {
    const task = this._tasks.get(taskId);
    if (!task) {
      return;
    }

    const event: AGUITextMessageContent = {
      type: "TEXT_MESSAGE_CONTENT",
      messageId,
      delta,
      timestamp: Date.now(),
    };

    this._emitAGUI(task, event);
  }

  /**
   * Emit TEXT_MESSAGE_END AG-UI event.
   */
  emitTextMessageEnd(taskId: string, messageId: string): void {
    const task = this._tasks.get(taskId);
    if (!task) {
      return;
    }

    const event: AGUITextMessageEnd = {
      type: "TEXT_MESSAGE_END",
      messageId,
      timestamp: Date.now(),
    };

    this._emitAGUI(task, event);
  }

  /**
   * Emit TOOL_CALL_START AG-UI event.
   */
  emitToolCallStart(
    taskId: string,
    toolCallId: string,
    toolCallName: string,
    parentMessageId?: string,
  ): void {
    const task = this._tasks.get(taskId);
    if (!task) {
      return;
    }

    const event: AGUIToolCallStart = {
      type: "TOOL_CALL_START",
      toolCallId,
      toolCallName,
      parentMessageId,
      timestamp: Date.now(),
    };

    this._emitAGUI(task, event);
  }

  /**
   * Emit TOOL_CALL_END AG-UI event.
   */
  emitToolCallEnd(taskId: string, toolCallId: string): void {
    const task = this._tasks.get(taskId);
    if (!task) {
      return;
    }

    const event: AGUIToolCallEnd = {
      type: "TOOL_CALL_END",
      toolCallId,
      timestamp: Date.now(),
    };

    this._emitAGUI(task, event);
  }

  /**
   * Emit STATE_SNAPSHOT AG-UI event (shared ground truth).
   */
  emitStateSnapshot(taskId: string, snapshot: Record<string, unknown>): void {
    const task = this._tasks.get(taskId);
    if (!task) {
      return;
    }

    const event: AGUIStateSnapshot = {
      type: "STATE_SNAPSHOT",
      snapshot,
      timestamp: Date.now(),
    };

    this._emitAGUI(task, event);
  }

  // ---------------------------------------------------------------------------
  // Query
  // ---------------------------------------------------------------------------

  /** Get all tasks (for debugging/introspection) */
  getAllTasks(): A2ATask[] {
    return Array.from(this._tasks.values());
  }

  /** Get active (non-terminal) tasks */
  getActiveTasks(): A2ATask[] {
    return Array.from(this._tasks.values()).filter(
      (t) => !TERMINAL_STATES.has(t.status.state),
    );
  }

  /** Get the active task for a context, if any */
  getActiveTaskForContext(contextId: string): A2ATask | undefined {
    const taskId = this._contextActiveTask.get(contextId);
    if (!taskId) {
      return undefined;
    }

    return this._tasks.get(taskId);
  }

  /** Clear all tasks and state */
  clear(): void {
    this._tasks.clear();
    this._taskOrder = [];
    this._contextActiveTask.clear();
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private _createTask(
    contextId: string,
    message: A2AMessage,
  ): SendMessageResponse {
    const taskId = ulid();

    const task: A2ATask = {
      id: taskId,
      contextId,
      status: {
        state: TaskState.SUBMITTED,
        timestamp: new Date().toISOString(),
      },
      history: [message],
    };

    this._addTask(task);
    this._contextActiveTask.set(contextId, taskId);

    // Emit status update
    this._emitStatusUpdate(task);

    return { task };
  }

  private _continueTask(
    taskId: string,
    message: A2AMessage,
  ): SendMessageResponse {
    const task = this._tasks.get(taskId)!;

    // If the task was in an interrupted state, transition back to WORKING
    if (INTERRUPTED_STATES.has(task.status.state)) {
      this._transitionState(task, TaskState.WORKING);
    }

    // Add to history
    if (!task.history) {
      task.history = [];
    }

    task.history.push(message);

    // Trim history if needed
    if (task.history.length > this._config.maxHistoryPerTask) {
      task.history = task.history.slice(-this._config.maxHistoryPerTask);
    }

    // Touch LRU
    this._touchTask(taskId);

    return { task };
  }

  private _transitionState(
    task: A2ATask,
    newState: TaskState,
    message?: A2AMessage,
  ): void {
    const currentState = task.status.state;

    // Validate transition
    const allowed = VALID_TRANSITIONS.get(currentState);
    if (allowed && !allowed.has(newState)) {
      console.warn(
        `PeerTaskManager: invalid transition ${currentState} → ${newState} for task ${task.id}`,
      );

      return;
    }

    // Cannot transition from terminal states
    if (TERMINAL_STATES.has(currentState)) {
      console.warn(
        `PeerTaskManager: task ${task.id} is in terminal state ${currentState}, cannot transition`,
      );

      return;
    }

    task.status = {
      state: newState,
      message,
      timestamp: new Date().toISOString(),
    };

    // If transitioning to a terminal state, remove from active context map
    if (TERMINAL_STATES.has(newState) && task.contextId) {
      if (this._contextActiveTask.get(task.contextId) === task.id) {
        this._contextActiveTask.delete(task.contextId);
      }
    }

    this._emitStatusUpdate(task);
  }

  private _emitStatusUpdate(task: A2ATask): void {
    const event: TaskStatusUpdateEvent = {
      taskId: task.id,
      contextId: task.contextId ?? "",
      status: task.status,
    };

    this._emit({
      type: "statusUpdate",
      taskId: task.id,
      contextId: task.contextId ?? "",
      payload: event,
    });
  }

  private _emitAGUI(task: A2ATask, event: AGUIEvent): void {
    this._emit({
      type: "aguiEvent",
      taskId: task.id,
      contextId: task.contextId ?? "",
      payload: event,
    });
  }

  private _addTask(task: A2ATask): void {
    this._tasks.set(task.id, task);
    this._taskOrder.push(task.id);

    // Evict oldest tasks if over limit
    while (this._taskOrder.length > this._config.maxTasks) {
      const oldestId = this._taskOrder.shift()!;
      const oldest = this._tasks.get(oldestId);
      // Only evict terminal tasks; keep active ones
      if (oldest && TERMINAL_STATES.has(oldest.status.state)) {
        this._tasks.delete(oldestId);
        if (oldest.contextId) {
          this._contextActiveTask.delete(oldest.contextId);
        }
      } else {
        // Put it back at the front — we'll try the next one
        this._taskOrder.unshift(oldestId);

        break;
      }
    }
  }

  private _touchTask(taskId: string): void {
    const idx = this._taskOrder.indexOf(taskId);
    if (idx !== -1) {
      this._taskOrder.splice(idx, 1);
      this._taskOrder.push(taskId);
    }
  }
}
