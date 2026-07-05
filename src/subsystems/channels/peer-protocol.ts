/**
 * A2A v1.0 + AG-UI Protocol Types for WebRTC DataChannel Binding
 *
 * Custom binding identifier:
 *   https://xt-ml.github.io/shadow-claw/bindings/webrtc-datachannel/v1
 *
 * This module defines:
 * - A2A v1.0 canonical data model (Task, Message, Part, Artifact, TaskState)
 * - AG-UI event types for streaming visibility
 * - Wire protocol envelope (JSON-RPC 2.0 over DataChannel)
 * - Error codes per A2A spec §5.4
 *
 * References:
 * - https://a2a-protocol.org/latest/specification/
 * - https://docs.ag-ui.com/concepts/events
 */

import type { RoomMember } from "./types.js";
import type { A2UIEnvelope, A2UIAction } from "../../ui/a2ui.js";

// =============================================================================
// A2A v1.0 Protocol Binding Identifier
// =============================================================================

export const A2A_PROTOCOL_BINDING =
  "https://xt-ml.github.io/shadow-claw/bindings/webrtc-datachannel/v1";

export const A2A_PROTOCOL_VERSION = "1.0";

// =============================================================================
// A2A Task States (spec §4.1.3)
// =============================================================================

export enum TaskState {
  UNSPECIFIED = "TASK_STATE_UNSPECIFIED",
  SUBMITTED = "TASK_STATE_SUBMITTED",
  WORKING = "TASK_STATE_WORKING",
  COMPLETED = "TASK_STATE_COMPLETED",
  FAILED = "TASK_STATE_FAILED",
  CANCELED = "TASK_STATE_CANCELED",
  INPUT_REQUIRED = "TASK_STATE_INPUT_REQUIRED",
  REJECTED = "TASK_STATE_REJECTED",
  AUTH_REQUIRED = "TASK_STATE_AUTH_REQUIRED",
}

/** Terminal states — no further transitions allowed */
export const TERMINAL_STATES: ReadonlySet<TaskState> = new Set([
  TaskState.COMPLETED,
  TaskState.FAILED,
  TaskState.CANCELED,
  TaskState.REJECTED,
]);

/** Interrupted states — can transition back to WORKING */
export const INTERRUPTED_STATES: ReadonlySet<TaskState> = new Set([
  TaskState.INPUT_REQUIRED,
  TaskState.AUTH_REQUIRED,
]);

// =============================================================================
// A2A Roles (spec §4.1.5)
// =============================================================================

export enum Role {
  UNSPECIFIED = "ROLE_UNSPECIFIED",
  USER = "ROLE_USER",
  AGENT = "ROLE_AGENT",
}

// =============================================================================
// A2A Part (spec §4.1.6 — v1.0 member-name discriminator)
// =============================================================================

export interface TextPart {
  text: string;
  mediaType?: string;
  metadata?: Record<string, unknown>;
}

export interface RawPart {
  raw: string; // base64-encoded bytes
  filename?: string;
  mediaType?: string;
  metadata?: Record<string, unknown>;
}

export interface UrlPart {
  url: string;
  filename?: string;
  mediaType?: string;
  metadata?: Record<string, unknown>;
}

export interface DataPart {
  data: unknown;
  mediaType?: string;
  metadata?: Record<string, unknown>;
}

export type Part = TextPart | RawPart | UrlPart | DataPart;

// =============================================================================
// A2A Message (spec §4.1.4)
// =============================================================================

export interface A2AMessage {
  messageId: string;
  role: Role;
  parts: Part[];
  contextId?: string;
  taskId?: string;
  metadata?: Record<string, unknown>;
  extensions?: string[];
  referenceTaskIds?: string[];
}

// =============================================================================
// A2A TaskStatus (spec §4.1.2)
// =============================================================================

export interface TaskStatus {
  state: TaskState;
  message?: A2AMessage;
  timestamp?: string; // ISO 8601
}

// =============================================================================
// A2A Task (spec §4.1.1)
// =============================================================================

export interface A2ATask {
  id: string;
  contextId?: string;
  status: TaskStatus;
  artifacts?: Artifact[];
  history?: A2AMessage[];
  metadata?: Record<string, unknown>;
}

// =============================================================================
// A2A Artifact (spec §4.1.7)
// =============================================================================

export interface Artifact {
  artifactId: string;
  name?: string;
  description?: string;
  parts: Part[];
  metadata?: Record<string, unknown>;
  extensions?: string[];
}

// =============================================================================
// A2A Streaming Events (spec §4.2)
// =============================================================================

