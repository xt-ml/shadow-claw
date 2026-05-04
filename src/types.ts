import type { ShadowClaw } from "./components/shadow-claw/shadow-claw.js";
import type { Orchestrator } from "./orchestrator.js";
import type { ToastType } from "./stores/toast.js";
import type { VMBootMode } from "./vm.js";

import type {
  clearAllToasts,
  dismissToast,
  showError,
  showInfo,
  showSuccess,
  showToast,
  showWarning,
} from "./toast.js";

// Extend the actual globalThis interface
declare global {
  interface Window {
    shadowclaw: ShadowClawGlobal;
  }
}

export interface ShadowClawGlobal {
  orchestrator: Orchestrator;
  ui: ShadowClaw;
  requestDialog: (options: AppDialogOptions) => Promise<boolean>;
  requestConfirmation: (options: ConfirmationDialogOptions) => Promise<boolean>;
  showToast: typeof showToast;
  showSuccess: typeof showSuccess;
  showError: typeof showError;
  showWarning: typeof showWarning;
  showInfo: typeof showInfo;
  dismissToast: typeof dismissToast;
  clearAllToasts: typeof clearAllToasts;
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

export type KnownChannelType = "browser" | "telegram" | "imessage";

export type ChannelType = KnownChannelType | (string & {});

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
}

export interface Task {
  id: string;
  groupId: string;
  schedule: string; // cron expression
  prompt: string;
  isScript: boolean;
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
  send(groupId: string, text: string): Promise<void>;
  setTyping(groupId: string, typing: boolean): void;
  onMessage(callback: ChannelMessageCallback): void;
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
  | { type: "manage-tools"; payload: ManageToolsPayload };

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
  | { type: "vm-workspace-flush"; payload?: { groupId?: string } };
