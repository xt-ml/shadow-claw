/**
 * ShadowClaw CLI — `tasks` command
 * Lists scheduled / active tasks on a connected client.
 */

import {
  CliControlClient,
  type ControlClientOptions,
} from "../utils/control-client.js";

export interface RunTasksCommandOptions extends ControlClientOptions {
  client?: string;
  group?: string;
  [key: string]: any;
}

export async function runTasksCommand(
  options: RunTasksCommandOptions = {},
): Promise<void> {
  const client = new CliControlClient(options);

  try {
    let targetClientId = options.client;
    if (!targetClientId) {
      const clients = await client.listClients();
      if (!clients || clients.length === 0) {
        console.error("Error: No clients connected.");
        process.exitCode = 1;
        return;
      }
      targetClientId = clients[0].clientId;
    }

    const clientId = targetClientId || "";
    console.log(
      `Fetching tasks from client ${clientId}${options.group ? ` (group: ${options.group})` : ""}...`,
    );
    const result = await client.sendCommand(clientId, "list-tasks", {
      groupId: options.group,
    });

    if (result.success) {
      const tasks = result.data?.tasks || [];
      if (tasks.length === 0) {
        console.log(
          options.group
            ? `No tasks configured on client for group "${options.group}".`
            : "No tasks configured on client.",
        );
        return;
      }

      console.log(
        `Tasks on ${targetClientId}${options.group ? ` (group: ${options.group})` : ""} (${tasks.length}):\n`,
      );
      tasks.forEach((t: any, idx: number) => {
        const status = t.enabled ? "[enabled]" : "[disabled]";
        const name = t.name || t.prompt?.slice(0, 30) || "Untitled task";
        console.log(
          `  ${idx + 1}. ${status} ${name} (${t.schedule || "manual"})`,
        );
      });
    } else {
      console.error(`Failed to list tasks: ${result.error}`);
      process.exitCode = 1;
    }
  } catch (err: any) {
    console.error(`Error executing tasks command: ${err.message}`);
    process.exitCode = 1;
  }
}
