import type { A2UIAction, A2UIEnvelope } from "./a2ui.js";

import {
  StoredCredentialAuthMode,
  StoredCredentialBase,
  StoredCredentialOAuthFields,
} from "./accounts/stored-credentials.js";

import type { E2eBridge } from "./e2e-bridge.js";
import type { ToastType } from "./stores/toast.js";
import type { VMBootMode } from "./vm.js";

// Re-export so callers can import from types.ts
export type { A2UIAction, A2UIEnvelope };

// Extend the actual globalThis interface
declare global {
  interface Window {
    __SHADOWCLAW_E2E__?: E2eBridge;
    __SHADOWCLAW_E2E_ENABLE__?: boolean;
  }
}

export interface ConfirmationDialogOptions {
  cancelLabel?: string;
  confirmLabel?: string;
  message: string;
  title: string;
}

export interface AppDialogLink {
  href: string;
  label: string;
}

export interface AppDialogOptions extends ConfirmationDialogOptions {
  details?: string[];
  mode?: "confirm" | "info";
  links?: AppDialogLink[];
}

export type KnownChannelType =
  | "browser"
  | "imessage"
  | "telegram"
  | "peerjs"
  | "room";

export type ChannelType = KnownChannelType | (string & {});

/**
 * A participant in a multi-party room. May be a human (using their own
 * ShadowClaw instance) or an AI agent.
 */
export interface RoomMember {
  /** Optional assistant name when {@link kind} is "agent" (used for @mentions). */
  agentName?: string;
  /** Human-readable display name for the member. */
  alias: string;
  /** PeerJS peer ID used as the network identity for this member. */
  peerId: string;
  /** Whether this member participates as a human or an AI agent. */
  kind: "human" | "agent";
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
  headers?: Record<string, string>;
  kind: "remote-url";
  url: string;
}

export interface LocalFileAttachmentSource {
  file: Blob;
  kind: "local-file";
}

export interface InlineTextAttachmentSource {
  kind: "inline-text";
  mimeType?: string;
  text: string;
}

export type MessageAttachmentSource =
  | InlineTextAttachmentSource
  | LocalFileAttachmentSource
  | RemoteUrlAttachmentSource;

export interface MessageAttachment {
  fileName: string;
  id?: string;
  mimeType?: string;
  path?: string;
  previewDisposition?: "inline" | "file";
  size?: number;
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
  a2uiAction?: A2UIAction;
  a2uiEnvelopes?: A2UIEnvelope[];
  attachments?: MessageAttachment[];
  channel: ChannelType;
  content: string;
  groupId: string;
  id: string;
  isFromMe: boolean;
  isTrigger: boolean;
  sender: string;
  timestamp: number;
}

export interface TaskToolCall {
  input: Record<string, any>;
  name: string;
  suppressOutput?: boolean;
}

export interface Task {
  createdAt: number;
  enabled: boolean;
  groupId: string;
  id: string;
  lastRun: number | null;
  prompt: string;
  schedule?: string; // cron expression, optional for unscheduled tasks
  tools?: TaskToolCall[];
  type?: "prompt" | "tools";
}

export interface ConversationMessage {
  content: string | ContentBlock[];
  role: "user" | "assistant" | "system";
}

export interface Session {
  groupId: string;
  messages: ConversationMessage[];
  updatedAt: number;
}

export interface TextContent {
  text: string;
  type: "text";
}

export interface ToolUseContent {
  id: string;
  input: Record<string, any>;
  name: string;
  type: "tool_use";
}

export interface ToolResultTextBlock {
  text: string;
  type: "text";
}

export interface ToolResultImageBlock {
  data: string;
  media_type: string;
  type: "image";
}

export type ToolResultContentBlock = ToolResultTextBlock | ToolResultImageBlock;

export interface ToolResultContent {
  content: string | ToolResultContentBlock[];
  tool_use_id: string;
  type: "tool_result";
}

export interface AttachmentContent {
  data?: string;
  fileName: string;
  mediaType: "image" | "audio" | "video" | "document" | "file";
  mimeType: string;
  path?: string;
  size?: number;
  type: "attachment";
}

export type ContentBlock =
  | AttachmentContent
  | TextContent
  | ToolResultContent
  | ToolUseContent;

export interface ConfigEntry {
  value: string; // JSON-encoded or raw string
  key: string;
}

export type ShadowClawDatabase = IDBDatabase | null;

export interface GroupMeta {
  createdAt: number;
  groupId: string;
  name: string;
  pinnedModel?: string;
  pinnedProvider?: string;
  toolTags?: string[];
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
  autoTrigger?: boolean;
  badge?: string;
}

