/**
 * ShadowClaw CLI — `send-file` command
 * Transfers a local file to a connected peer / client over WebRTC or HTTP.
 */

import fs from "node:fs";
import path from "node:path";
import {
  CliControlClient,
  type ControlClientOptions,
} from "../utils/control-client.js";

export interface RunSendFileOptions extends ControlClientOptions {
  client?: string;
  prompt?: string;
  name?: string;
  group?: string;
  timeout?: number | string;
  json?: boolean;
  [key: string]: any;
}

export async function runSendFileCommand(
  filePath: string,
  options: RunSendFileOptions = {},
): Promise<void> {
  if (!filePath || typeof filePath !== "string" || !filePath.trim()) {
    console.error("Error: File path cannot be empty.");
    process.exitCode = 1;
    return;
  }

  const resolvedPath = path.resolve(filePath.trim());
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exitCode = 1;
    return;
  }

  const stat = fs.statSync(resolvedPath);
  if (stat.isDirectory()) {
    console.error(`Error: Cannot send directory: ${filePath}`);
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
    const fileName = options.name || path.basename(resolvedPath);
    console.log(`Sending "${fileName}" (${stat.size} bytes) to ${clientId}...`);

    const timeoutMs = options.timeout ? Number(options.timeout) * 1000 : 120000;

    const result = await client.sendFile(clientId, resolvedPath, {
      prompt: options.prompt,
      name: options.name,
      groupId: options.group,
      timeoutMs,
    });

    if (result.success) {
      console.log(
        `File "${fileName}" successfully transferred to ${clientId}.`,
      );
      if (result.data?.path) {
        console.log(`Remote location: ${result.data.path}`);
      }
      if (result.data?.reply || result.data?.text) {
        const reply = result.data.reply || result.data.text;
        console.log("");
        console.log(`Response from ${clientId}:`);
        console.log("----------------------------------------");
        console.log(reply);
        console.log("----------------------------------------");
      } else if (options.json && result.data) {
        console.log(JSON.stringify(result.data, null, 2));
      }
    } else {
      console.error(`Error from client: ${result.error || "Unknown error"}`);
      process.exitCode = 1;
    }
  } catch (err: any) {
    console.error(`Error sending file: ${err.message}`);
    process.exitCode = 1;
  }
}
