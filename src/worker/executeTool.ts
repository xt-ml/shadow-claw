import {
  BASH_DEFAULT_TIMEOUT_SEC,
  BASH_MAX_TIMEOUT_SEC,
  CONFIG_KEYS,
  FETCH_MAX_RESPONSE,
} from "../config.js";
import { NANO_BUILTIN_PROFILE } from "../tools/builtin-profiles.js";
import { getConfig } from "../db/getConfig.js";
import { getAllTasks } from "../db/getAllTasks.js";
import { executeShell } from "../shell/shell.js";
import {
  bootVM,
  executeInVM,
  getVMBootModePreference,
  getVMStatus,
  isVMReady,
} from "../vm.js";
import { listGroupFiles } from "../storage/listGroupFiles.js";
import { readGroupFile } from "../storage/readGroupFile.js";
import { writeGroupFile } from "../storage/writeGroupFile.js";
import { uploadGroupFile } from "../storage/uploadGroupFile.js";
import { groupFileExists } from "../storage/groupFileExists.js";
import { ulid } from "../ulid.js";
import {
  gitClone,
  getProxyUrl,
  gitCheckout,
  gitBranch,
  gitStatus,
  gitAdd,
  gitLog,
  gitDiff,
  gitListBranches,
  gitListRepos,
  gitDeleteRepo,
  gitCommit,
  getRemoteUrl,
  gitPull,
  gitPush,
  gitMerge,
  gitReset,
} from "../git/git.js";
import { syncLfsToOpfs, syncOpfsToLfs } from "../git/sync.js";
import { resolveGitCredentials, buildAuthHeaders } from "../git/credentials.js";
import { resolveServiceCredentials } from "../accounts/service-accounts.js";
import { formatShellOutput } from "./formatShellOutput.js";
import { post } from "./post.js";
import { sandboxedEval } from "./sandboxedEval.js";
import { stripHtml } from "./stripHtml.js";
import {
  withRetry,
  isRetryableFetchError,
  RETRYABLE_STATUS_CODES,
} from "./withRetry.js";
import { Task, ShadowClawDatabase } from "../types.js";
import {
  callRemoteMcpTool,
  listRemoteMcpTools,
  McpReauthRequiredError,
} from "../remote-mcp-client.js";
import { executeManageEmailTool } from "./tools/email.js";
import {
  executeRemoteMcpCallTool,
  executeRemoteMcpListTools,
} from "./tools/remote-mcp.js";
import { executeFetchUrlTool } from "./tools/fetch-url.js";
import { executeGitTool } from "./tools/git.js";

export { resolveMcpReauth } from "./tools/remote-mcp.js";

async function getGroupTasks(
  db: ShadowClawDatabase,
  groupId: string,
): Promise<Task[]> {
  const all = (await getAllTasks(db)) as Task[];

  return all.filter((task) => task.groupId === groupId);
}

const VM_READY_POLL_MS = 50;

/**
 * Wait until the VM reports ready, or until timeout elapses.
 */
