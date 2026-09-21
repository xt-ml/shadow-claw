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
  file?: string;
  timeout?: number | string;
  json?: boolean;
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
        `Targeting client: ${clients[0].deviceLabel || targetClientId} (${targetClientId})`,
      );
    }

    const clientId = targetClientId || "";
    const timeoutMs = options.timeout ? Number(options.timeout) * 1000 : 120000;

    let result: any;
    if (options.file) {
      console.log(
        `Sending message with file "${options.file}" to ${clientId}...`,
      );
      result = await client.sendFile(clientId, options.file, {
        prompt: message.trim(),
        groupId: options.group,
        timeoutMs,
      });
    } else {
      console.log(`Sending message to ${clientId}...`);
      result = await client.sendCommand(
        clientId,
        "send-message",
        {
          text: message.trim(),
          groupId: options.group,
        },
        timeoutMs,
      );
    }

    if (result.success) {
      console.log("Message successfully dispatched.");
      if (result.data?.reply || result.data?.text) {
        const reply = result.data.reply || result.data.text;
        console.log("");
        console.log(`Response from ${clientId}:`);
        console.log("----------------------------------------");
        console.log(reply);
        console.log("----------------------------------------");
      } else if (result.data) {
        if (options.json) {
          console.log(JSON.stringify(result.data, null, 2));
        } else {
          console.log(JSON.stringify(result.data, null, 2));
        }
      }
    } else {
      console.error(`Error from client: ${result.error || "Unknown error"}`);
      process.exitCode = 1;
    }
  } catch (err: any) {
    console.error(`Error sending message: ${err.message}`);
    process.exitCode = 1;
  }
}
