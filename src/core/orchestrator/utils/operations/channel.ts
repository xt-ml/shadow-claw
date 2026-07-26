import { CONFIG_KEYS, DEFAULT_GROUP_ID } from "../../../../config/config.js";
import { getConfig as _defaultGetConfig } from "../../../../db/getConfig.js";
import { setConfig as _defaultSetConfig } from "../../../../db/setConfig.js";
import { encryptValue } from "../../../../security/crypto.js";
import { orchestratorStore } from "../../../../stores/orchestrator.js";
import { normalizeStringList } from "../normalizeStringList.js";

import type { MessageAttachment } from "../../../../content/types.js";
import type { ShadowClawDatabase } from "../../../../db/db.js";

import type {
  Channel,
  ChannelType,
} from "../../../../subsystems/channels/types.js";

import type { A2UIAction } from "../../../../ui/a2ui/types.js";
import type { OrchestratorState } from "../../orchestrator-state.js";

type SetConfigFn = (
  db: ShadowClawDatabase,
  key: string,
  value: string,
) => Promise<void>;

type GetConfigFn = (
  db: ShadowClawDatabase,
  key: string,
) => Promise<string | undefined>;

// ── Pure channel lookups ────────────────────────────────────────────────────

export function getChannelTypeForGroup(
  state: {
    channelRegistry?: {
      getChannelType: (groupId: string) => ChannelType | null | undefined;
    };
  },
  groupId: string,
): ChannelType {
  return state.channelRegistry?.getChannelType(groupId) ?? "browser";
}

export function getChannelByType(
  state: Pick<
    OrchestratorState,
    "browserChat" | "telegram" | "imessage" | "peerjs"
  >,
  channelType: ChannelType,
): Channel | null {
  switch (channelType) {
    case "browser":
      return state.browserChat;
    case "telegram":
      return state.telegram;
    case "imessage":
      return state.imessage;
    case "peerjs":
      return state.peerjs;
    default:
      return null;
  }
}

export function getChannelEnabled(
  state: Pick<OrchestratorState, "channelEnabledByType">,
  channelType: ChannelType,
): boolean {
  if (channelType === "browser") {
    return true;
  }

  return state.channelEnabledByType[channelType] !== false;
}

export function getPeerJsConfig(state: {
  channelEnabledByType: Record<ChannelType, boolean>;
  peerjsMyAlias: string;
  peerjsMyPeerId: string;
  peerjsPeerAliases: Record<string, string>;
  peerjsServerHost: string;
  peerjsServerPath: string;
  peerjsServerPort: number;
  peerjsServerSecure: boolean;
  peerjsTrustedPeerIds: string[];
}): {
  enabled: boolean;
  myAlias: string;
  myPeerId: string;
  peerAliases: Record<string, string>;
  serverHost: string;
  serverPath: string;
  serverPort: number;
  serverSecure: boolean;
  trustedPeerIds: string[];
} {
  return {
    enabled: getChannelEnabled(state, "peerjs"),
    myAlias: state.peerjsMyAlias,
    myPeerId: state.peerjsMyPeerId,
    peerAliases: { ...state.peerjsPeerAliases },
    serverHost: state.peerjsServerHost,
    serverPath: state.peerjsServerPath,
    serverPort: state.peerjsServerPort,
    serverSecure: state.peerjsServerSecure,
    trustedPeerIds: [...state.peerjsTrustedPeerIds],
  };
}

export function getTelegramConfig(state: {
  telegramBotToken: string;
  telegramChatIds: string[];
  channelEnabledByType: Record<ChannelType, boolean>;
  telegramUseProxy: boolean;
}): {
  botToken: string;
  chatIds: string[];
  enabled: boolean;
  useProxy: boolean;
} {
  return {
    botToken: state.telegramBotToken,
    chatIds: [...state.telegramChatIds],
    enabled: getChannelEnabled(state, "telegram"),
    useProxy: state.telegramUseProxy,
  };
}

export function getIMessageConfig(state: {
  imessageApiKey: string;
  imessageChatIds: string[];
  channelEnabledByType: Record<ChannelType, boolean>;
  imessageServerUrl: string;
}): {
  apiKey: string;
  chatIds: string[];
  enabled: boolean;
  serverUrl: string;
} {
  return {
    apiKey: state.imessageApiKey,
    chatIds: [...state.imessageChatIds],
    enabled: getChannelEnabled(state, "imessage"),
    serverUrl: state.imessageServerUrl,
  };
}

export function getChannelEnabledConfigKey(channelType: ChannelType): string {
  return `${CONFIG_KEYS.CHANNEL_ENABLED_PREFIX}${channelType}`;
}

export function shouldRunChannel(
  state: Pick<
    OrchestratorState,
    | "channelEnabledByType"
    | "telegramBotToken"
    | "imessageServerUrl"
    | "peerjsMyPeerId"
  >,
  channelType: ChannelType,
): boolean {
  if (channelType === "browser") {
    return true;
  }

  if (!getChannelEnabled(state, channelType)) {
    return false;
  }

  switch (channelType) {
    case "telegram":
      return state.telegramBotToken.length > 0;
    case "imessage":
      return state.imessageServerUrl.length > 0;
    case "peerjs":
      return state.peerjsMyPeerId.length > 0;
    default:
      return true;
  }
}

export function applyChannelRunningState(
  state: Pick<
    OrchestratorState,
    | "browserChat"
    | "telegram"
    | "imessage"
    | "peerjs"
    | "channelEnabledByType"
    | "telegramBotToken"
    | "imessageServerUrl"
    | "peerjsMyPeerId"
  >,
  channelType: ChannelType,
): void {
  const channel = getChannelByType(state, channelType);
  if (!channel) {
    return;
  }

  if (shouldRunChannel(state, channelType)) {
    channel.start();

    return;
  }

  channel.stop();
}