export interface Channel {
  onMessage(callback: ChannelMessageCallback): void;
  onTyping?(callback: ChannelTypingCallback): void;
  send(
    groupId: string,
    text: string,
    attachments?: MessageAttachment[],
  ): Promise<void>;
  setTyping(groupId: string, typing: boolean): void;
  start(): void;
  stop(): void;
  type: ChannelType;
}

export interface InvokePayload {
  apiKey: string;
  assistantName: string;
  contextCompression?: boolean;
  contextLimit?: number;
  enabledTools?: any;
  groupId: string;
  maxIterations?: number;
  maxTokens: number;
  memory: string;
  messages: ConversationMessage[];
  model: string;
  provider?: any;
  providerHeaders?: Record<string, string>;
  rateLimitAutoAdapt?: boolean;
  rateLimitCallsPerMinute?: number;
  storageHandle?: any;
  streaming?: boolean;
  systemPrompt: string;
}

export interface CompactPayload {
  apiKey: string;
  assistantName: string;
  contextCompression?: boolean;
  contextLimit?: number;
  groupId: string;
  maxTokens: number;
  memory: string;
  messages: ConversationMessage[];
  model: string;
  provider?: any;
  providerHeaders?: Record<string, string>;
  rateLimitAutoAdapt?: boolean;
  rateLimitCallsPerMinute?: number;
  storageHandle?: any;
  systemPrompt: string;
}

export interface ResponsePayload {
  groupId: string;
  text: string;
}

export interface ErrorPayload {
  error: string;
  groupId: string;
}

export interface TypingPayload {
  groupId: string;
}

export interface ToolActivityPayload {
  groupId: string;
  status: string;
  tool: string;
}

export interface ModelDownloadProgressPayload {
  groupId: string;
  message?: string;
  progress: number | null; // 0..1 when known
  status: "running" | "done" | "error";
}

export interface ThinkingLogEntry {
  groupId: string;
  label: string;
  level: "info" | "api-call" | "tool" | "error";
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
  contextLimit: number; // Model's total context window (tokens)
  estimatedTokens: number; // Tokens used by conversation messages
  truncatedCount: number; // Messages dropped from the beginning
  usagePercent: number; // Percentage of context budget used (0-100)
}

export interface ToolActivity {
  status: string;
  tool: string;
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
  bootAttempted: boolean;
  booting: boolean;
  error: string | null;
  mode?: "ext2" | "9p" | null;
  ready: boolean;
}

export interface VMTerminalOutputPayload {
  chunk: string;
}

export interface VMTerminalErrorPayload {
  error: string;
}

export interface ManageToolsPayload {
  action: "enable" | "disable" | "activate_profile";
  profileId?: string;
  toolNames?: string[];
}

export interface LLMProvider {
  apiKeyHeader?: string;
  apiKeyHeaderFormat?: string;
  headers?: Record<string, string>;
  id: string;
  models?: string[];
  modelsUrl?: string;
  name: string;
  requiresApiKey?: boolean;
}

export type WorkerOutbound =
  | {
      type: "ask-user";
      payload: {
        groupId: string;
        id: string;
        options?: string[];
        question: string;
      };
    }
  | { type: "compact-done"; payload: CompactDonePayload }
  | { type: "error"; payload: ErrorPayload }
  | { type: "manage-tools"; payload: ManageToolsPayload }
  | { type: "model-download-progress"; payload: ModelDownloadProgressPayload }
  | {
      type: "open-file";
      payload:
        | OpenFilePayload
        | {
            type: "render-component";
            payload: {
              envelope: A2UIEnvelope;
              groupId: string;
            };
          };
    }
  | { type: "response"; payload: ResponsePayload }
  | {
      type: "show-toast";
      payload: {
        duration?: number;
        message: string;
        type?: ToastType;
      };
    }
  | { type: "thinking-log"; payload: ThinkingLogEntry }
  | { type: "tool-activity"; payload: ToolActivityPayload }
  | { type: "typing"; payload: TypingPayload }
  | { type: "vm-status"; payload: VMStatusPayload }
  | { type: "vm-terminal-closed"; payload: { ok: true } }
  | { type: "vm-terminal-error"; payload: VMTerminalErrorPayload }
  | { type: "vm-terminal-opened"; payload: { ok: true } }
  | { type: "vm-terminal-output"; payload: VMTerminalOutputPayload }
  | { type: "vm-workspace-synced"; payload: { groupId: string } };

