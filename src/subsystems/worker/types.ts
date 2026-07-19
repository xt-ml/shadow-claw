
import type { A2UIEnvelope } from "../../ui/a2ui.js";
import type { ConversationMessage } from "../../content/types.js";
import type { TaskToolCall } from "../../db/types.js";import type { ToastType } from "../../stores/toast.js";
import type { VMBootMode } from "../../shell/vm.js";

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

export interface CompactDonePayload {
  groupId: string;
  summary: string;
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
  providerRuntimeOverrides?: {
    bedrock_proxy?: {
      authMode?: "provider_chain" | "sso";
      profile?: string;
      region?: string;
    };
    llamafile?: {
      host?: string;
      mode?: "cli" | "server";
      offline?: boolean;
      port?: number;
    };
  };
  reasoning?: {
    effort?: string;
  };
  rateLimitAutoAdapt?: boolean;
  rateLimitCallsPerMinute?: number;
  storageHandle?: any;
  systemPrompt: string;
  streaming?: boolean;
}

export interface ContextUsage {
  contextLimit: number;
  estimatedTokens: number;
  truncatedCount: number;
  usagePercent: number;
}

export interface ErrorPayload {
  error: string;
  groupId: string;
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
  providerRuntimeOverrides?: {
    bedrock_proxy?: {
      authMode?: "provider_chain" | "sso";
      profile?: string;
      region?: string;
    };
    llamafile?: {
      host?: string;
      mode?: "cli" | "server";
      offline?: boolean;
      port?: number;
    };
  };
  reasoning?: {
    effort?: string;
  };
  rateLimitAutoAdapt?: boolean;
  rateLimitCallsPerMinute?: number;
  storageHandle?: any;
  streaming?: boolean;
  subagentModelSelectionMode?: "automatic" | "manual";
  subagentMaxTokens?: number;
  subagentPinnedModel?: string;
  subagentPinnedProvider?: string;
  systemPrompt: string;
  workspaceGroupId?: string;
}

export interface ManageToolsPayload {
  action: "enable" | "disable" | "activate_profile";
  profileId?: string;
  toolNames?: string[];
}

export interface ModelDownloadProgressPayload {
  groupId: string;
  message?: string;
  progress: number | null;
  status: "running" | "done" | "error";
}

export interface OpenFilePayload {
  groupId: string;
  path: string;
}

export interface ResponsePayload {
  groupId: string;
  text: string;
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

export interface ToolActivity {
  status: string;
  tool: string;
}

export interface ToolActivityPayload {
  groupId: string;
  status: string;
  tool: string;
}

export interface ToolResultContentBlock {
  type: "image" | "text";
}

export interface TypingPayload {
  groupId: string;
}

export interface VMStatusPayload {
  bootAttempted: boolean;
  booting: boolean;
  error: string | null;
  mode?: "ext2" | "9p" | null;
  ready: boolean;
}

export interface VMTerminalErrorPayload {
  error: string;
}

export interface VMTerminalOutputPayload {
  chunk: string;
}
