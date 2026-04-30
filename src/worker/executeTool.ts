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
import {
  resolveGitCredentials,
  buildAuthHeaders,
  type GitAuthMode,
} from "../git/credentials.js";
import {
  resolveServiceCredentials,
  type AccountAuthMode,
} from "../accounts/service-accounts.js";
import { formatShellOutput } from "./formatShellOutput.js";
import { post } from "./post.js";
import { sandboxedEval } from "./sandboxedEval.js";
import { stripHtml } from "./stripHtml.js";
import {
  withRetry,
  isRetryableFetchError,
  RETRYABLE_STATUS_CODES,
} from "./withRetry.js";
import { Task } from "../types.js";
import { callRemoteMcpTool, listRemoteMcpTools } from "../remote-mcp-client.js";

async function getGroupTasks(db: any, groupId: string): Promise<Task[]> {
  const all = (await getAllTasks(db)) as Task[];

  return all.filter((task) => task.groupId === groupId);
}

const VM_READY_POLL_MS = 50;

function parseAuthMode(
  value: unknown,
): AccountAuthMode | GitAuthMode | undefined {
  if (value === "pat" || value === "oauth") {
    return value;
  }

  return undefined;
}

/**
 * Parse conflict marker regions from file content.
 */
function parseConflictRegions(content: string): {
  startLine: number;
  oursLabel: string;
  theirsLabel: string;
  ours: string;
  theirs: string;
}[] {
  const regions: {
    startLine: number;
    oursLabel: string;
    theirsLabel: string;
    ours: string;
    theirs: string;
  }[] = [];
  const lines = content.split("\n");
  let i = 0;
  while (i < lines.length) {
    if (lines[i].startsWith("<<<<<<<")) {
      const oursLabel = lines[i].slice(8).trim();
      const oursLines: string[] = [];
      const theirsLines: string[] = [];
      let inTheirs = false;
      const startLine = i + 1;
      i++;
      while (i < lines.length && !lines[i].startsWith(">>>>>>>")) {
        if (lines[i].startsWith("=======")) {
          inTheirs = true;
        } else if (inTheirs) {
          theirsLines.push(lines[i]);
        } else {
          oursLines.push(lines[i]);
        }

        i++;
      }

      const theirsLabel = i < lines.length ? lines[i].slice(8).trim() : "";
      regions.push({
        startLine,
        oursLabel,
        theirsLabel,
        ours: oursLines.join("\n"),
        theirs: theirsLines.join("\n"),
      });
    }

    i++;
  }

  return regions;
}

/**
 * Extract conflict file paths from an isomorphic-git error message.
 */
