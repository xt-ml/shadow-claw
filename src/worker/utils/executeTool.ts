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
import {
  executePromptPeer,
  executeListPeers,
} from "../tools/peer/prompt-peer.js";
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
import { executeActivateSkill } from "../../subsystems/skills/activateSkill.js";
import { toolsStore } from "../../stores/tools.js";
import {
  executeDetectLanguage,
  executeEmbedText,
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
import { runToolGuards } from "./guards.js";
import { executeDeclarativeTool } from "./declarativeToolExecutor.js";

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

export type ExecuteToolOptions = {
  allowedTools?: ReadonlyArray<string | { name?: unknown }>;
  invokeContext?: SubagentInvokeContext;
  isScheduledTask?: boolean;
  isTaskExecution?: boolean;
  declarativeDepth?: number;
};

type ToolHandler = (
  db: ShadowClawDatabase,
  input: Record<string, any>,
  groupId: string,
  options: ExecuteToolOptions,
) => Promise<ToolResult> | ToolResult;

async function executeGitToolDispatcher(
  db: ShadowClawDatabase,
  name: string,
  input: Record<string, any>,
  groupId: string,
): Promise<ToolResult> {
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

const TOOL_HANDLERS = new Map<string, ToolHandler>();

// Basic filesystem / execution tools
TOOL_HANDLERS.set("bash", (db, input, groupId) =>
  executeBash(db, input, groupId),
);
TOOL_HANDLERS.set("read_file", (db, input, groupId) =>
  executeReadFile(db, input, groupId),
);
TOOL_HANDLERS.set("open_file", (db, input, groupId) =>
  executeOpenFile(db, input, groupId),
);
TOOL_HANDLERS.set("attach_file_to_chat", (db, input, groupId) =>
  executeAttachFile(db, input, groupId),
);
TOOL_HANDLERS.set("send_file", (db, input, groupId) =>
  executeSendFile(db, input, groupId),
);
TOOL_HANDLERS.set("write_file", (db, input, groupId) =>
  executeWriteFile(db, input, groupId),
);
TOOL_HANDLERS.set("delete_file", (db, input, groupId) =>
  executeDeleteFile(db, input, groupId),
);
TOOL_HANDLERS.set("move_file", (db, input, groupId) =>
  executeMoveFile(db, input, groupId),
);
TOOL_HANDLERS.set("copy_file", (db, input, groupId) =>
  executeCopyFile(db, input, groupId),
);
TOOL_HANDLERS.set("create_directory", (db, input, groupId) =>
  executeCreateDirectory(db, input, groupId),
);
TOOL_HANDLERS.set("patch_file", (db, input, groupId) =>
  executePatchFile(db, input, groupId),
);
TOOL_HANDLERS.set("list_files", (db, input, groupId) =>
  executeListFiles(db, input, groupId),
);
TOOL_HANDLERS.set("manage_tools", (_db, input, groupId) =>
  executeManageTools(input, groupId),
);
TOOL_HANDLERS.set("list_tool_profiles", (db) => executeListToolProfiles(db));
TOOL_HANDLERS.set("fetch_url", (db, input, groupId) =>
  executeFetchUrlTool(db, input, groupId, {
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
  }),
);
TOOL_HANDLERS.set("fetch_file", (db, input, groupId) =>
  executeFetchFileTool(db, input, groupId, {
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
  }),
);
TOOL_HANDLERS.set("update_memory", (db, input, groupId) =>
  executeUpdateMemory(db, input, groupId),
);
TOOL_HANDLERS.set("create_task", (_db, input, groupId) =>
  executeCreateTask(input, groupId),
);
TOOL_HANDLERS.set("javascript", (db, input) => executeJavascript(db, input));
TOOL_HANDLERS.set("activate_skill", (db, input, groupId) =>
  executeActivateSkill(db, input, groupId),
);
TOOL_HANDLERS.set("list_tasks", (db, _input, groupId) =>
  executeListTasks(db, groupId),
);
TOOL_HANDLERS.set("update_task", (db, input, groupId) =>
  executeUpdateTask(db, input, groupId),
);
TOOL_HANDLERS.set("enable_task", (db, input, groupId) =>
  executeEnableTask(db, input, groupId),
);
TOOL_HANDLERS.set("disable_task", (db, input, groupId) =>
  executeDisableTask(db, input, groupId),
);
TOOL_HANDLERS.set("delete_task", (_db, input, groupId) =>
  executeDeleteTask(input, groupId),
);
TOOL_HANDLERS.set("run_task", (db, input, groupId) =>
  executeRunTask(db, input, groupId),
);
TOOL_HANDLERS.set("clear_chat", (_db, _input, groupId) =>
  executeClearChat(groupId),
);
TOOL_HANDLERS.set("show_toast", (_db, input) => executeShowToast(input));
TOOL_HANDLERS.set("send_notification", (_db, input, groupId) =>
  executeSendNotification(input, groupId),
);
TOOL_HANDLERS.set("create_room", (_db, input) => executeCreateRoom(input));
TOOL_HANDLERS.set("invite_to_room", (_db, input, groupId) =>
  executeInviteToRoom(input, groupId),
);
TOOL_HANDLERS.set("leave_room", (_db, input, groupId) =>
  executeLeaveRoom(input, groupId),
);
TOOL_HANDLERS.set("list_room_members", (db, input, groupId) =>
  executeListRoomMembers(db, input, groupId),
);
TOOL_HANDLERS.set("prompt_peer", (db, input, groupId) =>
  executePromptPeer(db, input, groupId),
);
TOOL_HANDLERS.set("list_peers", (db, input, groupId) =>
  executeListPeers(db, input, groupId),
);

// Email & integration tools
const executeEmail = (
  db: ShadowClawDatabase,
  input: Record<string, any>,
  groupId: string,
) => executeManageEmailTool(db, input, groupId);
TOOL_HANDLERS.set("manage_email", executeEmail);
TOOL_HANDLERS.set("manage_integration", executeEmail);
TOOL_HANDLERS.set("email_read_messages", (db, input, groupId) =>
  executeTool(
    db,
    "manage_email",
    { ...input, action: "read_messages" },
    groupId,
  ),
);
TOOL_HANDLERS.set("integration_read_messages", (db, input, groupId) =>
  executeTool(
    db,
    "manage_email",
    { ...input, action: "read_messages" },
    groupId,
  ),
);
TOOL_HANDLERS.set("email_send_message", (db, input, groupId) =>
  executeTool(
    db,
    "manage_email",
    { ...input, action: "send_message" },
    groupId,
  ),
);
TOOL_HANDLERS.set("integration_send_message", (db, input, groupId) =>
  executeTool(
    db,
    "manage_email",
    { ...input, action: "send_message" },
    groupId,
  ),
);

// Remote MCP tools
TOOL_HANDLERS.set("remote_mcp_list_tools", (db, input, groupId) =>
  executeRemoteMcpListTools(db, input, groupId, {
    callRemoteMcpTool,
    listRemoteMcpTools,
    McpReauthRequiredError,
    post,
  }),
);
TOOL_HANDLERS.set("remote_mcp_call_tool", (db, input, groupId) =>
  executeRemoteMcpCallTool(db, input, groupId, {
    callRemoteMcpTool,
    listRemoteMcpTools,
    McpReauthRequiredError,
    post,
  }),
);

// Git tools (isomorphic-git)
const GIT_TOOL_NAMES = [
  "git_clone",
  "git_checkout",
  "git_branch",
  "git_status",
  "git_add",
  "git_log",
  "git_diff",
  "git_branches",
  "git_list_repos",
  "git_delete_repo",
  "git_commit",
  "git_pull",
  "git_push",
  "git_merge",
  "git_reset",
  "git_fetch",
  "git_read_file_at_ref",
  "git_show",
  "git_delete_branch",
  "git_init",
  "git_tag",
  "git_remote",
  "git_config",
  "git_unstage",
];
for (const gitName of GIT_TOOL_NAMES) {
  TOOL_HANDLERS.set(gitName, (db, input, groupId) =>
    executeGitToolDispatcher(db, gitName, input, groupId),
  );
}

// UI / auxiliary tools
TOOL_HANDLERS.set("list_components", () => executeListComponents());
TOOL_HANDLERS.set("render_component", (_db, input, groupId) =>
  executeRenderComponent(input, groupId),
);
TOOL_HANDLERS.set("spawn_subagent", async (_db, input, groupId, options) => {
  if (!options?.invokeContext) {
    return "Error: spawn_subagent requires an active agent invocation context. This tool cannot be called directly.";
  }
  return await executeSpawnSubagentTool(input, groupId, options.invokeContext);
});
TOOL_HANDLERS.set("get_current_time", (_db, input) =>
  executeGetCurrentTime(input),
);
TOOL_HANDLERS.set("search_files", (db, input, groupId) =>
  executeSearchFiles(db, input, groupId, {
    maxFileBytes: toolsStore.searchFilesMaxFileBytes,
    maxFilesVisited: toolsStore.searchFilesMaxFilesVisited,
    skipDirs: toolsStore.searchFilesSkipDirsSet,
  }),
);
TOOL_HANDLERS.set("diff_files", (db, input, groupId) =>
  executeDiffFiles(db, input, groupId),
);
TOOL_HANDLERS.set("ask_user", (_db, input, groupId) =>
  executeAskUser(input, groupId),
);
TOOL_HANDLERS.set("web_search", (_db, input) => executeWebSearch(input));

// Builtin AI tasks
TOOL_HANDLERS.set("summarize_text", (db, input, groupId, options) =>
  executeSummarizeText(input, groupId, {
    db,
    invokeContext: options?.invokeContext,
  }),
);
TOOL_HANDLERS.set("write_text", (db, input, groupId, options) =>
  executeWriteText(input, groupId, {
    db,
    invokeContext: options?.invokeContext,
  }),
);
TOOL_HANDLERS.set("rewrite_text", (db, input, groupId, options) =>
  executeRewriteText(input, groupId, {
    db,
    invokeContext: options?.invokeContext,
  }),
);
TOOL_HANDLERS.set("proofread_text", (db, input, groupId, options) =>
  executeProofreadText(input, groupId, {
    db,
    invokeContext: options?.invokeContext,
  }),
);
TOOL_HANDLERS.set("detect_language", (db, input, groupId, options) =>
  executeDetectLanguage(input, groupId, {
    db,
    invokeContext: options?.invokeContext,
  }),
);
TOOL_HANDLERS.set("translate_text", (db, input, groupId, options) =>
  executeTranslateText(input, groupId, {
    db,
    invokeContext: options?.invokeContext,
  }),
);
TOOL_HANDLERS.set("embed_text", (db, input, groupId, options) =>
  executeEmbedText(input, groupId, {
    db,
    invokeContext: options?.invokeContext,
  }),
);

/**
 * Execute a tool
 */
export async function executeTool(
  db: ShadowClawDatabase,
  name: string,
  input: Record<string, any>,
  groupId: string,
  options: ExecuteToolOptions = {},
): Promise<ToolResult> {
  try {
    const guardError = runToolGuards(name, options);
    if (guardError) {
      return guardError;
    }

    const handler = TOOL_HANDLERS.get(name);
    if (handler) {
      return await handler(db, input, groupId, options);
    }

    return await executeDeclarativeTool(
      db,
      name,
      input,
      groupId,
      options,
      executeTool,
    );
  } catch (err) {
    return `Tool error (${name}): ${err instanceof Error ? err.message : String(err)}`;
  }
}
