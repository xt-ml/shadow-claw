/**
 * Types and interfaces for Server-to-Server A2A Protocol v1.0 (HTTP + JSON-RPC 2.0).
 *
 * References:
 * - A2A v1.0 Specification (Agent-to-Agent Protocol)
 * - ADR: docs/decisions/server-a2a-http-binding.md
 */

import type {
  AgentSkill,
  A2ATask,
  A2AMessage,
  TaskState,
  TaskStatusUpdateEvent,
  TaskArtifactUpdateEvent,
  AGUIEvent,
} from "../../subsystems/channels/peer-protocol.js";

/** Protocol binding identifier for standard HTTP JSON-RPC 2.0 per A2A spec */
export const A2A_HTTP_PROTOCOL_BINDING = "JSONRPC";

/** Default in-memory task retention limit */
export const DEFAULT_A2A_MAX_TASKS = 500;

/** Default message history per task */
export const DEFAULT_A2A_MAX_HISTORY = 100;

/** Configuration options for building an HTTP AgentCard */
export interface HttpAgentCardOptions {
  /** Base URL for this server (e.g. "http://127.0.0.1:4000" or "https://agent.example.com") */
  baseUrl: string;
  /** Display name for this agent node */
  name: string;
  /** Optional description */
  description?: string;
  /** Application version */
  version?: string;
  /** Declared skills */
  skills?: AgentSkill[];
  /** Whether streaming (SSE) is supported */
  streaming?: boolean;
  /** Whether push notifications are supported */
  pushNotifications?: boolean;
  /** Icon URL */
  iconUrl?: string;
  /** Documentation URL */
  documentationUrl?: string;
}

/** Options for A2ATaskStore */
export interface A2ATaskStoreOptions {
  /** Maximum number of tasks before oldest is evicted (default 500) */
  maxTasks?: number;
  /** Maximum message history kept per task (default 100) */
  maxHistoryPerTask?: number;
}

/** Task filtering and pagination options */
export interface A2AListTasksOptions {
  cursor?: string;
  limit?: number;
  state?: TaskState;
}

/** Task list response */
export interface A2AListTasksResult {
  tasks: A2ATask[];
  nextCursor?: string;
}

/** Event dispatched by A2ATaskStore on task state or artifact changes */
export interface A2ATaskEvent {
  type: "statusUpdate" | "artifactUpdate" | "aguiEvent";
  taskId: string;
  contextId: string;
  payload: TaskStatusUpdateEvent | TaskArtifactUpdateEvent | AGUIEvent;
}

export type A2ATaskEventListener = (event: A2ATaskEvent) => void;

/** Inbound task executor handler */
export type A2ATaskExecutor = (
  task: A2ATask,
  emitStatus: (state: TaskState, message?: A2AMessage) => void,
) => Promise<void>;