export interface TaskStatusUpdateEvent {
  taskId: string;
  contextId: string;
  status: TaskStatus;
  metadata?: Record<string, unknown>;
}

export interface TaskArtifactUpdateEvent {
  taskId: string;
  contextId: string;
  artifact: Artifact;
  append?: boolean;
  lastChunk?: boolean;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// A2A Agent Discovery (spec §4.4)
// =============================================================================

export interface AgentCard {
  name: string;
  description: string;
  version: string;
  supportedInterfaces: AgentInterface[];
  capabilities: AgentCapabilities;
  defaultInputModes: string[];
  defaultOutputModes: string[];
  skills: AgentSkill[];
  provider?: AgentProvider;
  iconUrl?: string;
  documentationUrl?: string;
}

export interface AgentInterface {
  url: string;
  protocolBinding: string;
  protocolVersion: string;
  tenant?: string;
}

export interface AgentCapabilities {
  streaming?: boolean;
  pushNotifications?: boolean;
  extendedAgentCard?: boolean;
  extensions?: AgentExtension[];
}

export interface AgentExtension {
  uri: string;
  description?: string;
  required?: boolean;
  params?: Record<string, unknown>;
}

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  examples?: string[];
  inputModes?: string[];
  outputModes?: string[];
}

export interface AgentProvider {
  organization: string;
  url: string;
}

// =============================================================================
// A2A SendMessage Request/Response (spec §3.2.1, §3.2.2)
// =============================================================================

export interface SendMessageRequest {
  message: A2AMessage;
  configuration?: SendMessageConfiguration;
  metadata?: Record<string, unknown>;
}

export interface SendMessageConfiguration {
  acceptedOutputModes?: string[];
  historyLength?: number;
  returnImmediately?: boolean;
}

export interface SendMessageResponse {
  task?: A2ATask;
  message?: A2AMessage;
}

// =============================================================================
// A2A StreamResponse (spec §3.2.3)
// =============================================================================

export type StreamResponse =
  | { task: A2ATask }
  | { message: A2AMessage }
  | { statusUpdate: TaskStatusUpdateEvent }
  | { artifactUpdate: TaskArtifactUpdateEvent };

// =============================================================================
// AG-UI Events (https://docs.ag-ui.com/concepts/events)
// =============================================================================

// --- Lifecycle ---

export interface AGUIRunStarted {
  type: "RUN_STARTED";
  threadId: string;
  runId: string;
  timestamp?: number;
}

export interface AGUIRunFinished {
  type: "RUN_FINISHED";
  threadId: string;
  runId: string;
  timestamp?: number;
}

export interface AGUIRunError {
  type: "RUN_ERROR";
  message: string;
  code?: string;
  timestamp?: number;
}

export interface AGUIStepStarted {
  type: "STEP_STARTED";
  stepName: string;
  timestamp?: number;
}

export interface AGUIStepFinished {
  type: "STEP_FINISHED";
  stepName: string;
  timestamp?: number;
}

// --- Text Message ---

export interface AGUITextMessageStart {
  type: "TEXT_MESSAGE_START";
  messageId: string;
  role: "assistant" | "user" | "developer" | "system" | "tool";
  timestamp?: number;
}

export interface AGUITextMessageContent {
  type: "TEXT_MESSAGE_CONTENT";
  messageId: string;
  delta: string;
  timestamp?: number;
}

export interface AGUITextMessageEnd {
  type: "TEXT_MESSAGE_END";
  messageId: string;
  timestamp?: number;
}

// --- Tool Calls ---

export interface AGUIToolCallStart {
  type: "TOOL_CALL_START";
  toolCallId: string;
  toolCallName: string;
  parentMessageId?: string;
  timestamp?: number;
}

export interface AGUIToolCallArgs {
  type: "TOOL_CALL_ARGS";
  toolCallId: string;
  delta: string;
  timestamp?: number;
}

export interface AGUIToolCallEnd {
  type: "TOOL_CALL_END";
  toolCallId: string;
  timestamp?: number;
}

export interface AGUIToolCallResult {
  type: "TOOL_CALL_RESULT";
  toolCallId: string;
  messageId?: string;
  content: string;
  role?: "tool";
  timestamp?: number;
}

// --- State Management ---

export interface AGUIStateSnapshot {
  type: "STATE_SNAPSHOT";
  snapshot: Record<string, unknown>;
  timestamp?: number;
}

export interface AGUIStateDelta {
  type: "STATE_DELTA";
  delta: Array<{ op: string; path: string; value?: unknown }>;
  timestamp?: number;
}

export interface AGUIMessagesSnapshot {
  type: "MESSAGES_SNAPSHOT";
  messages: Array<Record<string, unknown>>;
  timestamp?: number;
}

