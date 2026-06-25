/*
import type { ShadowClaw } from "./components/shadow-claw/shadow-claw.js";
import type { Orchestrator } from "./orchestrator.js";
*/
import type { ToastType } from "./stores/toast.js";
import type { VMBootMode } from "./vm.js";
import type { A2UIEnvelope, A2UIAction } from "./a2ui.js";

// Re-export so callers can import from types.ts
export type { A2UIEnvelope, A2UIAction };

/*
import type {
  clearAllToasts,
  dismissToast,
  showError,
  showInfo,
  showSuccess,
  showToast,
  showWarning,
} from "./toast.js";
*/

import type { E2eBridge } from "./e2e-bridge.js";

// Extend the actual globalThis interface
declare global {
  interface Window {
    __SHADOWCLAW_E2E__?: E2eBridge;
    __SHADOWCLAW_E2E_ENABLE__?: boolean;
  }
}

export interface ConfirmationDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface AppDialogLink {
  label: string;
  href: string;
}

export interface AppDialogOptions extends ConfirmationDialogOptions {
  mode?: "confirm" | "info";
  details?: string[];
  links?: AppDialogLink[];
}

export type KnownChannelType =
  | "browser"
  | "telegram"
  | "imessage"
  | "peerjs"
  | "room";

export type ChannelType = KnownChannelType | (string & {});

/**
 * A participant in a multi-party room. May be a human (using their own
 * ShadowClaw instance) or an AI agent.
 */
export interface RoomMember {
  /** PeerJS peer ID used as the network identity for this member. */
  peerId: string;
  /** Human-readable display name for the member. */
  alias: string;
  /** Whether this member participates as a human or an AI agent. */
  kind: "human" | "agent";
  /** Optional assistant name when {@link kind} is "agent" (used for @mentions). */
  agentName?: string;
}

/**
 * Metadata for a multi-party "room" conversation. A room is layered on top of
 * a {@link GroupMeta} whose groupId is `room:<roomId>`; this record tracks the
 * host and participant roster separately.
 */
export interface RoomMeta {
  /** Bare room id. The conversation groupId is `room:<roomId>`. */
  roomId: string;
  /** Human-readable room name. */
  name: string;
  /** Peer ID of the room host (creator) that maintains the authoritative roster. */
  hostPeerId: string;
  /** Current participant roster. */
  members: RoomMember[];
  /** Epoch ms when the room was created. */
  createdAt: number;
}

export interface RemoteUrlAttachmentSource {
  kind: "remote-url";
  url: string;
  headers?: Record<string, string>;
}

export interface LocalFileAttachmentSource {
  kind: "local-file";
  file: Blob;
}

export interface InlineTextAttachmentSource {
  kind: "inline-text";
  text: string;
  mimeType?: string;
}

export type MessageAttachmentSource =
  | RemoteUrlAttachmentSource
  | LocalFileAttachmentSource
  | InlineTextAttachmentSource;

export interface MessageAttachment {
  id?: string;
  fileName: string;
  mimeType?: string;
  size?: number;
  path?: string;
  previewDisposition?: "inline" | "file";
  source?: MessageAttachmentSource;
}

export interface InboundMessage {
  id: string;
  groupId: string; // e.g., "br:main"
  sender: string;
  content: string;
  timestamp: number; // epoch ms
  channel: ChannelType;
  attachments?: MessageAttachment[];
  /** A2UI surface envelopes received in this message (peer channel only) */
  a2uiEnvelopes?: A2UIEnvelope[];
  /** A2UI action dispatched by the remote peer's UI (peer channel only) */
  a2uiAction?: A2UIAction;
  /** A2A task ID for peer protocol task lifecycle tracking */
  taskId?: string;
  /** A2A context ID for peer protocol conversation threading */
  contextId?: string;
}

export interface StoredMessage {
  id: string;
  groupId: string;
  sender: string;
  content: string;
  timestamp: number;
  channel: ChannelType;
  isFromMe: boolean;
  isTrigger: boolean;
  attachments?: MessageAttachment[];
  a2uiEnvelopes?: A2UIEnvelope[];
  a2uiAction?: A2UIAction;
}

export interface TaskToolCall {
  name: string;
  input: Record<string, any>;
  suppressOutput?: boolean;
}

export interface Task {
  id: string;
  groupId: string;
  schedule?: string; // cron expression, optional for unscheduled tasks

  type?: "prompt" | "tools";
  prompt: string;
  tools?: TaskToolCall[];

  enabled: boolean;

  lastRun: number | null;
  createdAt: number;
}

export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string | ContentBlock[];
}

export interface Session {
  groupId: string;
  messages: ConversationMessage[];
  updatedAt: number;
}

export interface TextContent {
  type: "text";
  text: string;
}

export interface ToolUseContent {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, any>;
}

export interface ToolResultContent {
  type: "tool_result";
  tool_use_id: string;
  content: string;
}

export interface AttachmentContent {
  type: "attachment";
  mediaType: "image" | "audio" | "video" | "document" | "file";
  fileName: string;
  mimeType: string;
  size?: number;
  path?: string;
  data?: string;
}

export type ContentBlock =
  | TextContent
  | ToolUseContent
  | ToolResultContent
  | AttachmentContent;

export interface ConfigEntry {
  key: string;
  value: string; // JSON-encoded or raw string
}

export type ShadowClawDatabase = IDBDatabase | null;

export interface GroupMeta {
  groupId: string;
  name: string;
  createdAt: number;
  toolTags?: string[];
  pinnedProvider?: string;
  pinnedModel?: string;
}

export interface SavedPageRef {
  groupId: string;
  path: string;
}

export type ChannelMessageCallback = (msg: InboundMessage) => void;