export function applyAllChannelRunningStates(
  state: Pick<
    OrchestratorState,
    | "browserChat"
    | "telegram"
    | "imessage"
    | "peerjs"
    | "channelEnabledByType"
    | "telegramBotToken"
    | "imessageServerUrl"
    | "peerjsMyPeerId"
  >,
): void {
  applyChannelRunningState(state, "browser");
  applyChannelRunningState(state, "telegram");
  applyChannelRunningState(state, "imessage");
  applyChannelRunningState(state, "peerjs");
}

export function clearPeerJsTypingState(groupId: string): void {
  orchestratorStore.setRemoteAgentTyping(groupId, false);
}

// ── Async channel operations ────────────────────────────────────────────────

export async function loadChannelEnabled(
  channelType: ChannelType,
  db: ShadowClawDatabase,
  _getConfig: GetConfigFn = _defaultGetConfig,
): Promise<boolean> {
  const stored = await _getConfig(db, getChannelEnabledConfigKey(channelType));

  if (!stored) {
    return false;
  }

  return stored !== "false";
}

export async function setChannelEnabled(
  state: Pick<
    OrchestratorState,
    | "channelEnabledByType"
    | "browserChat"
    | "telegram"
    | "imessage"
    | "peerjs"
    | "telegramBotToken"
    | "imessageServerUrl"
    | "peerjsMyPeerId"
  >,
  db: ShadowClawDatabase,
  channelType: ChannelType,
  enabled: boolean,
  _setConfig: SetConfigFn = _defaultSetConfig,
): Promise<void> {
  if (channelType === "browser") {
    return;
  }

  const normalizedEnabled = !!enabled;
  state.channelEnabledByType[channelType] = normalizedEnabled;

  await _setConfig(
    db,
    getChannelEnabledConfigKey(channelType),
    normalizedEnabled ? "true" : "false",
  );

  applyChannelRunningState(state, channelType);
}

export function submitMessage(
  state: {
    browserChat: {
      submit: (
        text: string,
        groupId?: string,
        attachments?: MessageAttachment[],
        a2uiAction?: A2UIAction,
      ) => void;
    };
  },
  text: string,
  groupId = DEFAULT_GROUP_ID,
  attachments: MessageAttachment[] = [],
  a2uiAction?: A2UIAction,
): void {
  state.browserChat.submit(text, groupId, attachments, a2uiAction);
}

export async function saveSecretConfig(
  db: ShadowClawDatabase,
  key: string,
  value: string,
  _setConfig: SetConfigFn = _defaultSetConfig,
): Promise<void> {
  if (!value) {
    await _setConfig(db, key, "");

    return;
  }

  const encrypted = await encryptValue(value);
  if (!encrypted) {
    throw new Error(`Failed to encrypt secret config for ${key}`);
  }

  await _setConfig(db, key, encrypted);
}

export async function configureIMessage(
  state: OrchestratorState,
  db: ShadowClawDatabase,
  serverUrl: string,
  apiKey: string,
  chatIds: string[],
  _setConfig: SetConfigFn = _defaultSetConfig,
  _saveSecretConfig: typeof saveSecretConfig = saveSecretConfig,
): Promise<void> {
  const normalizedServerUrl = serverUrl.trim().replace(/\/+$/, "");
  const normalizedApiKey = apiKey.trim();
  const normalizedChatIds = normalizeStringList(chatIds);

  state.imessageServerUrl = normalizedServerUrl;
  state.imessageApiKey = normalizedApiKey;
  state.imessageChatIds = normalizedChatIds;

  await _setConfig(db, CONFIG_KEYS.IMESSAGE_SERVER_URL, normalizedServerUrl);
  await _saveSecretConfig(db, CONFIG_KEYS.IMESSAGE_API_KEY, normalizedApiKey);

  await _setConfig(
    db,
    CONFIG_KEYS.IMESSAGE_CHAT_IDS,
    JSON.stringify(normalizedChatIds),
  );

  state.imessage.stop();
  state.imessage.configure(
    normalizedServerUrl,
    normalizedApiKey,
    normalizedChatIds,
  );

  if (normalizedServerUrl && getChannelEnabled(state, "imessage")) {
    state.imessage.start();
  }
}

export async function configureTelegram(
  state: OrchestratorState,
  db: ShadowClawDatabase,
  token: string,
  chatIds: string[],
  useProxy = false,
  _setConfig: SetConfigFn = _defaultSetConfig,
  _saveSecretConfig: typeof saveSecretConfig = saveSecretConfig,
): Promise<void> {
  const normalizedToken = token.trim();
  const normalizedChatIds = normalizeStringList(chatIds);
  const normalizedUseProxy = !!useProxy;

  state.telegramBotToken = normalizedToken;
  state.telegramChatIds = normalizedChatIds;
  state.telegramUseProxy = normalizedUseProxy;

  await _saveSecretConfig(db, CONFIG_KEYS.TELEGRAM_BOT_TOKEN, normalizedToken);

  await _setConfig(
    db,
    CONFIG_KEYS.TELEGRAM_CHAT_IDS,
    JSON.stringify(normalizedChatIds),
  );

  await _setConfig(
    db,
    CONFIG_KEYS.TELEGRAM_USE_PROXY,
    normalizedUseProxy ? "true" : "false",
  );

  state.telegram.stop();
  state.telegram.configure(
    normalizedToken,
    normalizedChatIds,
    normalizedUseProxy,
  );

  if (normalizedToken && getChannelEnabled(state, "telegram")) {
    state.telegram.start();
  }
}