// --- Custom ---

export interface AGUICustomEvent {
  type: "CUSTOM";
  name: string;
  value: unknown;
  timestamp?: number;
}

/** Union of all AG-UI event types */
export type AGUIEvent =
  | AGUIRunStarted
  | AGUIRunFinished
  | AGUIRunError
  | AGUIStepStarted
  | AGUIStepFinished
  | AGUITextMessageStart
  | AGUITextMessageContent
  | AGUITextMessageEnd
  | AGUIToolCallStart
  | AGUIToolCallArgs
  | AGUIToolCallEnd
  | AGUIToolCallResult
  | AGUIStateSnapshot
  | AGUIStateDelta
  | AGUIMessagesSnapshot
  | AGUICustomEvent;

// =============================================================================
// Wire Protocol — JSON-RPC 2.0 over WebRTC DataChannel
// =============================================================================

/**
 * JSON-RPC 2.0 error object (spec §9.5)
 */
export interface A2AJsonRpcError {
  code: number;
  message: string;
  data?: unknown[];
}

/**
 * JSON-RPC 2.0 Request (has `id` and `method`)
 */
export interface A2AJsonRpcRequest {
  jsonrpc: "2.0";
  id: string;
  method: string;
  params?: unknown;
}

/**
 * JSON-RPC 2.0 Response (has `id` and either `result` or `error`)
 */
export interface A2AJsonRpcResponse {
  jsonrpc: "2.0";
  id: string;
  result?: unknown;
  error?: A2AJsonRpcError;
}

/**
 * JSON-RPC 2.0 Notification (has `method` but no `id`)
 */
export interface A2AJsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
}

/** Union of all wire message types */
export type A2AWireMessage =
  | A2AJsonRpcRequest
  | A2AJsonRpcResponse
  | A2AJsonRpcNotification;

// =============================================================================
// Wire Protocol Methods
// =============================================================================

/** Standard A2A methods (spec §9.4) */
export const A2A_METHOD = {
  SEND_MESSAGE: "SendMessage",
  SEND_STREAMING_MESSAGE: "SendStreamingMessage",
  GET_TASK: "GetTask",
  CANCEL_TASK: "CancelTask",
  GET_AGENT_CARD: "GetAgentCard",
} as const;

/** AG-UI event notification method */
export const AGUI_METHOD = {
  EVENT: "agui/event",
} as const;

/** A2A streaming notification methods */
export const A2A_STREAM_METHOD = {
  STATUS_UPDATE: "tasks/statusUpdate",
  ARTIFACT_UPDATE: "tasks/artifactUpdate",
} as const;

// =============================================================================
// Room (multi-party) Wire Protocol
// =============================================================================

/**
 * Room notification methods carried over the same JSON-RPC 2.0 DataChannel.
 *
 * Topology is hybrid: the room host runs a star for signaling/roster/membership
 * (`room/join`, `room/roster`, `room/leave`, `room/invite`), while actual
 * message traffic (`room/message`) flows peer-to-peer over the mesh, falling
 * back to host relay (`room/relay`) when a direct connection is unavailable.
 */
export const ROOM_METHOD = {
  /** member → host: request to join; host updates roster and broadcasts it. */
  JOIN: "room/join",
  /** host → all members: authoritative roster snapshot (pushed on change). */
  ROSTER: "room/roster",
  /** member → host (leaving) or host → all (disbanded). */
  LEAVE: "room/leave",
  /** any → recipient: a chat message tagged with the originating room. */
  MESSAGE: "room/message",
  /** peer → peer: out-of-band invitation to join a room. */
  INVITE: "room/invite",
  /** sender → host: ask the host to forward an inner notification to a target. */
  RELAY: "room/relay",
  /** owner → all members: a shared A2UI surface envelope (create/update/delete). */
  A2UI: "room/a2ui",
  /** any member → all members: a user action fired on a shared A2UI surface. */
  A2UI_ACTION: "room/a2ui-action",
} as const;

/** A file attachment reference within a room message. */
export interface RoomMessageAttachment {
  fileName: string;
  mimeType?: string;
  path?: string;
  size?: number;
}

/** Envelope for a chat message broadcast within a room. */
export interface RoomMessageEnvelope {
  roomId: string;
  /** Stable id used for cross-path (mesh + relay) de-duplication. */
  messageId: string;
  senderPeerId: string;
  senderAlias?: string;
  text: string;
  attachments?: RoomMessageAttachment[];
}

/** Payload for {@link ROOM_METHOD.JOIN}. */
export interface RoomJoinPayload {
  roomId: string;
  member: RoomMember;
}

