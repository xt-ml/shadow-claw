/**
 * AgentCard construction and exchange logic for A2A peer protocol.
 *
 * An AgentCard is exchanged immediately when a WebRTC DataChannel opens,
 * providing capability discovery between peers. It is constructed from
 * the local agent's configuration (name, model, tools).
 *
 * References:
 * - A2A spec §4.4 (Agent Discovery)
 * - ADR: docs/decisions/peer-protocol-a2a-agui.md
 */

import type {
  AgentCard,
  AgentInterface,
  AgentCapabilities,
  AgentSkill,
  A2AJsonRpcRequest,
  A2AJsonRpcResponse,
} from "./peer-protocol.js";

import {
  A2A_PROTOCOL_BINDING,
  A2A_PROTOCOL_VERSION,
  A2A_METHOD,
} from "./peer-protocol.js";
import { ulid } from "../../utils/ulid.js";

// =============================================================================
// Agent Card Builder
// =============================================================================

export interface AgentCardOptions {
  /** Local peer ID (used to construct the interface URL) */
  peerId: string;
  /** Display name for this agent */
  name: string;
  /** Short description of what this agent does */
  description?: string;
  /** Application version */
  version?: string;
  /** Skills/capabilities this agent advertises */
  skills?: AgentSkill[];
  /** Whether streaming is supported */
  streaming?: boolean;
  /** Icon URL (optional) */
  iconUrl?: string;
}

/**
 * Build an AgentCard from local configuration.
 */
export function buildAgentCard(options: AgentCardOptions): AgentCard {
  const iface: AgentInterface = {
    url: `webrtc://${options.peerId}`,
    protocolBinding: A2A_PROTOCOL_BINDING,
    protocolVersion: A2A_PROTOCOL_VERSION,
  };

  const capabilities: AgentCapabilities = {
    streaming: options.streaming ?? true,
    pushNotifications: false, // WebRTC DataChannel handles real-time delivery
  };

  return {
    name: options.name,
    description: options.description ?? `AI assistant agent (${options.name})`,
    version: options.version ?? "1.0.0",
    supportedInterfaces: [iface],
    capabilities,
    defaultInputModes: ["text/plain", "application/json"],
    defaultOutputModes: ["text/plain", "application/json"],
    skills: options.skills ?? [],
    iconUrl: options.iconUrl,
  };
}

// =============================================================================
// Agent Card Exchange Protocol
// =============================================================================

/**
 * Create a GetAgentCard JSON-RPC request.
 */
export function createGetAgentCardRequest(): A2AJsonRpcRequest {
  return {
    jsonrpc: "2.0",
    id: ulid(),
    method: A2A_METHOD.GET_AGENT_CARD,
  };
}

/**
 * Create a GetAgentCard JSON-RPC response with the local agent card.
 */
export function createGetAgentCardResponse(
  requestId: string,
  card: AgentCard,
): A2AJsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id: requestId,
    result: card,
  };
}

/**
 * Parse a GetAgentCard response to extract the remote agent card.
 * Returns null if the response is malformed.
 */
export function parseAgentCardResponse(
  response: A2AJsonRpcResponse,
): AgentCard | null {
  if (response.error) {
    console.warn("GetAgentCard returned error:", response.error);

    return null;
  }

  const result = response.result as Record<string, unknown> | undefined;
  if (!result || typeof result !== "object") {
    return null;
  }

  // Validate minimum required fields
  if (typeof result.name !== "string" || typeof result.version !== "string") {
    return null;
  }

  return result as unknown as AgentCard;
}

// =============================================================================
// Peer Card Store (per-connection)
// =============================================================================

/**
 * Stores remote agent cards received from peers.
 * Keyed by remote peer ID.
 */
export class PeerCardStore {
  private _cards = new Map<string, AgentCard>();

  /** Clear all stored cards */
  clear(): void {
    this._cards.clear();
  }

  /** Remove a peer's card (on disconnect) */
  delete(peerId: string): void {
    this._cards.delete(peerId);
  }

  /** Get all stored cards */
  entries(): IterableIterator<[string, AgentCard]> {
    return this._cards.entries();
  }

  /** Retrieve a remote peer's agent card */
  get(peerId: string): AgentCard | undefined {
    return this._cards.get(peerId);
  }

  /** Get the display name for a peer (falls back to peer ID) */
  getDisplayName(peerId: string): string {
    const card = this._cards.get(peerId);

    return card?.name ?? peerId;
  }

  /** Check if we have a card for a peer */
  has(peerId: string): boolean {
    return this._cards.has(peerId);
  }

  /** Store a remote peer's agent card */
  set(peerId: string, card: AgentCard): void {
    this._cards.set(peerId, card);
  }

  /** Check if a peer supports streaming */
  supportsStreaming(peerId: string): boolean {
    const card = this._cards.get(peerId);

    return card?.capabilities?.streaming ?? false;
  }
}
