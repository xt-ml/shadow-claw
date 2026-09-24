/**
 * In-memory A2A v1.0 Task Store with lifecycle state validation, LRU eviction,
 * and event subscription.
 *
 * References:
 * - A2A spec §4.1.1 (Task), §4.1.3 (TaskState)
 * - ADR: docs/decisions/server-a2a-http-binding.md
 */

import type {
  A2ATask,
  A2AMessage,
  Artifact,
  SendMessageRequest,
} from "../../subsystems/channels/peer-protocol.js";

import {
  TaskState,
  isTerminalState,
} from "../../subsystems/channels/peer-protocol.js";

import { ulid } from "../../utils/ulid.js";
import {
  DEFAULT_A2A_MAX_TASKS,
  DEFAULT_A2A_MAX_HISTORY,
  type A2ATaskStoreOptions,
  type A2AListTasksOptions,
  type A2AListTasksResult,
  type A2ATaskEvent,
  type A2ATaskEventListener,
} from "./types.js";

export class A2ATaskStore {
  private readonly _maxTasks: number;
  private readonly _maxHistoryPerTask: number;
  private readonly _tasks = new Map<string, A2ATask>();
  private readonly _listeners = new Map<string, Set<A2ATaskEventListener>>();

  constructor(options?: A2ATaskStoreOptions) {
    this._maxTasks = options?.maxTasks ?? DEFAULT_A2A_MAX_TASKS;
    this._maxHistoryPerTask =
      options?.maxHistoryPerTask ?? DEFAULT_A2A_MAX_HISTORY;
  }

  /**
   * Create and store a new A2A Task in TASK_STATE_SUBMITTED.
   */
  createTask(request: SendMessageRequest): A2ATask {
    const id = ulid();
    const contextId = request.message.contextId ?? ulid();

    const initialHistory: A2AMessage[] = [];
    if (request.message) {
      initialHistory.push({
        ...request.message,
        taskId: request.message.taskId ?? id,
        contextId: request.message.contextId ?? contextId,
      });
    }

    const task: A2ATask = {
      id,
      contextId,
      status: {
        state: TaskState.SUBMITTED,
        timestamp: new Date().toISOString(),
      },
      history: initialHistory,
      artifacts: [],
      metadata: request.metadata ? { ...request.metadata } : undefined,
    };

    // LRU eviction if at maxTasks capacity
    if (this._tasks.size >= this._maxTasks) {
      const oldestKey = this._tasks.keys().next().value;
      if (oldestKey !== undefined) {
        this._tasks.delete(oldestKey);
        this._listeners.delete(oldestKey);
      }
    }

    this._tasks.set(id, task);
    return task;
  }

  /**
   * Retrieve a task by ID.
   */
  getTask(taskId: string): A2ATask | undefined {
    const task = this._tasks.get(taskId);
    return task ? structuredClone(task) : undefined;
  }

  /**
   * Update task state and optionally append a response message to history.
   * Throws if transitioning from a terminal state.
   */
  updateTaskStatus(
    taskId: string,
    state: TaskState,
    message?: A2AMessage,
  ): A2ATask | undefined {
    const task = this._tasks.get(taskId);
    if (!task) {
      return undefined;
    }

    if (isTerminalState(task.status.state)) {
      throw new Error(
        `Cannot transition task ${taskId} from terminal state ${task.status.state}`,
      );
    }

    task.status.state = state;
    task.status.timestamp = new Date().toISOString();

    if (message) {
      task.status.message = message;
      if (!task.history) {
        task.history = [];
      }
      task.history.push(message);
      if (task.history.length > this._maxHistoryPerTask) {
        task.history.shift();
      }
    }

    this._emit(taskId, {
      type: "statusUpdate",
      taskId,
      contextId: task.contextId ?? taskId,
      payload: {
        taskId,
        contextId: task.contextId ?? taskId,
        status: { ...task.status },
      },
    });

    return structuredClone(task);
  }

  /**
   * Add an artifact to a task and notify subscribers.
   */
  addArtifact(taskId: string, artifact: Artifact): A2ATask | undefined {
    const task = this._tasks.get(taskId);
    if (!task) {
      return undefined;
    }

    if (!task.artifacts) {
      task.artifacts = [];
    }
    task.artifacts.push(artifact);

    this._emit(taskId, {
      type: "artifactUpdate",
      taskId,
      contextId: task.contextId ?? taskId,
      payload: {
        taskId,
        contextId: task.contextId ?? taskId,
        artifact,
      },
    });

    return structuredClone(task);
  }

  /**
   * Cancel an active task.
   * Throws if task is not found or already in a terminal state.
   */
  cancelTask(taskId: string, reason?: string): A2ATask {
    const task = this._tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (isTerminalState(task.status.state)) {
      throw new Error(
        `Task ${taskId} is not cancelable (state: ${task.status.state})`,
      );
    }

    task.status.state = TaskState.CANCELED;
    task.status.timestamp = new Date().toISOString();

    if (reason) {
      task.metadata = {
        ...task.metadata,
        cancelReason: reason,
      };
    }

    this._emit(taskId, {
      type: "statusUpdate",
      taskId,
      contextId: task.contextId ?? taskId,
      payload: {
        taskId,
        contextId: task.contextId ?? taskId,
        status: { ...task.status },
      },
    });

    return structuredClone(task);
  }

  /**
   * Subscribe to task lifecycle and artifact update events.
   * Returns an unsubscribe function.
   */
  subscribe(taskId: string, listener: A2ATaskEventListener): () => void {
    let set = this._listeners.get(taskId);
    if (!set) {
      set = new Set();
      this._listeners.set(taskId, set);
    }
    set.add(listener);

    return () => {
      const currentSet = this._listeners.get(taskId);
      if (currentSet) {
        currentSet.delete(listener);
        if (currentSet.size === 0) {
          this._listeners.delete(taskId);
        }
      }
    };
  }

  /**
   * Paginate and filter tasks by state.
   */
  listTasks(options?: A2AListTasksOptions): A2AListTasksResult {
    const limit = options?.limit ?? 50;
    const all = Array.from(this._tasks.values());

    const filtered = options?.state
      ? all.filter((t) => t.status.state === options.state)
      : all;

    let startIndex = 0;
    if (options?.cursor) {
      const idx = filtered.findIndex((t) => t.id === options.cursor);
      if (idx !== -1) {
        startIndex = idx + 1;
      }
    }

    const slice = filtered.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < filtered.length;
    const nextCursor =
      hasMore && slice.length > 0 ? slice[slice.length - 1].id : undefined;

    return {
      tasks: slice.map((task) => structuredClone(task)),
      nextCursor,
    };
  }

  private _emit(taskId: string, event: A2ATaskEvent): void {
    const set = this._listeners.get(taskId);
    if (set) {
      for (const listener of set) {
        try {
          listener(event);
        } catch (err) {
          console.error(
            `Error in A2ATaskStore listener for task ${taskId}:`,
            err,
          );
        }
      }
    }
  }
}
