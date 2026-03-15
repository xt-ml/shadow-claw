import {
  BASH_DEFAULT_TIMEOUT_SEC,
  BASH_MAX_TIMEOUT_SEC,
  CONFIG_KEYS,
  FETCH_MAX_RESPONSE,
} from "../config.mjs";
import { getConfig } from "../db/getConfig.mjs";
import { executeShell } from "../shell/shell.mjs";
import {
  bootVM,
  executeInVM,
  getVMBootModePreference,
  getVMStatus,
  isVMReady,
} from "../vm.mjs";
import { listGroupFiles } from "../storage/listGroupFiles.mjs";
import { readGroupFile } from "../storage/readGroupFile.mjs";
import { writeGroupFile } from "../storage/writeGroupFile.mjs";
import { ulid } from "../ulid.mjs";
import { formatShellOutput } from "./formatShellOutput.mjs";
import { pendingTasks } from "./pendingTasks.mjs";
import { post } from "./post.mjs";
import { stripHtml } from "./stripHtml.mjs";

const VM_READY_POLL_MS = 50;

/**
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

/**
 * Wait until the VM reports ready, or until timeout elapses.
 *
 * @param {number} timeoutMs
 *
 * @returns {Promise<boolean>}
 */
async function waitForVMReady(timeoutMs) {
  if (isVMReady()) {
    return true;
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((resolve) => {
      setTimeout(resolve, VM_READY_POLL_MS);
    });

    if (isVMReady()) {
      return true;
    }
  }

  return isVMReady();
}

/**
 * Execute a command via JS shell emulator.
 *
 * @param {ShadowClawDatabase} db
 * @param {string} command
 * @param {string} groupId
 * @param {number} timeoutSec
 *
 * @returns {Promise<string>}
 */
