/**
 * A2A AgentCard builder for HTTP JSON-RPC 2.0 Binding.
 *
 * References:
 * - A2A v1.0 Spec §4.4 (Agent Discovery)
 * - ADR: docs/decisions/server-a2a-http-binding.md
 */

import type {
  AgentCard,
  AgentInterface,
  AgentCapabilities,
} from "../../subsystems/channels/peer-protocol.js";

import { A2A_PROTOCOL_VERSION } from "../../subsystems/channels/peer-protocol.js";

import {
  A2A_HTTP_PROTOCOL_BINDING,
  type HttpAgentCardOptions,
} from "./types.js";

export { A2A_HTTP_PROTOCOL_BINDING };

/**
 * Construct an A2A v1.0 AgentCard for the server's HTTP JSON-RPC interface.
 */
export function buildHttpAgentCard(options: HttpAgentCardOptions): AgentCard {
  const cleanBaseUrl = options.baseUrl.replace(/\/+$/, "");

  const iface: AgentInterface = {
    url: `${cleanBaseUrl}/a2a`,
    protocolBinding: A2A_HTTP_PROTOCOL_BINDING,
    protocolVersion: A2A_PROTOCOL_VERSION,
  };

  const capabilities: AgentCapabilities = {
    streaming: options.streaming ?? true,
    pushNotifications: options.pushNotifications ?? false,
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
    documentationUrl: options.documentationUrl,
  };
}
