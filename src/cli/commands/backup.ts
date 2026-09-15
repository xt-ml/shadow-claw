/**
 * ShadowClaw CLI — `backup` command
 * Triggers or lists workspace backups.
 */

import {
  CliControlClient,
  type ControlClientOptions,
} from "../utils/control-client.js";

export interface RunBackupCommandOptions extends ControlClientOptions {
  client?: string;
  backupId?: string;
  group?: string;
  [key: string]: any;
}

export async function runBackupCommand(
  action = "trigger",
  options: RunBackupCommandOptions = {},
): Promise<void> {
  const client = new CliControlClient(options);

  try {
    if (action === "list") {
      const backups = await client.listBackups(options.client);
      if (!backups || backups.length === 0) {
        console.log("No backups found.");
        return;
      }

      console.log(`Available backups (${backups.length}):\n`);
      backups.forEach((b: any, idx: number) => {
        const dateStr = new Date(b.timestamp).toISOString();
        const sizeMb = (b.totalBytes / (1024 * 1024)).toFixed(2);
        console.log(`  ${idx + 1}. [${b.id}] Client: ${b.clientId}`);
        console.log(`     Date:  ${dateStr}`);
        console.log(`     Files: ${b.fileCount} (${sizeMb} MB)\n`);
      });
      return;
    }

    if (action === "delete") {
      if (!options.backupId) {
        console.error("Error: --backup-id is required for delete action.");
        process.exitCode = 1;
        return;
      }
      await client.deleteBackup(options.backupId, options.client);
      console.log(`Backup ${options.backupId} deleted.`);
      return;
    }

    // Default: Trigger backup
    let targetClientId = options.client;
    if (!targetClientId) {
      const clients = await client.listClients();
      if (!clients || clients.length === 0) {
        console.error("Error: No clients are connected to back up.");
        process.exitCode = 1;
        return;
      }
      targetClientId = clients[0].clientId;
    }

    const clientId = targetClientId || "";
    console.log(`Requesting backup from client ${clientId}...`);
    const result = await client.sendCommand(clientId, "trigger-backup", {
      groupId: options.group,
      token: client.token,
    });

    if (result.success) {
      console.log("Backup completed successfully.");
      console.log(JSON.stringify(result.data, null, 2));
    } else {
      console.error(`Backup failed: ${result.error}`);
      process.exitCode = 1;
    }
  } catch (err: any) {
    console.error(`Error executing backup command: ${err.message}`);
    process.exitCode = 1;
  }
}
