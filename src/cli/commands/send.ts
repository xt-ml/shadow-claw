/**
 * ShadowClaw CLI — `send` command
 * Dispatches a prompt / message to a connected client.
 */

import {
  CliControlClient,
  type ControlClientOptions,
} from "../utils/control-client.js";

export interface RunSendCommandOptions extends ControlClientOptions {
  client?: string;
  group?: string;
  [key: string]: any;
}

export async function runSendCommand(
  message: string,
  options: RunSendCommandOptions = {},
): Promise<void> {
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

    const clientId = targetClientId || "";
    console.log(`Sending message to ${clientId}...`);
    const result = await client.sendCommand(clientId, "send-message", {
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
  } catch (err: any) {
    console.error(`Error sending message: ${err.message}`);
    process.exitCode = 1;
  }
}
