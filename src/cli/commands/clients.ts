/**
 * ShadowClaw CLI — `clients` command
 * Lists connected clients and their capabilities.
 */

import { CliControlClient } from "../utils/control-client.js";

export async function runClientsCommand(
  options: Record<string, any> = {},
): Promise<void> {
  const client = new CliControlClient(options);
  try {
    const clients = await client.listClients();

    if (!clients || clients.length === 0) {
      console.log("No clients currently registered or connected.");
      return;
    }

    console.log(`Connected / registered clients (${clients.length}):\n`);
    clients.forEach((c: any, idx: number) => {
      const lastSeenSec = Math.max(
        0,
        Math.floor((Date.now() - c.lastSeen) / 1000),
      );
      const lastSeenStr =
        lastSeenSec < 60
          ? `${lastSeenSec}s ago`
          : `${Math.floor(lastSeenSec / 60)}m ago`;

      console.log(`  ${idx + 1}. ${c.deviceLabel} (id: ${c.clientId})`);
      if (c.peerId) {
        console.log(`     Peer ID:      ${c.peerId}`);
      }
      console.log(`     Capabilities: ${c.capabilities.join(", ") || "none"}`);
      console.log(`     Version:      ${c.version}`);
      console.log(`     Last seen:    ${lastSeenStr}\n`);
    });
  } catch (err: any) {
    console.error(`Error fetching clients: ${err.message}`);
    process.exitCode = 1;
  }
}
