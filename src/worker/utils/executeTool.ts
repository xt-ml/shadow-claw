import { CONFIG_KEYS, FETCH_MAX_RESPONSE } from "../../config/config.js";

import { getConfig } from "../../db/getConfig.js";
import { ShadowClawDatabase } from "../../db/types.js";

import { getGroupDir } from "../../storage/getGroupDir.js";
import { readGroupFile } from "../../storage/readGroupFile.js";
import { uploadGroupFile } from "../../storage/uploadGroupFile.js";
import { writeGroupFile } from "../../storage/writeGroupFile.js";

import { resolveServiceCredentials } from "../../subsystems/accounts/service-accounts.js";

import {
  buildAuthHeaders,
  resolveGitCredentials,
} from "../../subsystems/git/credentials.js";

import {
  callRemoteMcpTool,
  listRemoteMcpTools,
  McpReauthRequiredError,
} from "../../subsystems/mcp/remote-mcp-client.js";

import { post } from "./post.js";
import { stripHtml } from "./stripHtml.js";

import { executeBash } from "../tools/bash/bash.js";
import { executeManageEmailTool } from "../tools/email/email.js";
import { executeFetchFileTool } from "../tools/fetch-file/fetch-file.js";
import { executeFetchUrlTool } from "../tools/fetch-url/fetch-url.js";
import { executeGitTool } from "../tools/git/git.js";

import {
  executeRemoteMcpCallTool,
  executeRemoteMcpListTools,
} from "../tools/remote-mcp/remote-mcp.js";

import { executeCreateRoom } from "../tools/rooms/create-room.js";
import { executeInviteToRoom } from "../tools/rooms/invite-to-room.js";
import { executeLeaveRoom } from "../tools/rooms/leave-room.js";
import { executeListRoomMembers } from "../tools/rooms/list-room-members.js";
import { executeSpawnSubagentTool } from "../tools/spawn-subagent/spawn-subagent.js";
import { executeCreateTask } from "../tools/tasks/create-task.js";
import { executeDeleteTask } from "../tools/tasks/delete-task.js";
import { executeDisableTask } from "../tools/tasks/disable-task.js";
import { executeEnableTask } from "../tools/tasks/enable-task.js";
import { executeListTasks } from "../tools/tasks/list-tasks.js";
import { executeRunTask } from "../tools/tasks/run-task.js";
import { executeUpdateTask } from "../tools/tasks/update-task.js";
import { executeAskUser } from "../tools/ui/ask-user.js";
import { executeClearChat } from "../tools/ui/clear-chat.js";
import { executeGetCurrentTime } from "../tools/ui/get-current-time.js";
import { executeJavascript } from "../tools/ui/javascript.js";
import { executeListComponents } from "../tools/ui/list-components.js";
import { executeListToolProfiles } from "../tools/ui/list-tool-profiles.js";
import { executeManageTools } from "../tools/ui/manage-tools.js";
import { executeRenderComponent } from "../tools/ui/render-component.js";
import { executeSendNotification } from "../tools/ui/send-notification.js";
import { executeShowToast } from "../tools/ui/show-toast.js";
import { executeWebSearch } from "../tools/ui/web-search.js";
import { executeAttachFile } from "../tools/workspace/attach-file.js";
import { executeCopyFile } from "../tools/workspace/copy-file.js";
import { executeCreateDirectory } from "../tools/workspace/create-directory.js";
import { executeDeleteFile } from "../tools/workspace/delete-file.js";
import { executeDiffFiles } from "../tools/workspace/diff-files.js";
import { executeListFiles } from "../tools/workspace/list-files.js";
import { executeMoveFile } from "../tools/workspace/move-file.js";
import { executeOpenFile } from "../tools/workspace/open-file.js";
import { executePatchFile } from "../tools/workspace/patch-file.js";
import { executeReadFile } from "../tools/workspace/read-file.js";
import { executeSearchFiles } from "../tools/workspace/search-files.js";
import { executeSendFile } from "../tools/workspace/send-file.js";
import { executeUpdateMemory } from "../tools/workspace/update-memory.js";
import { executeWriteFile } from "../tools/workspace/write-file.js";
import { toolsStore } from "../../stores/tools.js";
import {
  executeDetectLanguage,
  executeProofreadText,
  executeRewriteText,
  executeSummarizeText,
  executeTranslateText,
  executeWriteText,
} from "../tools/builtin-ai/builtin-ai.js";

import {
  isRetryableFetchError,
  RETRYABLE_STATUS_CODES,
  withRetry,
} from "./withRetry.js";

import type { ToolResultContentBlock } from "../../content/types.js";
import type { SubagentInvokeContext } from "../tools/spawn-subagent/spawn-subagent.js";

export type { SubagentInvokeContext };

export type ToolResult = string | ToolResultContentBlock[];

