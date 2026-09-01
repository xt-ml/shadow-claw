/**
 * ShadowClaw CLI — `tasks` command
 * Lists scheduled / active tasks on a connected client.
 */

import { CliControlClient } from "../utils/control-client.mjs";

export async function runTasksCommand(options = {}) {
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

    console.log(
      `Fetching tasks from client ${targetClientId}${options.group ? ` (group: ${options.group})` : ""}...`,
    );
    const result = await client.sendCommand(targetClientId, "list-tasks", {
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
      tasks.forEach((t, idx) => {
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
  } catch (err) {
    console.error(`Error executing tasks command: ${err.message}`);
    process.exitCode = 1;
  }
}