/** Payload for {@link ROOM_METHOD.ROSTER}. */
export interface RoomRosterPayload {
  roomId: string;
  name: string;
  hostPeerId: string;
  members: RoomMember[];
}

/** Payload for {@link ROOM_METHOD.LEAVE}. */
export interface RoomLeavePayload {
  roomId: string;
  peerId: string;
  /** When true, the host has disbanded the room for everyone. */
  disbanded?: boolean;
}

/** Payload for {@link ROOM_METHOD.INVITE}. */
export interface RoomInvitePayload {
  roomId: string;
  roomName: string;
  hostPeerId: string;
  fromPeerId: string;
  fromAlias?: string;
}

/** Payload for {@link ROOM_METHOD.RELAY}. */
export interface RoomRelayPayload {
  roomId: string;
  targetPeerId: string;
  /** A JSON-RPC notification to be forwarded verbatim to {@link targetPeerId}. */
  inner: A2AJsonRpcNotification;
}

/**
 * Payload for {@link ROOM_METHOD.A2UI} — a shared A2UI surface broadcast.
 *
 * The surface is **owner-authoritative**: only {@link ownerPeerId}'s agent
 * mutates the data model. Other members render the broadcast envelope and route
 * their interactions back via {@link ROOM_METHOD.A2UI_ACTION}.
 */
export interface RoomA2UIEnvelope {
  roomId: string;
  /** Stable id used for cross-path (mesh + relay) de-duplication. */
  broadcastId: string;
  /** The peer whose agent owns (created) the surface. */
  ownerPeerId: string;
  /** The peer that emitted this notification. */
  senderPeerId: string;
  /** The A2UI surface envelope (createSurface / updateDataModel / …). */
  envelope: A2UIEnvelope;
}

/**
 * Payload for {@link ROOM_METHOD.A2UI_ACTION} — a user interaction on a shared
 * surface, broadcast so the surface owner's agent can process it.
 */
export interface RoomA2UIActionEnvelope {
  roomId: string;
  /** Stable id used for cross-path (mesh + relay) de-duplication. */
  broadcastId: string;
  /** The peer that owns the surface (whose agent should process the action). */
  ownerPeerId: string;
  /** The peer that fired the action. */
  senderPeerId: string;
  senderAlias?: string;
  /** The A2UI action (surfaceId, actionId, dataModel). */
  action: A2UIAction;
}

// =============================================================================
// A2A Error Codes (spec §5.4)
// =============================================================================

export const A2A_ERROR_CODE = {
  TASK_NOT_FOUND: -32001,
  TASK_NOT_CANCELABLE: -32002,
  PUSH_NOTIFICATION_NOT_SUPPORTED: -32003,
  UNSUPPORTED_OPERATION: -32004,
  CONTENT_TYPE_NOT_SUPPORTED: -32005,
  INVALID_AGENT_RESPONSE: -32006,

  // Standard JSON-RPC errors
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

// =============================================================================
// Type Guards
// =============================================================================

export function isJsonRpcRequest(msg: unknown): msg is A2AJsonRpcRequest {
  return (
    typeof msg === "object" &&
    msg !== null &&
    (msg as any).jsonrpc === "2.0" &&
    typeof (msg as any).id === "string" &&
    typeof (msg as any).method === "string"
  );
}

export function isJsonRpcResponse(msg: unknown): msg is A2AJsonRpcResponse {
  return (
    typeof msg === "object" &&
    msg !== null &&
    (msg as any).jsonrpc === "2.0" &&
    typeof (msg as any).id === "string" &&
    !("method" in (msg as any))
  );
}

export function isJsonRpcNotification(
  msg: unknown,
): msg is A2AJsonRpcNotification {
  return (
    typeof msg === "object" &&
    msg !== null &&
    (msg as any).jsonrpc === "2.0" &&
    typeof (msg as any).method === "string" &&
    !("id" in (msg as any))
  );
}

export function isTextPart(part: Part): part is TextPart {
  return "text" in part;
}

export function isRawPart(part: Part): part is RawPart {
  return "raw" in part;
}

export function isUrlPart(part: Part): part is UrlPart {
  return "url" in part && !("raw" in part) && !("text" in part);
}

export function isDataPart(part: Part): part is DataPart {
  return "data" in part;
}

/**
 * Check if a TaskState is terminal (no further transitions allowed).
 */
export function isTerminalState(state: TaskState): boolean {
  return TERMINAL_STATES.has(state);
}

/**
 * Check if a TaskState is interrupted (can resume to WORKING).
 */
export function isInterruptedState(state: TaskState): boolean {
  return INTERRUPTED_STATES.has(state);
}