function extractConflictPaths(message: string): string[] {
  const match = message.match(/conflicts? in the following files?:\s*(.+)/i);
  if (match) {
    return match[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return [];
}

/**
 * Truncate text to at most `maxLines` lines, appending "[...]" if truncated.
 */
function truncateSnippet(text: string, maxLines: number): string {
  const lines = text.split("\n");
  if (lines.length <= maxLines) {
    return text;
  }

  return (
    lines.slice(0, maxLines).join("\n") +
    "\n    [... " +
    (lines.length - maxLines) +
    " more lines]"
  );
}

/**
 * Indent every line of `text` by `prefix`.
 */
function indent(text: string, prefix: string): string {
  return text
    .split("\n")
    .map((l) => prefix + l)
    .join("\n");
}

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
  db: any,
  command: string,
  groupId: string,
  timeoutSec: number,
): Promise<string> {
  const shellResult = await executeShell(db, command, groupId, {}, timeoutSec);

  return formatShellOutput(shellResult);
}

/**
 * Custom error that carries an HTTP status code for retry classification.
 */
class HttpError extends Error {
  public status: number;
  public statusText: string;
  public body: string;
  public headers: string;

  constructor(status: number, statusText: string, body: string, headers = "") {
    super(`HTTP ${status} ${statusText}`);
    this.name = "HttpError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
    this.headers = headers;
  }
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
  db: any,
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
        try {
          const fetchHeaders: Record<string, string> = {
            ...(input.headers || {}),
          };
          const authMode = parseAuthMode(input.auth_mode);
          const serviceAccountId =
            typeof input.account_id === "string" ? input.account_id : undefined;
          let resolvedGitCredentials:
            | {
                accountId?: string;
                authMode?: "pat" | "oauth";
                hostPattern?: string;
                provider?: string;
                reauthRequired?: boolean;
              }
            | undefined;
          let resolvedServiceCredentials:
            | {
                accountId: string;
                authMode: "pat" | "oauth";
                headerName: string;
                headerValue: string;
                service: string;
                hostPattern: string;
                token: string;
              }
            | undefined;

          const runFetchWithRetry = async () =>
            withRetry(
              async () => {
                const fetchRes = await fetch(input.url, {
                  method: input.method || "GET",
                  headers: fetchHeaders,
                  body: input.body,
                });

                const contentType = fetchRes.headers.get("content-type") || "";
                const statusLine = `[HTTP ${fetchRes.status} ${fetchRes.statusText}]\n`;

                const isBinary =
                  contentType.includes("image/") ||
                  contentType.includes("video/") ||
                  contentType.includes("audio/") ||
                  contentType.includes("application/pdf") ||
                  contentType.includes("application/octet-stream") ||
                  contentType.includes("application/zip");

                if (isBinary && fetchRes.ok) {
                  const blob = await fetchRes.blob();
                  const urlObj = new URL(input.url);
                  const filenameMatch = urlObj.pathname.split("/").pop();
                  const baseName = filenameMatch || `file_${Date.now()}`;

                  let ext = "";
                  if (!baseName.includes(".")) {
                    if (contentType.includes("image/jpeg")) {
                      ext = ".jpg";
                    } else if (contentType.includes("image/png")) {
                      ext = ".png";
                    } else if (contentType.includes("image/gif")) {
                      ext = ".gif";
                    } else if (contentType.includes("image/webp")) {
                      ext = ".webp";
                    } else if (contentType.includes("application/pdf")) {
                      ext = ".pdf";
                    }
                  }

                  const filename = `${baseName}${ext}`;
                  const savePath = `downloads/${filename}`;

                  await uploadGroupFile(db, groupId, savePath, blob);

                  let headerInfo = "";
                  if (input.include_headers) {
                    headerInfo += "--- Request Headers ---\n";
                    for (const [key, value] of Object.entries(fetchHeaders)) {
                      headerInfo += `${key}: ${value}\n`;
                    }

                    headerInfo += "\n--- Response Headers ---\n";
                    fetchRes.headers.forEach((v, k) => {
                      headerInfo += `${k}: ${v}\n`;
                    });
                    headerInfo += "\n";
                  }

                  const markdownSnippet = contentType.includes("image/")
                    ? `![Attachment](${savePath})`
                    : `[Attachment](${savePath})`;
                  const successMsg = `Successfully downloaded binary file (${blob.size} bytes) to workspace path: ${savePath}\n\nTo display this file to the user, output this Markdown in your response:\n${markdownSnippet}`;

                  return {
                    status: statusLine,
                    body: successMsg,
                    headers: headerInfo,
                    ok: true,
                    fetchStatus: fetchRes.status,
                  };
                }

                const rawText = await fetchRes.text();
                let headerInfo = "";
                if (input.include_headers) {
                  headerInfo += "--- Request Headers ---\n";
                  for (const [key, value] of Object.entries(fetchHeaders)) {
                    headerInfo += `${key}: ${value}\n`;
                  }

                  headerInfo += "\n--- Response Headers ---\n";
                  fetchRes.headers.forEach((v, k) => {
                    headerInfo += `${k}: ${v}\n`;
                  });
                  headerInfo += "\n";
                }

                let processedBody = rawText;
                if (
                  contentType.includes("html") ||
                  rawText.trimStart().startsWith("<")
                ) {
                  processedBody = stripHtml(rawText);
                }

                if (
                  !fetchRes.ok &&
                  RETRYABLE_STATUS_CODES.has(fetchRes.status)
                ) {
                  throw new HttpError(
                    fetchRes.status,
                    fetchRes.statusText,
                    processedBody,
                    headerInfo,
                  );
                }

                return {
                  status: statusLine,
                  body: processedBody,
                  headers: headerInfo,
                  ok: fetchRes.ok,
                  fetchStatus: fetchRes.status,
                };
              },
              {
                maxRetries: 3,
                baseDelayMs: 1000,
                jitterFactor: 0.5,
                shouldRetry: (error) => isRetryableFetchError(error),
                onRetry: (attempt, maxRetries, delayMs, error) => {
                  const errMsg =
                    error instanceof Error ? error.message : String(error);

                  post({
                    type: "show-toast",
                    payload: {
                      message: `fetch_url: Retrying (${attempt}/${maxRetries})… ${errMsg}`,
                      type: "warning",
                      duration: 4000,
                    },
                  });
                },
              },
            );

          if (input.use_git_auth) {
            const creds = await resolveGitCredentials(db, input.url, {
              accountId:
                typeof input.git_account_id === "string"
                  ? input.git_account_id
                  : undefined,
              authMode,
            });
            resolvedGitCredentials = creds;
            if (creds.reauthRequired) {
              return (
                `OAuth Git account reconnect required for ${creds.hostPattern || creds.provider || "this remote"}.\n` +
                "Open Settings -> Git, edit this account, and click Connect OAuth to re-authorize."
              );
            }

            const authHeaders = buildAuthHeaders(creds);
            Object.assign(fetchHeaders, authHeaders);
          }

          if (input.use_account_auth) {
            const creds = await resolveServiceCredentials(db, input.url, {
              accountId: serviceAccountId,
              authMode,
            });
            resolvedServiceCredentials = creds;
            if (creds?.reauthRequired) {
              return (
                `OAuth account reconnect required for ${creds.service} (${creds.hostPattern}).\n` +
                "Open Settings -> Accounts, edit this account, and click Connect OAuth to re-authorize."
              );
            }

            if (creds?.headerValue) {
              fetchHeaders[creds.headerName] = creds.headerValue;
            }
          }

          let fetchResult = await runFetchWithRetry();

          // If OAuth-backed account gets a 401/403, force-refresh credentials and retry once.
          if (
            (fetchResult.fetchStatus === 401 ||
              fetchResult.fetchStatus === 403) &&
            input.use_account_auth &&
            resolvedServiceCredentials?.authMode === "oauth"
          ) {
            const refreshedCredentials = await resolveServiceCredentials(
              db,
              input.url,
              {
                accountId:
                  resolvedServiceCredentials.accountId || serviceAccountId,
                authMode,
                forceRefresh: true,
              },
            );

            if (
              refreshedCredentials?.headerValue &&
              refreshedCredentials.headerValue !==
                fetchHeaders[refreshedCredentials.headerName]
            ) {
              fetchHeaders[refreshedCredentials.headerName] =
                refreshedCredentials.headerValue;
              fetchResult = await runFetchWithRetry();
            }
          }

          if (
            (fetchResult.fetchStatus === 401 ||
              fetchResult.fetchStatus === 403) &&
            input.use_git_auth &&
            resolvedGitCredentials?.authMode === "oauth"
          ) {
            const refreshedCredentials = await resolveGitCredentials(
              db,
              input.url,
              {
                accountId:
                  resolvedGitCredentials.accountId ||
                  (typeof input.git_account_id === "string"
                    ? input.git_account_id
                    : undefined),
                authMode,
                forceRefresh: true,
              },
            );

            if (refreshedCredentials.reauthRequired) {
              return (
                `OAuth Git account reconnect required for ${refreshedCredentials.hostPattern || refreshedCredentials.provider || "this remote"}.\n` +
                "Open Settings -> Git, edit this account, and click Connect OAuth to re-authorize."
              );
            }

            const refreshedHeaders = buildAuthHeaders(refreshedCredentials);
            const headersChanged = Object.entries(refreshedHeaders).some(
              ([key, value]) => fetchHeaders[key] !== value,
            );

            if (headersChanged) {
              Object.assign(fetchHeaders, refreshedHeaders);
              fetchResult = await runFetchWithRetry();
            }
          }

          const { status, body, headers } = fetchResult;

          if (!body && status.includes("Error")) {
            return status;
          }

          // Handle non-retryable HTTP errors (e.g. 401, 403, 404)
          const statusCodeMatch = status.match(/HTTP (\d+)/);
          const statusCode = statusCodeMatch ? Number(statusCodeMatch[1]) : 200;

          if (statusCode >= 400) {
            let hint = "";
            if (
              statusCode === 401 &&
              !input.use_git_auth &&
              /github|git\.|ghe\.|dev\.azure\.com|visualstudio\.com|gitlab/i.test(
                input.url,
              )
            ) {
              hint =
                "\n\nHint: This looks like a Git host and you received a 401. " +
                "Retry with use_git_auth: true to inject the saved Git credentials " +
                "(auth format is auto-detected per provider).";
            } else if (statusCode === 401 && !input.use_account_auth) {
              // Check if any saved service account might cover this URL
              const svcCreds = await resolveServiceCredentials(db, input.url);
              if (svcCreds) {
                hint =
                  `\n\nHint: A saved account for "${svcCreds.service}" (${svcCreds.hostPattern}) ` +
                  "was found. Retry with use_account_auth: true to inject that PAT.";
              }
            }

            return `${status}${headers}Error fetching URL. Content preview:\n${body.slice(0, 1000)}${hint}`;
          }

          // Detect login / auth-wall pages returned as HTTP 200
          const GIT_HOST_RE =
            /github|git\.|ghe\.|dev\.azure\.com|visualstudio\.com|gitlab/i;
          if (
            statusCode === 200 &&
            !input.use_git_auth &&
            GIT_HOST_RE.test(input.url) &&
            /sign.in|log.?in|username.*password/i.test(body)
          ) {
            return (
              `${status}${headers}` +
              `⚠️ The server returned a login/authentication page instead of API data. ` +
              `This usually means the request requires authentication.\n\n` +
              `Hint: Retry with use_git_auth: true to inject the saved Git credentials.\n\n` +
              `Page preview:\n${body.slice(0, 500)}`
            );
          }

          const truncated = body.length > FETCH_MAX_RESPONSE;
          const content = truncated
            ? body.slice(0, FETCH_MAX_RESPONSE) +
              `\n\n--- Response truncated (showed ${FETCH_MAX_RESPONSE.toLocaleString()} of ${body.length.toLocaleString()} chars) ---`
            : body;

          return status + headers + content;
        } catch (fetchErr) {
          // HttpError from exhausted retries — return a structured error
          if (fetchErr instanceof HttpError) {
            return `[HTTP ${fetchErr.status} ${fetchErr.statusText}]\n${fetchErr.headers}Error fetching URL after retries. Content preview:\n${fetchErr.body.slice(0, 1000)}`;
          }

          const errMsg =
            fetchErr instanceof Error ? fetchErr.message : String(fetchErr);

          return `Network Error: Failed to fetch ${input.url} (after retries).\nReason: ${errMsg}\nCheck if the URL is correct and the server is reachable. If this is a CORS issue, it may be blocked by the browser.`;
        }
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

      case "remote_mcp_list_tools": {
        if (!input.connection_id || typeof input.connection_id !== "string") {
          return "Error: remote_mcp_list_tools requires connection_id.";
        }

        const tools = await listRemoteMcpTools(db, input.connection_id);
        if (!tools.length) {
          return `No tools exposed by remote MCP connection ${input.connection_id}.`;
        }

        return tools
          .map(
            (tool) =>
              `- ${tool.name}${tool.description ? `: ${tool.description}` : ""}`,
          )
          .join("\n");
      }

      case "remote_mcp_call_tool": {
        if (!input.connection_id || typeof input.connection_id !== "string") {
          return "Error: remote_mcp_call_tool requires connection_id.";
        }

        if (!input.tool_name || typeof input.tool_name !== "string") {
          return "Error: remote_mcp_call_tool requires tool_name.";
        }

        const result = await callRemoteMcpTool(
          db,
          input.connection_id,
          input.tool_name,
          input.arguments && typeof input.arguments === "object"
            ? input.arguments
            : {},
        );

        return JSON.stringify(result, null, 2);
      }

      // ── Git tools (isomorphic-git) ───────────────────────────────
      case "git_clone": {
        const creds = await resolveGitCredentials(db, input.url);

        const pref = await getConfig(db, CONFIG_KEYS.GIT_CORS_PROXY);
        const customUrl = await getConfig(db, CONFIG_KEYS.GIT_PROXY_URL);
        const corsProxy = getProxyUrl(
          pref === "public" ? "public" : pref === "custom" ? "custom" : "local",
          customUrl,
        );

        const repo = (await gitClone({
          url: input.url,
          branch: input.branch,
          depth: input.depth,
          corsProxy,
          token: creds.token,
          username: creds.username,
          password: creds.password,
        })) as string;

        const includeGit = input.include_git === true;
        await syncLfsToOpfs(db, groupId, repo, `repos/${repo}`, includeGit);

        return `Cloned ${input.url} as "${repo}". Files are available recursively at "repos/${repo}". Use repo="${repo}" for other git_ tools.`;
      }

      case "git_sync": {
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
        const result = (await gitCheckout({
          repo: input.repo,
          ref: input.ref,
        })) as string;
        await syncLfsToOpfs(db, groupId, input.repo, `repos/${input.repo}`);

        return result;
      }

      case "git_branch": {
        const result = (await gitBranch({
          repo: input.repo,
          name: input.name,
          checkout: input.checkout,
          startPoint: input.start_point,
        })) as string;

        if (input.checkout) {
          await syncLfsToOpfs(db, groupId, input.repo, `repos/${input.repo}`);
        }

        return result;
      }

      case "git_status": {
        try {
          await syncOpfsToLfs(db, groupId, `repos/${input.repo}`, input.repo);
        } catch {
          // Ignore if OPFS folder doesn't exist yet
        }

        return (await gitStatus({ repo: input.repo })) as string;
      }

      case "git_add": {
        try {
          await syncOpfsToLfs(db, groupId, `repos/${input.repo}`, input.repo);
        } catch {
          // Ignore if OPFS folder doesn't exist yet
        }

        return (await gitAdd({
          repo: input.repo,
          filepath: input.filepath,
        })) as string;
      }

      case "git_log": {
        return (await gitLog({
          repo: input.repo,
          ref: input.ref,
          depth: input.depth,
        })) as string;
      }

      case "git_diff": {
        try {
          await syncOpfsToLfs(db, groupId, `repos/${input.repo}`, input.repo);
        } catch {
          // Ignore missing OPFS dir
        }

        return (await gitDiff({
          repo: input.repo,
          ref1: input.ref1,
          ref2: input.ref2,
        })) as string;
      }

      case "git_branches": {
        return (await gitListBranches({
          repo: input.repo,
          remote: input.remote,
        })) as string;
      }

      case "git_list_repos": {
        return (await gitListRepos()) as string;
      }

      case "git_delete_repo": {
        return (await gitDeleteRepo({ repo: input.repo })) as string;
      }

      case "git_commit": {
        const getCommitRemUrl = getRemoteUrl;
        try {
          await syncOpfsToLfs(db, groupId, `repos/${input.repo}`, input.repo);
        } catch (err) {
          return `Error: Could not sync from OPFS. Did you delete repos/${input.repo}?`;
        }

        const commitRemoteUrl = await getCommitRemUrl(input.repo);
        const commitCreds = await resolveGitCredentials(db, commitRemoteUrl);

        let authorName = input.author_name;
        let authorEmail = input.author_email;

        if (!authorName) {
          authorName =
            commitCreds.authorName ||
            (await getConfig(db, CONFIG_KEYS.GIT_AUTHOR_NAME)) ||
            undefined;
        }

        if (!authorEmail) {
          authorEmail =
            commitCreds.authorEmail ||
            (await getConfig(db, CONFIG_KEYS.GIT_AUTHOR_EMAIL)) ||
            undefined;
        }

        return (await gitCommit({
          repo: input.repo,
          message: input.message,
          authorName,
          authorEmail,
        })) as string;
      }

      case "git_pull": {
        const remoteUrl = await getRemoteUrl(input.repo);
        const creds = await resolveGitCredentials(db, remoteUrl);

        const pref = await getConfig(db, CONFIG_KEYS.GIT_CORS_PROXY);
        const customUrl = await getConfig(db, CONFIG_KEYS.GIT_PROXY_URL);
        const corsProxy = getProxyUrl(
          pref === "public" ? "public" : pref === "custom" ? "custom" : "local",
          customUrl,
        );

        let authorName = input.author_name;
        let authorEmail = input.author_email;

        if (!authorName) {
          authorName =
            creds.authorName ||
            (await getConfig(db, CONFIG_KEYS.GIT_AUTHOR_NAME)) ||
            undefined;
        }

        if (!authorEmail) {
          authorEmail =
            creds.authorEmail ||
            (await getConfig(db, CONFIG_KEYS.GIT_AUTHOR_EMAIL)) ||
            undefined;
        }

        return (await gitPull({
          repo: input.repo,
          branch: input.branch,
          authorName,
          authorEmail,
          token: creds.token,
          username: creds.username,
          password: creds.password,
          corsProxy,
        })) as string;
      }

      case "git_push": {
        const getRemUrl = getRemoteUrl;
        const pushRemoteUrl = await getRemUrl(input.repo);
        const creds = await resolveGitCredentials(db, pushRemoteUrl);

        if (!creds.token && !creds.username) {
          return "Error: No git credentials configured. Add a Git account with a Personal Access Token or username/password in Settings → Git.";
        }

        const pref = await getConfig(db, CONFIG_KEYS.GIT_CORS_PROXY);
        const customUrl = await getConfig(db, CONFIG_KEYS.GIT_PROXY_URL);
        const corsProxy = getProxyUrl(
          pref === "public" ? "public" : pref === "custom" ? "custom" : "local",
          customUrl,
        );

        return (await gitPush({
          repo: input.repo,
          branch: input.branch,
          remoteRef: input.remote_ref,
          force: input.force,
          token: creds.token,
          username: creds.username,
          password: creds.password,
          corsProxy,
        })) as string;
      }

      case "git_merge": {
        try {
          await syncOpfsToLfs(db, groupId, `repos/${input.repo}`, input.repo);
        } catch {
          // Ignore if OPFS folder doesn't exist yet
        }

        let authorName = input.author_name;
        let authorEmail = input.author_email;

        if (!authorName) {
          const stored = await getConfig(db, CONFIG_KEYS.GIT_AUTHOR_NAME);
          if (stored) {
            authorName = stored;
          }
        }

        if (!authorEmail) {
          const stored = await getConfig(db, CONFIG_KEYS.GIT_AUTHOR_EMAIL);
          if (stored) {
            authorEmail = stored;
          }
        }

        let mergeResult;
        try {
          mergeResult = (await gitMerge({
            repo: input.repo,
            theirs: input.theirs,
            authorName,
            authorEmail,
          })) as string;
        } catch (mergeErr: any) {
          // Sync conflicted files back so the agent can read/edit them
          await syncLfsToOpfs(db, groupId, input.repo, `repos/${input.repo}`);

          // Extract conflicted file paths from isomorphic-git error
          const conflictPaths =
            mergeErr?.data?.filepaths ||
            extractConflictPaths(mergeErr?.message ?? String(mergeErr));

          // Build rich conflict report with inline conflict regions
          const sections: string[] = [];
          for (const fp of conflictPaths) {
            const wsPath = `repos/${input.repo}/${fp}`;
            try {
              const content = await readGroupFile(db, groupId, wsPath);
              const regions = parseConflictRegions(content);
              if (regions.length > 0) {
                const regionDescs = regions.map((r, i) => {
                  const oursSnip = truncateSnippet(r.ours, 30);
                  const theirsSnip = truncateSnippet(r.theirs, 30);

                  return (
                    `  Conflict ${i + 1} (line ~${r.startLine}):\n` +
                    `    <<<<<<< ${r.oursLabel}\n${indent(oursSnip, "    ")}\n` +
                    `    =======\n${indent(theirsSnip, "    ")}\n` +
                    `    >>>>>>> ${r.theirsLabel}`
                  );
                });
                sections.push(
                  `${fp} — ${regions.length} conflict(s):\n${regionDescs.join("\n")}`,
                );
              } else {
                sections.push(
                  `${fp} — conflict markers not found (may have auto-resolved)`,
                );
              }
            } catch {
              sections.push(`${fp} — could not read file`);
            }
          }

          const header =
            `Automatic merge failed with conflicts in ${conflictPaths.length} file(s).\n` +
            `Conflicted files have been synced to the workspace with conflict markers.\n`;

          const instructions =
            `\nResolution steps:\n` +
            `1. Use read_file on each conflicted file to see the full content with <<<<<<< / ======= / >>>>>>> markers.\n` +
            `2. Decide the correct resolution (keep ours, keep theirs, or combine).\n` +
            `3. Use write_file to write the COMPLETE resolved file without any conflict markers.\n` +
            `4. After ALL files are resolved, use git_add for each file, then git_commit.\n` +
            `Important: Use write_file (not bash/sed) to write resolved files. Ensure NO conflict markers remain.`;

          return `${header}\n${sections.join("\n\n")}\n${instructions}`;
        }

        await syncLfsToOpfs(db, groupId, input.repo, `repos/${input.repo}`);

        return mergeResult;
      }

      case "git_reset": {
        const result = (await gitReset({
          repo: input.repo,
          ref: input.ref,
        })) as string;

        await syncLfsToOpfs(db, groupId, input.repo, `repos/${input.repo}`);

        return result;
      }

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err) {
    return `Tool error (${name}): ${err instanceof Error ? err.message : String(err)}`;
  }
}
