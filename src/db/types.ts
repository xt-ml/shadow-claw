import type {
  ConversationMessage,
  MessageAttachment,
} from "../content/types.js";

import type { ChannelType } from "../subsystems/channels/types.js";
import type { A2UIAction, A2UIEnvelope } from "../ui/a2ui/types.js";

export type ShadowClawDatabase = IDBDatabase | null;

export interface ConfigEntry {
  value: string; // JSON-encoded or raw string
  key: string;
}

export interface GroupMeta {
  createdAt: number;
  groupId: string;
  name: string;
  pinnedMaxTokens?: number;
  pinnedModel?: string;
  pinnedProvider?: string;
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
  subagentModelSelectionMode?: "automatic" | "manual";
  subagentMaxTokens?: number;
  subagentPinnedModel?: string;
  subagentPinnedProvider?: string;
  /** Automatic-mode model profile slots configured by the user. */
  subagentFastProvider?: string;
  subagentFastModel?: string;
  subagentSmartProvider?: string;
  subagentSmartModel?: string;
  subagentPowerfulProvider?: string;
  subagentPowerfulModel?: string;
  toolTags?: string[];
}

export interface SavedPageRef {
  groupId: string;
  path: string;
}

export interface Session {
  groupId: string;
  messages: ConversationMessage[];
  updatedAt: number;
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
  freshContext?: boolean;
  subagent?: boolean;
}

export interface Task {
  createdAt: number;
  enabled: boolean;
  groupId: string;
  id: string;
  lastRun: number | null;
  prompt: string;
  schedule?: string;
  tools?: TaskToolCall[];
  type?: "prompt" | "tools";
  freshContext?: boolean;
  subagent?: boolean;
  name?: string;
  order?: number;
}

export interface TaskToolCall {
  input: Record<string, any>;
  name: string;
  suppressOutput?: boolean;
  suppressToast?: boolean;
}
