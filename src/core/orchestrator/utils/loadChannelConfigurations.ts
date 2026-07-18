import { CONFIG_KEYS } from "../../../config/config.js";

import { inferAttachmentMimeType } from "../../../content/message-attachments.js";
import { getConfig } from "../../../db/getConfig.js";
import { readGroupFileBytes } from "../../../storage/readGroupFileBytes.js";
import { parseStoredStringList } from "./parseStoredStringList.js";

import type { ShadowClawDatabase } from "../../../db/db.js";
import type { Orchestrator } from "../orchestrator.js";

export async function loadChannelConfigurations(
  orchestrator: Orchestrator,
  db: ShadowClawDatabase,
): Promise<void> {
  orchestrator.channelEnabledByType.telegram =
    await orchestrator.loadChannelEnabled(db, "telegram");

  orchestrator.channelEnabledByType.imessage =
    await orchestrator.loadChannelEnabled(db, "imessage");

  const telegramToken = await orchestrator.loadSecretConfig(
    db,
    CONFIG_KEYS.TELEGRAM_BOT_TOKEN,
  );

  const telegramChatIds = parseStoredStringList(
    await getConfig(db, CONFIG_KEYS.TELEGRAM_CHAT_IDS),
  );

  const telegramUseProxy =
    (await getConfig(db, CONFIG_KEYS.TELEGRAM_USE_PROXY)) === "true";

  orchestrator.telegramBotToken = telegramToken;
  orchestrator.telegramChatIds = telegramChatIds;
  orchestrator.telegramUseProxy = telegramUseProxy;
  orchestrator.telegram.configure(
    telegramToken,
    telegramChatIds,
    telegramUseProxy,
  );

  const readWorkspaceFileAsBlob = async (
    groupId: string,
    path: string,
  ): Promise<Blob | null> => {
    try {
      const bytes = await readGroupFileBytes(db, groupId, path);
      const blobBytes = new Uint8Array(bytes.byteLength);
      blobBytes.set(bytes);

      const fileName = path.split("/").pop() || path;
      const mimeType = inferAttachmentMimeType(fileName);

      return new Blob([blobBytes], { type: mimeType });
    } catch (err) {
      console.warn(`Orchestrator: channel fileReader failed for ${path}:`, err);

      return null;
    }
  };

  orchestrator.telegram.fileReader = readWorkspaceFileAsBlob;
  orchestrator.imessage.fileReader = readWorkspaceFileAsBlob;

  const imessageServerUrl = (
    (await getConfig(db, CONFIG_KEYS.IMESSAGE_SERVER_URL)) || ""
  )
    .trim()
    .replace(/\/+$/, "");

  const imessageApiKey = await orchestrator.loadSecretConfig(
    db,
    CONFIG_KEYS.IMESSAGE_API_KEY,
  );

  const imessageChatIds = parseStoredStringList(
    await getConfig(db, CONFIG_KEYS.IMESSAGE_CHAT_IDS),
  );

  orchestrator.imessageServerUrl = imessageServerUrl;
  orchestrator.imessageApiKey = imessageApiKey;
  orchestrator.imessageChatIds = imessageChatIds;
  orchestrator.imessage.configure(
    imessageServerUrl,
    imessageApiKey,
    imessageChatIds,
  );

  // ---- PeerJS ----
  orchestrator.channelEnabledByType.peerjs =
    await orchestrator.loadChannelEnabled(db, "peerjs");

  const peerjsMyPeerId = (
    (await getConfig(db, CONFIG_KEYS.PEERJS_MY_PEER_ID)) || ""
  ).trim();

  const peerjsTrustedPeerIds = parseStoredStringList(
    await getConfig(db, CONFIG_KEYS.PEERJS_TRUSTED_PEER_IDS),
  );

  const peerjsServerHost = (
    (await getConfig(db, CONFIG_KEYS.PEERJS_SERVER_HOST)) || ""
  ).trim();

  const peerjsServerPortRaw = await getConfig(
    db,
    CONFIG_KEYS.PEERJS_SERVER_PORT,
  );

  const peerjsServerPort = peerjsServerPortRaw
    ? parseInt(peerjsServerPortRaw, 10) || 0
    : 0;

  const peerjsServerPath = (
    (await getConfig(db, CONFIG_KEYS.PEERJS_SERVER_PATH)) || ""
  ).trim();

  const peerjsServerSecureRaw = await getConfig(
    db,
    CONFIG_KEYS.PEERJS_SERVER_SECURE,
  );

  const peerjsServerSecure = peerjsServerSecureRaw !== "false";

  let peerjsPeerAliases: Record<string, string> = {};

  const storedAliasesRaw = await getConfig(db, CONFIG_KEYS.PEERJS_PEER_ALIASES);

  if (storedAliasesRaw) {
    try {
      peerjsPeerAliases = JSON.parse(storedAliasesRaw);
    } catch (err) {
      console.warn("Failed to parse peerjs_peer_aliases", err);
    }
  }

  orchestrator.peerjsMyPeerId = peerjsMyPeerId;
  orchestrator.peerjsMyAlias = (
    (await getConfig(db, CONFIG_KEYS.PEERJS_MY_ALIAS)) || ""
  ).trim();

  orchestrator.peerjsTrustedPeerIds = peerjsTrustedPeerIds;
  orchestrator.peerjsPeerAliases = peerjsPeerAliases;
  orchestrator.peerjsServerHost = peerjsServerHost;
  orchestrator.peerjsServerPort = peerjsServerPort;
  orchestrator.peerjsServerPath = peerjsServerPath;
  orchestrator.peerjsServerSecure = peerjsServerSecure;

  const peerjsServerConfig = peerjsServerHost
    ? {
        host: peerjsServerHost,
        port: peerjsServerPort || undefined,
        path: peerjsServerPath || undefined,
        secure: peerjsServerSecure,
      }
    : {};

  orchestrator.peerjs.configure(
    peerjsMyPeerId,
    peerjsTrustedPeerIds,
    peerjsServerConfig,
  );
}
