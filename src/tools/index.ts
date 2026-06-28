/**
 * ShadowClaw — Tool definitions
 *
 * Each tool is defined in its own module and assembled here.
 */

import type { ToolDefinition } from "./types.js";

import { bash } from "./bash.js";
import { clear_chat } from "./chat.js";
import {
  manage_email,
  email_read_messages,
  email_send_message,
} from "./email.js";
import { fetch_file, fetch_url } from "./fetch.js";
import { javascript } from "./javascript.js";
import { remote_mcp_call_tool, remote_mcp_list_tools } from "./mcp.js";
import { list_tool_profiles, manage_tools } from "./manage_tools.js";
import { update_memory } from "./memory.js";
import { send_notification, show_toast } from "./notifications.js";
import { list_components, render_component } from "./a2ui.js";
import { spawn_subagent } from "./subagent.js";

import {
  attach_file_to_chat,
  list_files,
  open_file,
  patch_file,
  read_file,
  send_file,
  write_file,
} from "./files.js";

import {
  git_add,
  git_branch,
  git_branches,
  git_checkout,
  git_clone,
  git_commit,
  git_delete_repo,
  git_diff,
  git_list_repos,
  git_log,
  git_merge,
  git_pull,
  git_push,
  git_reset,
  git_status,
  git_sync,
} from "./git.js";

import {
  create_task,
  delete_task,
  disable_task,
  enable_task,
  list_tasks,
  run_task,
  update_task,
} from "./tasks.js";

import {
  create_room,
  invite_to_room,
  leave_room,
  list_room_members,
} from "./rooms.js";

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  attach_file_to_chat,
  bash,
  clear_chat,
  create_task,
  delete_task,
  disable_task,
  enable_task,
  email_read_messages,
  email_send_message,
  fetch_file,
  fetch_url,
  git_add,
  git_branch,
  git_branches,
  git_checkout,
  git_clone,
  git_commit,
  git_delete_repo,
  git_diff,
  git_list_repos,
  git_log,
  git_merge,
  git_pull,
  git_push,
  git_reset,
  git_status,
  git_sync,
  javascript,
  list_components,
  list_files,
  manage_email,
  list_tasks,
  list_room_members,
  list_tool_profiles,
  manage_tools,
  open_file,
  patch_file,
  read_file,
  remote_mcp_call_tool,
  remote_mcp_list_tools,
  render_component,
  run_task,
  create_room,
  invite_to_room,
  leave_room,
  send_notification,
  send_file,
  show_toast,
  spawn_subagent,
  update_memory,
  update_task,
  write_file,
];