async function executeViaShellFallback(db, command, groupId, timeoutSec) {
  const shellResult = await executeShell(db, command, groupId, {}, timeoutSec);
  return formatShellOutput(shellResult);
}

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
        const configuredTimeoutRaw = await getConfig(
          db,
          CONFIG_KEYS.VM_BASH_TIMEOUT_SEC,
        );
        const configuredTimeout = Number(configuredTimeoutRaw);
        const defaultTimeoutSec = Number.isFinite(configuredTimeout)
          ? Math.min(Math.max(configuredTimeout, 1), BASH_MAX_TIMEOUT_SEC)
          : BASH_DEFAULT_TIMEOUT_SEC;

        const requestedTimeout = Number(input.timeout);
        const timeoutSec = Number.isFinite(requestedTimeout)
          ? Math.min(Math.max(requestedTimeout, 1), BASH_MAX_TIMEOUT_SEC)
          : defaultTimeoutSec;

        // Explicit disabled mode means "always use JS shell emulator".
        if (getVMBootModePreference() === "disabled") {
          return await executeViaShellFallback(
            db,
            input.command,
            groupId,
            timeoutSec,
          );
        }

        if (!isVMReady()) {
          await bootVM();
          const status = getVMStatus();

          // Give the eager boot path a chance to finish before returning an error.
          if (!isVMReady() && status.booting) {
            await waitForVMReady(Math.min(timeoutSec * 1000, 30_000));
          }
        }

        if (isVMReady()) {
          return await executeInVM(input.command, timeoutSec, { db, groupId });
        }

        const status = getVMStatus();
        const reason = status.error
          ? `Reason: ${status.error}`
          : status.booting
            ? "Reason: WebVM is still booting."
            : "Reason: WebVM is unavailable.";

        post({
          type: "show-toast",
          payload: {
            message:
              `WebVM unavailable for this bash command. ${reason} ` +
              "Falling back to JavaScript Bash Emulator and retrying WebVM on the next command.",
            type: "warning",
            duration: 7000,
          },
        });

        return await executeViaShellFallback(
          db,
          input.command,
          groupId,
          timeoutSec,
        );
      }

      case "read_file":
        return await readGroupFile(db, groupId, input.path);

      case "open_file": {
        if (!input.path || typeof input.path !== "string") {
          return "Error: open_file requires a valid path string.";
        }

        post({
          type: "open-file",
          payload: { groupId, path: input.path },
        });

        return `Opening file in viewer: ${input.path}`;
      }

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

      case "clear_chat": {
        post({ type: "clear-chat", payload: { groupId } });

        return "Chat history cleared successfully. New session started.";
      }

      case "show_toast": {
        post({
          type: "show-toast",
          payload: {
            message: input.message,
            type: input.type || "info",
            duration: input.duration,
          },
        });

        return `Toast notification sent: ${input.message}`;
      }

      // ── Git tools (isomorphic-git) ───────────────────────────────
      case "git_clone": {
        const { gitClone, getProxyUrl } = await import("../git/git.mjs");
        const { syncLfsToOpfs } = await import("../git/sync.mjs");
        const { getConfig } = await import("../db/getConfig.mjs");
        const { CONFIG_KEYS: CK } = await import("../config.mjs");

        const pref = await getConfig(db, CK.GIT_CORS_PROXY);
        const corsProxy = getProxyUrl(pref === "public" ? "public" : "local");

        const repo = await gitClone({
          url: input.url,
          branch: input.branch,
          depth: input.depth,
          corsProxy,
        });

        const includeGit = input.include_git === true;
        await syncLfsToOpfs(db, groupId, repo, `repos/${repo}`, includeGit);

        return `Cloned ${input.url} as "${repo}". Files are available recursively at "repos/${repo}". Use repo="${repo}" for other git_ tools.`;
      }

      case "git_sync": {
        const { syncLfsToOpfs, syncOpfsToLfs } =
          await import("../git/sync.mjs");
        const dir = `repos/${input.repo}`;
        const includeGit = input.include_git === true;

        if (input.direction === "push") {
          await syncOpfsToLfs(db, groupId, dir, input.repo, includeGit);
          return `Synced workspace files in ${dir} to git clone (ready for commit/status).`;
        } else {
          await syncLfsToOpfs(db, groupId, input.repo, dir, includeGit);
          return `Synced git clone files to workspace ${dir} (overwriting local changes).`;
        }
      }

      case "git_checkout": {
        const { gitCheckout } = await import("../git/git.mjs");
        const { syncLfsToOpfs } = await import("../git/sync.mjs");

        const result = await gitCheckout({ repo: input.repo, ref: input.ref });
        await syncLfsToOpfs(db, groupId, input.repo, `repos/${input.repo}`);

        return result;
      }

      case "git_status": {
        const { gitStatus } = await import("../git/git.mjs");
        const { syncOpfsToLfs } = await import("../git/sync.mjs");

        try {
          await syncOpfsToLfs(db, groupId, `repos/${input.repo}`, input.repo);
        } catch {
          // Ignore if OPFS folder doesn't exist yet
        }

        return await gitStatus({ repo: input.repo });
      }

      case "git_add": {
        const { gitAdd } = await import("../git/git.mjs");
        const { syncOpfsToLfs } = await import("../git/sync.mjs");

        try {
          await syncOpfsToLfs(db, groupId, `repos/${input.repo}`, input.repo);
        } catch {
          // Ignore if OPFS folder doesn't exist yet
        }

        return await gitAdd({ repo: input.repo, filepath: input.filepath });
      }

      case "git_log": {
        const { gitLog } = await import("../git/git.mjs");

        return await gitLog({
          repo: input.repo,
          ref: input.ref,
          depth: input.depth,
        });
      }

      case "git_diff": {
        const { gitDiff } = await import("../git/git.mjs");
        const { syncOpfsToLfs } = await import("../git/sync.mjs");

        try {
          await syncOpfsToLfs(db, groupId, `repos/${input.repo}`, input.repo);
        } catch {
          // Ignore missing OPFS dir
        }

        return await gitDiff({
          repo: input.repo,
          ref1: input.ref1,
          ref2: input.ref2,
        });
      }

      case "git_branches": {
        const { gitListBranches } = await import("../git/git.mjs");

        return await gitListBranches({
          repo: input.repo,
          remote: input.remote,
        });
      }

      case "git_list_repos": {
        const { gitListRepos } = await import("../git/git.mjs");

        return await gitListRepos();
      }

      case "git_commit": {
        const { gitCommit } = await import("../git/git.mjs");
        const { syncOpfsToLfs } = await import("../git/sync.mjs");
        const { getConfig } = await import("../db/getConfig.mjs");
        const { CONFIG_KEYS: CK } = await import("../config.mjs");

        try {
          await syncOpfsToLfs(db, groupId, `repos/${input.repo}`, input.repo);
        } catch (err) {
          return `Error: Could not sync from OPFS. Did you delete repos/${input.repo}?`;
        }

        let authorName = input.author_name;
        let authorEmail = input.author_email;

        if (!authorName) {
          const stored = await getConfig(db, CK.GIT_AUTHOR_NAME);
          if (stored) authorName = stored;
        }

        if (!authorEmail) {
          const stored = await getConfig(db, CK.GIT_AUTHOR_EMAIL);
          if (stored) authorEmail = stored;
        }

        return await gitCommit({
          repo: input.repo,
          message: input.message,
          authorName,
          authorEmail,
        });
      }

      case "git_pull": {
        const { gitPull, getProxyUrl } = await import("../git/git.mjs");
        const { getConfig } = await import("../db/getConfig.mjs");
        const { CONFIG_KEYS: CK } = await import("../config.mjs");
        const { decryptValue } = await import("../crypto.mjs");

        const encToken = await getConfig(db, CK.GIT_TOKEN);
        let token;

        if (encToken) {
          token = await decryptValue(/** @type {string} */ (encToken));
        }

        const pref = await getConfig(db, CK.GIT_CORS_PROXY);
        const corsProxy = getProxyUrl(pref === "public" ? "public" : "local");

        let authorName = input.author_name;
        let authorEmail = input.author_email;

        if (!authorName) {
          const stored = await getConfig(db, CK.GIT_AUTHOR_NAME);
          if (stored) authorName = stored;
        }

        if (!authorEmail) {
          const stored = await getConfig(db, CK.GIT_AUTHOR_EMAIL);
          if (stored) authorEmail = stored;
        }

        return await gitPull({
          repo: input.repo,
          branch: input.branch,
          authorName,
          authorEmail,
          token: token ?? undefined,
          corsProxy,
        });
      }

      case "git_push": {
        const { gitPush, getProxyUrl } = await import("../git/git.mjs");
        const { getConfig } = await import("../db/getConfig.mjs");
        const { CONFIG_KEYS: CK } = await import("../config.mjs");
        const { decryptValue } = await import("../crypto.mjs");

        const encToken = await getConfig(db, CK.GIT_TOKEN);
        let token;

        if (encToken) {
          token = await decryptValue(/** @type {string} */ (encToken));
        }

        if (!token) {
          return "Error: No git token configured. Set a GitHub Personal Access Token in Settings → Git.";
        }

        const pref = await getConfig(db, CK.GIT_CORS_PROXY);
        const corsProxy = getProxyUrl(pref === "public" ? "public" : "local");

        return await gitPush({
          repo: input.repo,
          branch: input.branch,
          force: input.force,
          token,
          corsProxy,
        });
      }

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err) {
    return `Tool error (${name}): ${err instanceof Error ? err.message : String(err)}`;
  }
}