async function waitForVMReady(timeoutMs: number): Promise<boolean> {
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
 */
async function executeViaShellFallback(
  db: ShadowClawDatabase,
  command: string,
  groupId: string,
  timeoutSec: number,
): Promise<string> {
  const shellResult = await executeShell(db, command, groupId, {}, timeoutSec);

  return formatShellOutput(shellResult);
}

function normalizeWorkspacePath(inputPath: string): string {
  return inputPath
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^\.\//, "");
}

function hasPathTraversal(path: string): boolean {
  return path
    .split("/")
    .filter(Boolean)
    .some((part) => part === "..");
}

function escapeMarkdownLabel(label: string): string {
  return label.replace(/[\[\]\\]/g, "\\$&");
}

function isImagePath(path: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(path);
}

/**
 * Execute a tool
 */
export async function executeTool(
  db: ShadowClawDatabase,
  name: string,
  input: Record<string, any>,
  groupId: string,
  options: { isScheduledTask?: boolean } = {},
): Promise<string> {
  try {
    // Block task-mutation and notification tools during scheduled task execution
    // to prevent infinite recursion (task → notification → task loops).
    if (options.isScheduledTask) {
      const BLOCKED_TOOLS = new Set([
        "create_task",
        "update_task",
        "delete_task",
        "enable_task",
        "disable_task",
        "send_notification",
      ]);
      if (BLOCKED_TOOLS.has(name)) {
        return `Tool "${name}" is not allowed during scheduled task execution to prevent recursion.`;
      }
    }

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

      case "read_file": {
        const filePaths = input.paths || (input.path ? [input.path] : []);
        if (filePaths.length === 0) {
          return "Error: read_file requires path or paths.";
        }

        if (filePaths.length === 1) {
          return await readGroupFile(db, groupId, filePaths[0]);
        }

        const sections = await Promise.all(
          filePaths.map(async (p: string) => {
            try {
              const content = await readGroupFile(db, groupId, p);

              return `--- ${p} ---\n${content}`;
            } catch (err: any) {
              return `--- ${p} ---\nError reading ${p}: ${err.message}`;
            }
          }),
        );

        return sections.join("\n\n");
      }

      case "open_file": {
        if (!input.path || typeof input.path !== "string") {
          return "Error: open_file requires a valid path string.";
        }

        const exists = await groupFileExists(db, groupId, input.path);
        if (!exists) {
          return `Error: file not found: ${input.path}`;
        }

        post({
          type: "open-file",
          payload: { groupId, path: input.path },
        });

        return `Opening file in viewer: ${input.path}`;
      }

      case "attach_file_to_chat": {
        if (!input.path || typeof input.path !== "string") {
          return "Error: attach_file_to_chat requires a valid path string.";
        }

        const normalizedPath = normalizeWorkspacePath(input.path);
        if (!normalizedPath) {
          return "Error: attach_file_to_chat received an empty file path.";
        }

        if (hasPathTraversal(normalizedPath)) {
          return "Error: attach_file_to_chat path cannot contain '..' segments.";
        }

        try {
          // Verify the file exists in the current group workspace.
          await readGroupFile(db, groupId, normalizedPath);
        } catch (err: any) {
          return `Error: attach_file_to_chat could not find ${normalizedPath}: ${err?.message || String(err)}`;
        }

        const defaultLabel = normalizedPath.split("/").pop() || normalizedPath;
        const labelInput =
          typeof input.alt === "string" && input.alt.trim()
            ? input.alt.trim()
            : defaultLabel;
        const label = escapeMarkdownLabel(labelInput);

        const markdown = isImagePath(normalizedPath)
          ? `![${label}](${normalizedPath})`
          : `[${label}](${normalizedPath})`;

        return (
          `Attachment prepared: ${normalizedPath}\n` +
          "Please include the following markdown in your response to show it to the user:\n" +
          markdown
        );
      }

      case "write_file":
        await writeGroupFile(db, groupId, input.path, input.content);

        return `Written ${input.content.length} bytes to ${input.path}`;

      case "patch_file": {
        const content = await readGroupFile(db, groupId, input.path);
        const idx = content.indexOf(input.old_string);

        if (idx === -1) {
          return `patch_file failed: old_string not found in ${input.path}`;
        }

        if (content.indexOf(input.old_string, idx + 1) !== -1) {
          return `patch_file failed: old_string matches multiple locations in ${input.path}. Include more surrounding context to make the match unique.`;
        }

        const patched =
          content.slice(0, idx) +
          input.new_string +
          content.slice(idx + input.old_string.length);

        await writeGroupFile(db, groupId, input.path, patched);

        return `Patched ${input.path} (${input.old_string.length} chars replaced with ${input.new_string.length} chars)`;
      }

      case "list_files": {
        const entries = (await listGroupFiles(
          db,
          groupId,
          input.path || ".",
        )) as string[];

        return entries.length > 0 ? entries.join("\n") : "(empty directory)";
      }

      case "manage_tools": {
        const { action, tool_names, profile_id } = input;
        post({
          type: "manage-tools",
          payload: {
            action,
            toolNames: tool_names,
            profileId: profile_id,
            groupId,
          },
        });

        return `Tool management request sent: ${action}${profile_id ? " " + profile_id : ""}${tool_names ? " (" + tool_names.join(", ") + ")" : ""}`;
      }

      case "list_tool_profiles": {
        const profilesRaw = await getConfig(db, CONFIG_KEYS.TOOL_PROFILES);
        let profiles: any[] = [];
        if (typeof profilesRaw === "string") {
          try {
            profiles = JSON.parse(profilesRaw);
          } catch {
            profiles = [];
          }
        } else if (Array.isArray(profilesRaw)) {
          profiles = profilesRaw;
        }

        const allProfiles = [NANO_BUILTIN_PROFILE, ...profiles];

        return allProfiles
          .map(
            (p) =>
              `[Profile ID: ${p.id}] ${p.name}\n  Tools: ${p.enabledToolNames.join(", ")}`,
          )
          .join("\n\n");
      }

      case "fetch_url": {
        return await executeFetchUrlTool(db, input, groupId, {
          fetchImpl: fetch,
          resolveGitCredentials,
          buildAuthHeaders,
          resolveServiceCredentials,
          withRetry,
          isRetryableFetchError,
          retryableStatusCodes: RETRYABLE_STATUS_CODES,
          stripHtml,
          uploadGroupFile,
          post,
          fetchMaxResponse: FETCH_MAX_RESPONSE,
        });
      }

      case "update_memory":
        await writeGroupFile(db, groupId, "MEMORY.md", input.content);

        return "Memory updated successfully.";

      case "create_task": {
        if (!input.schedule || typeof input.schedule !== "string") {
          return "Error: Missing or invalid 'schedule' (cron expression) for create_task.";
        }

        if (!input.prompt || typeof input.prompt !== "string") {
          return "Error: Missing or invalid 'prompt' for create_task.";
        }

        const taskData = {
          id: ulid(),
          groupId,
          schedule: input.schedule.trim(),
          prompt: input.prompt.trim(),
          enabled: true,
          lastRun: null,
          createdAt: Date.now(),
        };

        post({ type: "task-created", payload: { task: taskData } });

        return `Task created successfully.\nSchedule: ${taskData.schedule}\nPrompt: ${taskData.prompt}`;
      }

      case "javascript": {
        const code = input.code;
        const result = (await sandboxedEval(code)) as any;

        if (!result.ok) {
          return `JavaScript error: ${result.error}`;
        }

        const value = result.value;

        if (value === "__UNDEFINED__" || value === undefined) {
          return "(no return value)\nHint: Your code did not return a value. Use `return <expression>` as the last statement to see output.";
        }

        if (value === null) {
          return "null";
        }

        if (typeof value === "object") {
          try {
            return JSON.stringify(value, null, 2);
          } catch {
            /* fall through */
          }
        }

        return String(value);
      }

      case "list_tasks": {
        const tasks = await getGroupTasks(db, groupId);
        if (tasks.length === 0) {
          return "No tasks found for this group.";
        }

        return tasks
          .map(
            (t) =>
              `[ID: ${t.id}] Schedule: ${t.schedule}, Prompt: ${t.prompt}, Enabled: ${t.enabled}`,
          )
          .join("\n");
      }

      case "update_task": {
        const tasks = await getGroupTasks(db, groupId);

        const task = tasks.find((t: any) => t.id === input.id);

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
        const tasks = await getGroupTasks(db, groupId);

        const task = tasks.find((t: any) => t.id === input.id);
        if (!task) {
          return `Error: Task with ID ${input.id} not found.`;
        }

        task.enabled = true;

        post({ type: "update-task", payload: { task } });

        return `Task ${input.id} enabled successfully.`;
      }

      case "disable_task": {
        const tasks = await getGroupTasks(db, groupId);

        const task = tasks.find((t: any) => t.id === input.id);
        if (!task) {
          return `Error: Task with ID ${input.id} not found.`;
        }

        task.enabled = false;

        post({ type: "update-task", payload: { task } });

        return `Task ${input.id} disabled successfully.`;
      }

      case "delete_task": {
        if (!input.id) {
          return "Error: Missing required task ID for deletion.";
        }

        post({ type: "delete-task", payload: { id: input.id, groupId } });

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

      case "send_notification": {
        post({
          type: "send-notification",
          payload: {
            title: input.title || "ShadowClaw",
            body: input.body,
            groupId,
          },
        });

        return `Push notification sent: ${input.body}`;
      }

      case "manage_email":
      case "manage_integration": {
        return executeManageEmailTool(db, input, groupId);
      }

      case "email_read_messages":
      case "integration_read_messages": {
        return executeTool(
          db,
          "manage_email",
          { ...input, action: "read_messages" },
          groupId,
        );
      }

      case "email_send_message":
      case "integration_send_message": {
        return executeTool(
          db,
          "manage_email",
          { ...input, action: "send_message" },
          groupId,
        );
      }

      case "remote_mcp_list_tools": {
        return await executeRemoteMcpListTools(db, input, groupId, {
          listRemoteMcpTools,
          callRemoteMcpTool,
          McpReauthRequiredError,
          post,
        });
      }

      case "remote_mcp_call_tool": {
        return await executeRemoteMcpCallTool(db, input, groupId, {
          listRemoteMcpTools,
          callRemoteMcpTool,
          McpReauthRequiredError,
          post,
        });
      }

      // ── Git tools (isomorphic-git) ───────────────────────────────
      case "git_clone":
      case "git_sync":
      case "git_checkout":
      case "git_branch":
      case "git_status":
      case "git_add":
      case "git_log":
      case "git_diff":
      case "git_branches":
      case "git_list_repos":
      case "git_delete_repo":
      case "git_commit":
      case "git_pull":
      case "git_push":
      case "git_merge":
      case "git_reset": {
        return await executeGitTool(db, name, input, groupId, {
          getConfig,
          getProxyUrl,
          resolveGitCredentials,
          gitClone,
          gitCheckout,
          gitBranch,
          gitStatus,
          gitAdd,
          gitLog,
          gitDiff,
          gitListBranches,
          gitListRepos,
          gitDeleteRepo,
          gitCommit,
          gitPull,
          gitPush,
          gitMerge,
          gitReset,
          getRemoteUrl,
          syncLfsToOpfs,
          syncOpfsToLfs,
          readGroupFile,
          configKeys: {
            GIT_CORS_PROXY: CONFIG_KEYS.GIT_CORS_PROXY,
            GIT_PROXY_URL: CONFIG_KEYS.GIT_PROXY_URL,
            GIT_AUTHOR_NAME: CONFIG_KEYS.GIT_AUTHOR_NAME,
            GIT_AUTHOR_EMAIL: CONFIG_KEYS.GIT_AUTHOR_EMAIL,
          },
        });
      }

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err) {
    return `Tool error (${name}): ${err instanceof Error ? err.message : String(err)}`;
  }
}
