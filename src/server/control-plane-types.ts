/**
 * ShadowClaw — Control Plane Protocol Types
 *
 * Shared message types for the WebSocket control-plane channel between
 * the Express server, CLI commands, and connected browser/Electron clients.
 */

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------

/** Every control-plane message is wrapped in this envelope. */
export interface ControlMessage {
  /** ULID or UUID for request/response correlation. */
  id: string;
  /** Message type discriminator. */
  type: string;
  /** For responses — the `id` of the originating request. */
  replyTo?: string;
  /** Type-specific payload. */
  payload: unknown;
}

// ---------------------------------------------------------------------------
// Client → Server messages
// ---------------------------------------------------------------------------

export type ControlPlaneTransport = "sse" | "websocket";

export interface ClientRegisterPayload {
  clientId: string;
  deviceLabel: string;
  capabilities: string[];
  version: string;
  transport?: ControlPlaneTransport;
  peerId?: string;
}

export interface ClientHeartbeatPayload {
  clientId: string;
  timestamp?: number;
}

export type HeartbeatPayload = ClientHeartbeatPayload;

export interface CommandResultPayload {
  commandId: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface BackupReadyPayload {
  clientId: string;
  groupId?: string;
  totalBytes: number;
  fileCount: number;
}

// ---------------------------------------------------------------------------
// Server → Client messages
// ---------------------------------------------------------------------------

export type CommandAction =
  | "send-message"
  | "list-tasks"
  | "trigger-backup"
  | "invoke-tool"
  | "read-state";

export interface CommandExecutePayload {
  commandId: string;
  action: CommandAction;
  args: Record<string, unknown>;
}

export interface BackupAckPayload {
  uploadUrl: string;
  token: string;
}

export interface BackupRecord {
  id: string;
  clientId: string;
  timestamp: number;
  fileCount: number;
  totalBytes: number;
  manifest?: unknown;
}

// ---------------------------------------------------------------------------
// Client info (stored in registry)
// ---------------------------------------------------------------------------

export interface ClientInfo {
  clientId: string;
  deviceLabel: string;
  capabilities: string[];
  version: string;
  transport?: ControlPlaneTransport;
  peerId?: string;
  connectedAt: number;
  lastSeen: number;
}

// ---------------------------------------------------------------------------
// Type discriminated unions for dispatch
// ---------------------------------------------------------------------------

export type ClientToServerType =
  | "client:register"
  | "client:heartbeat"
  | "command:result"
  | "backup:ready";

export type ServerToClientType =
  | "command:execute"
  | "backup:ack"
  | "server:registered"
  | "server:error";