export type WorkerInbound =
  | {
      type: "ask-user-response";
      payload: { id: string; response: string | null };
    }
  | { type: "cancel"; payload: { groupId: string } }
  | { type: "compact"; payload: CompactPayload }
  | {
      payload: { groupId: string; name: string; input: Record<string, any> };
      type: "execute-direct-tool";
    }
  | {
      type: "execute-task-tools";
      payload: { groupId: string; tools: TaskToolCall[] };
    }
  | { type: "invoke"; payload: InvokePayload }
  | {
      type: "set-vm-mode";
      payload: {
        mode?: VMBootMode;
        bootHost?: string;
        networkRelayUrl?: string;
      };
    }
  | { type: "vm-terminal-close"; payload?: { groupId?: string } }
  | { type: "vm-terminal-input"; payload: { data: string } }
  | { type: "vm-terminal-open"; payload?: { groupId?: string } }
  | { type: "vm-workspace-flush"; payload?: { groupId?: string } }
  | { type: "vm-workspace-sync"; payload?: { groupId?: string } };

export type GitAuthMode = StoredCredentialAuthMode;
export type GitProvider = "github" | "azure-devops" | "gitlab" | "generic";

export interface GitAccount
  extends StoredCredentialBase, StoredCredentialOAuthFields {
  authorEmail: string; // Commit author email (empty string to use global default)
  authorName: string; // Commit author name (empty string to use global default)
  password: string; // Encrypted password (empty string if not set)
  provider?: GitProvider; // Explicit provider type (auto-detected from hostPattern if omitted)
  username: string; // Plaintext username (empty string if not set)
}

export interface GitToolDeps {
  configKeys: {
    GIT_AUTHOR_EMAIL: string;
    GIT_AUTHOR_NAME: string;
    GIT_CORS_PROXY: string;
    GIT_PROXY_URL: string;
  };
  getConfig: (db: ShadowClawDatabase, key: string) => Promise<any>;
  getGroupDir: (
    db: ShadowClawDatabase,
    groupId: string,
  ) => Promise<FileSystemDirectoryHandle>;
  getProxyUrl: (
    pref: "local" | "public" | "custom",
    customUrl?: string,
  ) => string;
  getRemoteUrl: (input: {
    groupRoot?: FileSystemDirectoryHandle;
    remote?: string;
    repo: string;
  }) => Promise<any>;
  gitAdd: (input: any) => Promise<string>;
  gitBranch: (input: any) => Promise<string>;
  gitCheckout: (input: any) => Promise<string>;
  gitClone: (input: any) => Promise<string>;
  gitCommit: (input: any) => Promise<string>;
  gitConfig: (input: any) => Promise<string>;
  gitDeleteBranch: (input: any) => Promise<string>;
  gitDeleteRepo: (input: any) => Promise<string>;
  gitDiff: (input: any) => Promise<string>;
  gitFetch: (input: any) => Promise<string>;
  gitInit: (input: any) => Promise<string>;
  gitListBranches: (input: any) => Promise<string>;
  gitListRepos: (input: {
    groupRoot?: FileSystemDirectoryHandle;
  }) => Promise<string>;
  gitListTags: (input: any) => Promise<string>;
  gitLog: (input: any) => Promise<string>;
  gitMerge: (input: any) => Promise<string>;
  gitPull: (input: any) => Promise<string>;
  gitPush: (input: any) => Promise<string>;
  gitReadFileAtRef: (input: any) => Promise<string>;
  gitRemote: (input: any) => Promise<string>;
  gitReset: (input: any) => Promise<string>;
  gitShow: (input: any) => Promise<string>;
  gitStatus: (input: any) => Promise<string>;
  gitTag: (input: any) => Promise<string>;
  gitUnstage: (input: any) => Promise<string>;
  readGroupFile: (
    db: ShadowClawDatabase,
    groupId: string,
    path: string,
  ) => Promise<string>;
  resolveGitCredentials: (
    db: ShadowClawDatabase,
    url: any,
  ) => Promise<{
    authorEmail?: string;
    authorName?: string;
    password?: string;
    token?: string;
    username?: string;
  }>;
}

export interface ResolvedGitCredentials {
  accountId?: string;
  authMode?: GitAuthMode;
  authorEmail?: string;
  authorName?: string;
  hostPattern?: string; // Host pattern from the matched account
  password?: string;
  provider?: GitProvider; // Detected or explicit provider type
  reauthRequired?: boolean;
  token?: string;
  username?: string;
}

export interface ResolveGitCredentialsOptions {
  accountId?: string;
  authMode?: GitAuthMode;
  forceRefresh?: boolean;
}

export interface OAuthAccountLike {
  accessTokenExpiresAt?: number;
  id: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
  oauthCustomAuthorizeUrl?: string;
  oauthCustomRedirectUri?: string;
  oauthCustomTokenUrl?: string;
  oauthCustomUsePkce?: boolean;
  oauthProviderId?: string;
  refreshToken?: string;
  scopes?: string[];
  tokenType?: string;
}

export interface ReconnectMcpOAuthResult {
  error?: string;
  success: boolean;
}

export interface ReconnectMcpOAuthOptions {
  /** When true, only attempt a silent token refresh — do not open a popup. */
  silentOnly?: boolean;
}
