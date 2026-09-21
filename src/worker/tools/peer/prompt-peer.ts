import { ShadowClawDatabase } from "../../../db/types.js";

export interface PeerControlClient {
  sendCommand(
    peerId: string,
    command: string,
    payload: any,
    timeoutMs?: number,
  ): Promise<any>;
  listClients(): Promise<any[]>;
}

export type PeerClientFactory = () => PeerControlClient;

let _peerClientFactory: PeerClientFactory | null = null;

export function setPeerClientFactory(factory: PeerClientFactory | null): void {
  _peerClientFactory = factory;
}

export function getPeerClient(): PeerControlClient | null {
  if (_peerClientFactory) {
    return _peerClientFactory();
  }
  const globalFactory = (globalThis as any).__peerClientFactory;
  if (typeof globalFactory === "function") {
    return globalFactory();
  }
  return null;
}

export async function executePromptPeer(
  _db: ShadowClawDatabase,
  input: Record<string, any>,
  _groupId: string,
): Promise<string> {
  const peerId = typeof input.peer_id === "string" ? input.peer_id.trim() : "";
  if (!peerId) {
    return "Error: prompt_peer requires a valid peer_id string.";
  }

  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  if (!prompt) {
    return "Error: prompt_peer requires a non-empty prompt string.";
  }

  const timeoutMs = input.timeout_seconds
    ? Number(input.timeout_seconds) * 1000
    : 120000;

  const client = getPeerClient();
  if (!client) {
    return "Error: prompt_peer is currently only supported in headless CLI mode or when a peer client is configured.";
  }

  try {
    const targetPeerId = peerId.startsWith("peer:") ? peerId.slice(5) : peerId;

    const result = await client.sendCommand(
      targetPeerId,
      "send-message",
      { text: prompt },
      timeoutMs,
    );

    if (result && result.success) {
      const reply =
        result.data?.reply ||
        result.data?.text ||
        (typeof result.data === "string"
          ? result.data
          : JSON.stringify(result.data));
      return reply || "Prompt sent successfully (no text response received).";
    }

    return `Error from peer: ${result?.error || "Unknown error occurred while prompting peer."}`;
  } catch (err: any) {
    return `Error prompting peer ${peerId}: ${err?.message || String(err)}`;
  }
}

export async function executeListPeers(
  _db: ShadowClawDatabase,
  _input: Record<string, any>,
  _groupId: string,
): Promise<string> {
  const client = getPeerClient();
  if (!client) {
    return "Error: list_peers is currently only supported in headless CLI mode or when a peer client is configured.";
  }

  try {
    const clients = await client.listClients();

    if (!clients || clients.length === 0) {
      return "No connected peers found. Ensure the listener is active and peers have connected.";
    }

    const lines = clients.map((c: any) => {
      const label = c.deviceLabel ? ` (${c.deviceLabel})` : "";
      return `- ${c.clientId}${label}`;
    });

    return `Connected peers (${clients.length}):\n${lines.join("\n")}`;
  } catch (err: any) {
    return `Error listing peers: ${err?.message || String(err)}`;
  }
}
