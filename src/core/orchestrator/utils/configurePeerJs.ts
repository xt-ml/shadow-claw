import { CONFIG_KEYS } from "../../../config/config.js";
import { setConfig } from "../../../db/setConfig.js";
import { normalizeStringList } from "./normalizeStringList.js";

import type { ShadowClawDatabase } from "../../../db/db.js";
import type { Orchestrator } from "../orchestrator.js";

export async function configurePeerJs(
  orchestrator: Orchestrator,
  db: ShadowClawDatabase,
  myPeerId: string,
  trustedPeerIds: string[],
  serverHost = "",
  serverPort = 0,
  serverPath = "",
  serverSecure = true,
): Promise<void> {
  const normalizedMyPeerId = myPeerId.trim();
  const normalizedTrustedPeerIds = normalizeStringList(trustedPeerIds);
  const normalizedServerHost = serverHost.trim();
  const normalizedServerPort = Number.isFinite(serverPort)
    ? Math.max(0, Math.floor(serverPort))
    : 0;

  const normalizedServerPath = serverPath.trim();
  const normalizedServerSecure = !!serverSecure;

  orchestrator.peerjsMyPeerId = normalizedMyPeerId;
  orchestrator.peerjsTrustedPeerIds = normalizedTrustedPeerIds;
  orchestrator.peerjsServerHost = normalizedServerHost;
  orchestrator.peerjsServerPort = normalizedServerPort;
  orchestrator.peerjsServerPath = normalizedServerPath;
  orchestrator.peerjsServerSecure = normalizedServerSecure;

  await setConfig(db, CONFIG_KEYS.PEERJS_MY_PEER_ID, normalizedMyPeerId);
  await setConfig(
    db,
    CONFIG_KEYS.PEERJS_TRUSTED_PEER_IDS,
    JSON.stringify(normalizedTrustedPeerIds),
  );

  await setConfig(db, CONFIG_KEYS.PEERJS_SERVER_HOST, normalizedServerHost);
  await setConfig(
    db,
    CONFIG_KEYS.PEERJS_SERVER_PORT,
    normalizedServerPort ? String(normalizedServerPort) : "",
  );

  await setConfig(db, CONFIG_KEYS.PEERJS_SERVER_PATH, normalizedServerPath);
  await setConfig(
    db,
    CONFIG_KEYS.PEERJS_SERVER_SECURE,
    normalizedServerSecure ? "true" : "false",
  );

  const serverConfig = normalizedServerHost
    ? {
        host: normalizedServerHost,
        path: normalizedServerPath || undefined,
        port: normalizedServerPort || undefined,
        secure: normalizedServerSecure,
      }
    : {};

  orchestrator.peerjs.stop();
  orchestrator.peerjs.configure(
    normalizedMyPeerId,
    normalizedTrustedPeerIds,
    serverConfig,
  );

  if (normalizedMyPeerId && orchestrator.getChannelEnabled("peerjs")) {
    orchestrator.peerjs.start();
  }
}
