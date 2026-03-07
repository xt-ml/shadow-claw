import { FETCH_MAX_RESPONSE } from "../config.mjs";
import { executeShell } from "../shell/shell.mjs";
import { listGroupFiles } from "../storage/listGroupFiles.mjs";
import { readGroupFile } from "../storage/readGroupFile.mjs";
import { writeGroupFile } from "../storage/writeGroupFile.mjs";
import { ulid } from "../ulid.mjs";
import { formatShellOutput } from "./formatShellOutput.mjs";
import { pendingTasks } from "./pendingTasks.mjs";
import { post } from "./post.mjs";
import { stripHtml } from "./stripHtml.mjs";

/**
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

/**
 * Execute a tool
 *
 * @param {ShadowClawDatabase} db
 * @param {string} name
 * @param {Record<string, any>} input
 * @param {string} groupId
 *
 * @returns {Promise<string>}
 */
export async function executeTool(db, name, input, groupId) {
  try {
    switch (name) {
      case "bash": {
        // VM unavailable — fall back to JS shell emulator
        const shellResult = await executeShell(
          db,
          input.command,
          groupId,
          {},
          Math.min(input.timeout || 30, 240),
        );

        return formatShellOutput(shellResult);
      }

      case "read_file":
        return await readGroupFile(db, groupId, input.path);

      case "write_file":
        await writeGroupFile(db, groupId, input.path, input.content);

        return `Written ${input.content.length} bytes to ${input.path}`;

      case "list_files": {
        const entries = await listGroupFiles(db, groupId, input.path || ".");

        return entries.length > 0 ? entries.join("\n") : "(empty directory)";
      }

      case "fetch_url": {
        try {
          const fetchRes = await fetch(input.url, {
            method: input.method || "GET",
            headers: input.headers || {},
            body: input.body,
          });

          const rawText = await fetchRes.text();
          const contentType = fetchRes.headers.get("content-type") || "";
          const status = `[HTTP ${fetchRes.status} ${fetchRes.statusText}]\n`;

          let body = rawText;
          if (
            contentType.includes("html") ||
            rawText.trimStart().startsWith("<")
          ) {
            body = stripHtml(rawText);
          }

          if (!fetchRes.ok) {
            return `${status}Error fetching URL. Content preview:\n${body.slice(0, 1000)}`;
          }

          return status + body.slice(0, FETCH_MAX_RESPONSE);
        } catch (fetchErr) {
          const errMsg =
            fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
          return `Network Error: Failed to fetch ${input.url}.\nReason: ${errMsg}\nCheck if the URL is correct and the server is reachable. If this is a CORS issue, it may be blocked by the browser.`;
        }
      }

      case "update_memory":
        await writeGroupFile(db, groupId, "MEMORY.md", input.content);

        return "Memory updated successfully.";

      case "create_task": {
        const taskData = {
          id: ulid(),
          groupId,
          schedule: input.schedule,
          prompt: input.prompt,
          enabled: true,
          lastRun: null,
          createdAt: Date.now(),
        };

        post({ type: "task-created", payload: { task: taskData } });

        return `Task created successfully.\nSchedule: ${taskData.schedule}\nPrompt: ${taskData.prompt}`;
      }

      case "javascript": {
        try {
          const code = input.code;
          const result = (0, eval)(`"use strict";\n${code}`);

          if (result === undefined) {
            return "(no return value)";
          }

          if (result === null) {
            return "null";
          }

          if (typeof result === "object") {
            try {
              return JSON.stringify(result, null, 2);
            } catch {
              /* fall through */
            }
          }

          return String(result);
        } catch (err) {
          return `JavaScript error: ${err instanceof Error ? err.message : String(err)}`;
        }
      }

      case "list_tasks": {
        return new Promise((resolve) => {
          pendingTasks.set(groupId, (tasks) => {
            if (tasks.length === 0) resolve("No tasks found for this group.");
            const list = tasks
              .map(
                (t) =>
                  `[ID: ${t.id}] Schedule: ${t.schedule}, Prompt: ${t.prompt}, Enabled: ${t.enabled}`,
              )
              .join("\n");

            resolve(list);
          });

          post({ type: "task-list-request", payload: { groupId } });
        });
      }

      case "update_task": {
        const tasks = await new Promise((resolve) => {
          pendingTasks.set(groupId, resolve);

          post({ type: "task-list-request", payload: { groupId } });
        });

        const task = tasks.find((/** @type {any} */ t) => t.id === input.id);

        if (!task) {
          return `Error: Task with ID ${input.id} not found.`;
        }

        if (input.schedule) {
          task.schedule = input.schedule;
        }

        if (input.prompt) {
          task.prompt = input.prompt;
        }

        if (input.enabled !== undefined) {
          task.enabled = !!input.enabled;
        }

        post({ type: "update-task", payload: { task } });

        return `Task ${input.id} updated successfully.`;
      }

      case "enable_task": {
        const tasks = await new Promise((resolve) => {
          pendingTasks.set(groupId, resolve);

          post({ type: "task-list-request", payload: { groupId } });
        });

        const task = tasks.find((/** @type {any} */ t) => t.id === input.id);
        if (!task) {
          return `Error: Task with ID ${input.id} not found.`;
        }

        task.enabled = true;

        post({ type: "update-task", payload: { task } });

        return `Task ${input.id} enabled successfully.`;
      }

      case "disable_task": {
        const tasks = await new Promise((resolve) => {
          pendingTasks.set(groupId, resolve);

          post({ type: "task-list-request", payload: { groupId } });
        });

        const task = tasks.find((/** @type {any} */ t) => t.id === input.id);
        if (!task) {
          return `Error: Task with ID ${input.id} not found.`;
        }

        task.enabled = false;

        post({ type: "update-task", payload: { task } });

        return `Task ${input.id} disabled successfully.`;
      }

      case "delete_task": {
        post({ type: "delete-task", payload: { id: input.id } });

        return `Task ${input.id} deleted successfully.`;
      }

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err) {
    return `Tool error (${name}): ${err instanceof Error ? err.message : String(err)}`;
  }
}