export type ChannelTypingCallback = (groupId: string, typing: boolean) => void;

export type ChannelDisplayCallback = (
  groupId: string,
  text: string,
  isFromMe: boolean,
) => void;

export interface ChannelRegistrationOptions {
  badge?: string;
  autoTrigger?: boolean;
}

export interface Channel {
  type: ChannelType;
  start(): void;
  stop(): void;
  send(
    groupId: string,
    text: string,
    attachments?: MessageAttachment[],
  ): Promise<void>;
  setTyping(groupId: string, typing: boolean): void;
  onMessage(callback: ChannelMessageCallback): void;
  onTyping?(callback: ChannelTypingCallback): void;
}

export interface InvokePayload {
  groupId: string;
  messages: ConversationMessage[];
  systemPrompt: string;
  assistantName: string;
  memory: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  maxIterations?: number;
  provider?: any;
  storageHandle?: any;
  enabledTools?: any;
  providerHeaders?: Record<string, string>;
  streaming?: boolean;
  contextCompression?: boolean;
  contextLimit?: number;
  rateLimitCallsPerMinute?: number;
  rateLimitAutoAdapt?: boolean;
}

export interface CompactPayload {
  groupId: string;
  messages: ConversationMessage[];
  systemPrompt: string;
  assistantName: string;
  memory: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  provider?: any;
  storageHandle?: any;
  providerHeaders?: Record<string, string>;
  contextCompression?: boolean;
  contextLimit?: number;
  rateLimitCallsPerMinute?: number;
  rateLimitAutoAdapt?: boolean;
}

export interface ResponsePayload {
  groupId: string;
  text: string;
}

export interface ErrorPayload {
  groupId: string;
  error: string;
}

export interface TypingPayload {
  groupId: string;
}

export interface ToolActivityPayload {
  groupId: string;
  tool: string;
  status: string;
}

export interface ModelDownloadProgressPayload {
  groupId: string;
  status: "running" | "done" | "error";
  progress: number | null; // 0..1 when known
  message?: string;
}

export interface ThinkingLogEntry {
  groupId: string;
  level: "info" | "api-call" | "tool" | "error";
  label: string;
  message: string;
  timestamp: number;
}

export interface TokenUsage {
  cacheCreationTokens: number;
  cacheReadTokens: number;
  contextLimit: number;
  groupId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ContextUsage {
  estimatedTokens: number; // Tokens used by conversation messages
  contextLimit: number; // Model's total context window (tokens)
  usagePercent: number; // Percentage of context budget used (0-100)
  truncatedCount: number; // Messages dropped from the beginning
}

export interface ToolActivity {
  tool: string;
  status: string;
}

export interface CompactDonePayload {
  groupId: string;
  summary: string;
}

export interface OpenFilePayload {
  groupId: string;
  path: string;
}

export interface VMStatusPayload {
  ready: boolean;
  booting: boolean;
  bootAttempted: boolean;
  error: string | null;
  mode?: "ext2" | "9p" | null;
}

export interface VMTerminalOutputPayload {
  chunk: string;
}

export interface VMTerminalErrorPayload {
  error: string;
}

export interface ManageToolsPayload {
  action: "enable" | "disable" | "activate_profile";
  toolNames?: string[];
  profileId?: string;
}

export interface LLMProvider {
  id: string;
  name: string;
  models?: string[];
  modelsUrl?: string;
  headers?: Record<string, string>;
  apiKeyHeader?: string;
  apiKeyHeaderFormat?: string;
  requiresApiKey?: boolean;
}

export type WorkerOutbound =
  | { type: "response"; payload: ResponsePayload }
  | { type: "error"; payload: ErrorPayload }
  | { type: "typing"; payload: TypingPayload }
  | { type: "tool-activity"; payload: ToolActivityPayload }
  | { type: "model-download-progress"; payload: ModelDownloadProgressPayload }
  | { type: "thinking-log"; payload: ThinkingLogEntry }
  | { type: "compact-done"; payload: CompactDonePayload }
  | { type: "open-file"; payload: OpenFilePayload }
  | { type: "vm-status"; payload: VMStatusPayload }
  | { type: "vm-terminal-opened"; payload: { ok: true } }
  | { type: "vm-terminal-output"; payload: VMTerminalOutputPayload }
  | { type: "vm-terminal-closed"; payload: { ok: true } }
  | { type: "vm-workspace-synced"; payload: { groupId: string } }
  | { type: "vm-terminal-error"; payload: VMTerminalErrorPayload }
  | {
      type: "show-toast";
      payload: {
        message: string;
        type?: ToastType;
        duration?: number;
      };
    }
  | { type: "manage-tools"; payload: ManageToolsPayload }
  | {
      type: "render-component";
      payload: {
        groupId: string;
        envelope: A2UIEnvelope;
      };
    };

export type WorkerInbound =
  | { type: "invoke"; payload: InvokePayload }
  | { type: "cancel"; payload: { groupId: string } }
  | { type: "compact"; payload: CompactPayload }
  | {
      type: "set-vm-mode";
      payload: {
        mode?: VMBootMode;
        bootHost?: string;
        networkRelayUrl?: string;
      };
    }
  | { type: "vm-terminal-open"; payload?: { groupId?: string } }
  | { type: "vm-terminal-input"; payload: { data: string } }
  | { type: "vm-terminal-close"; payload?: { groupId?: string } }
  | { type: "vm-workspace-sync"; payload?: { groupId?: string } }
  | { type: "vm-workspace-flush"; payload?: { groupId?: string } }
  | {
      type: "execute-direct-tool";
      payload: { groupId: string; name: string; input: Record<string, any> };
    }
  | {
      type: "execute-task-tools";
      payload: { groupId: string; tools: TaskToolCall[] };
    };
