/**
 * ShadowClaw CLI — `send` command
 * Dispatches a prompt / message to a connected client.
 */

import { CliControlClient } from "../utils/control-client.mjs";

export async function runSendCommand(message, options = {}) {
  if (!message || typeof message !== "string" || !message.trim()) {
    console.error("Error: Message cannot be empty.");
    process.exitCode = 1;
    return;
  }

  const client = new CliControlClient(options);
  try {
    let targetClientId = options.client;

    if (!targetClientId) {
      const clients = await client.listClients();
      if (!clients || clients.length === 0) {
        console.error("Error: No clients are connected.");
        process.exitCode = 1;
        return;
      }
      targetClientId = clients[0].clientId;
      console.log(
        `Targeting client: ${clients[0].deviceLabel} (${targetClientId})`,
      );
    }

    console.log(`Sending message to ${targetClientId}...`);
    const result = await client.sendCommand(targetClientId, "send-message", {
      text: message.trim(),
      groupId: options.group,
    });

    if (result.success) {
      console.log("Message successfully dispatched.");
      if (result.data) {
        console.log(JSON.stringify(result.data, null, 2));
      }
    } else {
      console.error(`Error from client: ${result.error}`);
      process.exitCode = 1;
    }
  } catch (err) {
    console.error(`Error sending message: ${err.message}`);
    process.exitCode = 1;
  }
}