type GitSubsystem = typeof import("../../subsystems/git/git.js");

let gitSubsystemPromise: Promise<GitSubsystem> | null = null;

async function loadGitSubsystem(): Promise<GitSubsystem> {
  if (!gitSubsystemPromise) {
    gitSubsystemPromise = import("../../subsystems/git/git.js");
  }

  return gitSubsystemPromise;
}

function toAllowedToolNameSet(
  allowedTools:
    | ReadonlyArray<string | { name?: unknown } | undefined>
    | undefined,
): Set<string> | null {
  if (!Array.isArray(allowedTools)) {
    return null;
  }

  const names = allowedTools
    .map((tool) =>
      typeof tool === "string"
        ? tool
        : typeof tool?.name === "string"
          ? tool.name
          : null,
    )
    .filter(Boolean);

  return new Set(names);
}

/**
 * Execute a tool
 */
export async function executeTool(
  db: ShadowClawDatabase,
  name: string,
  input: Record<string, any>,
  groupId: string,
  options: {
    allowedTools?: ReadonlyArray<string | { name?: unknown }>;
    invokeContext?: SubagentInvokeContext;
    isScheduledTask?: boolean;
    isTaskExecution?: boolean;
  } = {},
): Promise<ToolResult> {
  try {
    // Re-validate the requested tool against the active profile. Generation-time
    // constraints (JSON schema enums) are a hint, not a guarantee.
    const allowedToolNames = toAllowedToolNameSet(options.allowedTools);
    if (allowedToolNames && !allowedToolNames.has(name)) {
      return `Tool "${name}" is not allowed in the current context. Do not call it again. Use one of the available tools or ask for help.`;
    }

    // Block run_task in any task execution context (scheduled OR manual) to
    // prevent runaway self-triggering loops. run_task is only safe from the
    // top-level agent conversation, not from within a task itself.
    if (options.isScheduledTask || options.isTaskExecution) {
      if (name === "run_task") {
        return `Tool "run_task" cannot be called from within a task execution to prevent infinite loops.`;
      }
    }

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
        "create_room",
        "invite_to_room",
        "leave_room",
      ]);

      if (BLOCKED_TOOLS.has(name)) {
        return `Tool "${name}" is not allowed during scheduled task execution to prevent recursion.`;
      }
    }

    switch (name) {
      case "bash": {
        return await executeBash(db, input, groupId);
      }

      case "read_file": {
        return await executeReadFile(db, input, groupId);
      }

      case "open_file": {
        return await executeOpenFile(db, input, groupId);
      }

      case "attach_file_to_chat": {
        return await executeAttachFile(db, input, groupId);
      }

      case "send_file": {
        return await executeSendFile(db, input, groupId);
      }

      case "write_file": {
        return await executeWriteFile(db, input, groupId);
      }

      case "delete_file": {
        return await executeDeleteFile(db, input, groupId);
      }

      case "move_file": {
        return await executeMoveFile(db, input, groupId);
      }

      case "copy_file": {
        return await executeCopyFile(db, input, groupId);
      }

      case "create_directory": {
        return await executeCreateDirectory(db, input, groupId);
      }

      case "patch_file": {
        return await executePatchFile(db, input, groupId);
      }

      case "list_files": {
        return await executeListFiles(db, input, groupId);
      }

      case "manage_tools": {
        return executeManageTools(input, groupId);
      }

      case "list_tool_profiles": {
        return await executeListToolProfiles(db);
      }

      case "fetch_url": {
        return await executeFetchUrlTool(db, input, groupId, {
          buildAuthHeaders,
          fetchImpl: fetch,
          fetchMaxResponse: FETCH_MAX_RESPONSE,
          isRetryableFetchError,
          post,
          resolveGitCredentials,
          resolveServiceCredentials,
          retryableStatusCodes: RETRYABLE_STATUS_CODES,
          stripHtml,
          uploadGroupFile,
          withRetry,
        });
      }

      case "fetch_file": {
        return await executeFetchFileTool(db, input, groupId, {
          buildAuthHeaders,
          fetchImpl: fetch,
          isRetryableFetchError,
          post,
          resolveGitCredentials,
          resolveServiceCredentials,
          retryableStatusCodes: RETRYABLE_STATUS_CODES,
          uploadGroupFile,
          withRetry,
          writeGroupFile,
        });
      }

      case "update_memory": {
        return await executeUpdateMemory(db, input, groupId);
      }

      case "create_task": {
        return executeCreateTask(input, groupId);
      }

      case "javascript": {
        return await executeJavascript(db, input);
      }

      case "list_tasks": {
        return await executeListTasks(db, groupId);
      }

      case "update_task": {
        return await executeUpdateTask(db, input, groupId);
      }

      case "enable_task": {
        return await executeEnableTask(db, input, groupId);
      }

      case "disable_task": {
        return await executeDisableTask(db, input, groupId);
      }

      case "delete_task": {
        return executeDeleteTask(input, groupId);
      }

      case "run_task": {
        return await executeRunTask(db, input, groupId);
      }

      case "clear_chat": {
        return executeClearChat(groupId);
      }

      case "show_toast": {
        return executeShowToast(input);
      }

      case "send_notification": {
        return executeSendNotification(input, groupId);
      }

      case "create_room": {
        return executeCreateRoom(input);
      }

      case "invite_to_room": {
        return executeInviteToRoom(input, groupId);
      }

      case "leave_room": {
        return executeLeaveRoom(input, groupId);
      }

      case "list_room_members": {
        return await executeListRoomMembers(db, input, groupId);
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
          callRemoteMcpTool,
          listRemoteMcpTools,
          McpReauthRequiredError,
          post,
        });
      }

      case "remote_mcp_call_tool": {
        return await executeRemoteMcpCallTool(db, input, groupId, {
          callRemoteMcpTool,
          listRemoteMcpTools,
          McpReauthRequiredError,
          post,
        });
      }

      // ── Git tools (isomorphic-git) ───────────────────────────────
      case "git_clone":
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
      case "git_reset":
      case "git_fetch":
      case "git_read_file_at_ref":
      case "git_show":
      case "git_delete_branch":
      case "git_init":
      case "git_tag":
      case "git_remote":
      case "git_config":
      case "git_unstage": {
        const git = await loadGitSubsystem();

        return await executeGitTool(db, name, input, groupId, {
          configKeys: {
            GIT_CORS_PROXY: CONFIG_KEYS.GIT_CORS_PROXY,
            GIT_PROXY_URL: CONFIG_KEYS.GIT_PROXY_URL,
            GIT_AUTHOR_NAME: CONFIG_KEYS.GIT_AUTHOR_NAME,
            GIT_AUTHOR_EMAIL: CONFIG_KEYS.GIT_AUTHOR_EMAIL,
          },
          getConfig,
          getGroupDir,
          getProxyUrl: git.getProxyUrl,
          getRemoteUrl: git.getRemoteUrl,
          gitAdd: git.gitAdd,
          gitBranch: git.gitBranch,
          gitCheckout: git.gitCheckout,
          gitClone: git.gitClone,
          gitCommit: git.gitCommit,
          gitConfig: git.gitConfig,
          gitDeleteBranch: git.gitDeleteBranch,
          gitDeleteRepo: git.gitDeleteRepo,
          gitDiff: git.gitDiff,
          gitFetch: git.gitFetch,
          gitInit: git.gitInit,
          gitListBranches: git.gitListBranches,
          gitListRepos: git.gitListRepos,
          gitListTags: git.gitListTags,
          gitLog: git.gitLog,
          gitMerge: git.gitMerge,
          gitPull: git.gitPull,
          gitPush: git.gitPush,
          gitReadFileAtRef: git.gitReadFileAtRef,
          gitRemote: git.gitRemote,
          gitReset: git.gitReset,
          gitShow: git.gitShow,
          gitStatus: git.gitStatus,
          gitTag: git.gitTag,
          gitUnstage: git.gitUnstage,
          readGroupFile,
          resolveGitCredentials,
        });
      }

      case "list_components": {
        return executeListComponents();
      }

      case "render_component": {
        return executeRenderComponent(input, groupId);
      }

      case "spawn_subagent": {
        if (!options.invokeContext) {
          return "Error: spawn_subagent requires an active agent invocation context. This tool cannot be called directly.";
        }

        return await executeSpawnSubagentTool(
          input,
          groupId,
          options.invokeContext,
        );
      }

      case "get_current_time": {
        return executeGetCurrentTime(input);
      }

      case "search_files": {
        return await executeSearchFiles(db, input, groupId, {
          maxFileBytes: toolsStore.searchFilesMaxFileBytes,
          maxFilesVisited: toolsStore.searchFilesMaxFilesVisited,
          skipDirs: toolsStore.searchFilesSkipDirsSet,
        });
      }

      case "diff_files": {
        return await executeDiffFiles(db, input, groupId);
      }

      case "ask_user": {
        return await executeAskUser(input, groupId);
      }

      case "web_search": {
        return await executeWebSearch(input);
      }

      case "summarize_text": {
        return await executeSummarizeText(input, groupId);
      }

      case "write_text": {
        return await executeWriteText(input, groupId);
      }

      case "rewrite_text": {
        return await executeRewriteText(input, groupId);
      }

      case "proofread_text": {
        return await executeProofreadText(input, groupId);
      }

      case "detect_language": {
        return await executeDetectLanguage(input, groupId);
      }

      case "translate_text": {
        return await executeTranslateText(input, groupId);
      }

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err) {
    return `Tool error (${name}): ${err instanceof Error ? err.message : String(err)}`;
  }
}
