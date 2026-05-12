import { ASSISTANT_NAME } from "../config.js";
import { TOOL_DEFINITIONS } from "../tools.js";
import type { ToolDefinition } from "../tools/types.js";

/**
 * Build system prompt
 */
export function buildSystemPrompt(
  assistantName: string,
  memory: string,
  tools?: ToolDefinition[],
  promptOverride?: string,
): string {
  const defs = tools || TOOL_DEFINITIONS;
  const hasTools = defs.length > 0;
  const toolNames = new Set(defs.map((t) => t.name));
  const has = (name: string) => toolNames.has(name);
  const toolList = hasTools
    ? defs
        .map((t) => {
          const brief = t.description.split(". ")[0];

          return `- **${t.name}**: ${brief}.`;
        })
        .join("\n")
    : "- None. No tools are currently enabled.";

  const parts = [
    `You are ${assistantName || ASSISTANT_NAME}, a personal AI assistant running in the client's browser.`,
    "",
    "You have access to the following tools:",
    "",
    toolList,
    "",
    "Guidelines:",
    "- Be concise and direct.",
    ...(hasTools
      ? ["- Use tools proactively when they help answer the question."]
      : [
          "- Do not claim to run tools, read files, fetch URLs, or execute commands while tools are disabled.",
        ]),
    "- Update memory when you learn important preferences or context.",
    "- For scheduled tasks, confirm the schedule with the client.",
    "- The cron expression for a task to be executed once, should be for that exact time.",
    "- Manage tasks. If you create a task, make sure to disable (or delete) it when it's no longer needed.",
    "- Strip <internal> tags from your responses.",
  ];

  if (hasTools) {
    const strategyLines: string[] = [];
    const shellFallbackLines: string[] = [];
    const gitConflictLines: string[] = [];

    if (has("read_file")) {
      strategyLines.push(
        "- Prefer read_file over bash for reading files — it's faster and always works.",
        "- Use read_file with paths (array) to batch-read multiple files in one call — minimizes API round-trips.",
      );
    }

    if (has("write_file")) {
      strategyLines.push("- Prefer write_file over bash for writing files.");
    }

    if (has("patch_file")) {
      strategyLines.push(
        "- Use patch_file for targeted edits in existing files — it finds and replaces a single unique text match, works reliably with large files, and avoids the pitfalls of sed or heredocs. Include 2-3 lines of surrounding context to ensure a unique match.",
      );
    }

    if (has("attach_file_to_chat")) {
      strategyLines.push(
        "- When sharing workspace images or files in chat, prefer attach_file_to_chat first. It validates the path and returns exact markdown references to the file path (for example: ![alt](path/to/image.png) or [report.pdf](path/to/report.pdf)) so ShadowClaw can inline and external channels can attach reliably.",
      );
    }

    if (has("open_file")) {
      strategyLines.push(
        "- Do not use open_file to attach or send files in chat. Use open_file only when the user explicitly asks to open/view a file in the ShadowClaw file viewer.",
      );
    }

    if (has("javascript")) {
      strategyLines.push(
        "- Prefer javascript usage for data analysis, string processing, and computations over bash.",
      );

      shellFallbackLines.push(
        "- The javascript tool MUST use 'return <value>' to produce output — bare expressions yield nothing.",
      );
    }

    if (has("bash")) {
      strategyLines.push(
        "- Shell commands may fail if WebVM is unavailable. When a bash command fails with 'command not found', do NOT retry — use read_file, write_file, or javascript instead.",
        "- Analyze code by reading files and reasoning, not by running syntax checkers in bash.",
      );

      shellFallbackLines.push(
        "- grep -r works: use 'grep -rn PATTERN dir' to recursively search files. Supports --include=GLOB and --exclude=GLOB.",
        "- sed -i works: use 'sed -i \"s/old/new/g\" file' for in-place file edits. For multi-line or complex edits, prefer patch_file instead.",
        "- find works: supports -name, -iname, -type, -maxdepth. Does NOT support -exec (use find | xargs or javascript).",
      );

      if (has("list_files") || has("read_file")) {
        shellFallbackLines.push(
          "- Prefer list_files over 'ls' and read_file over 'cat' — dedicated tools are faster and more reliable than shell fallback.",
        );
      }
    }

    if (has("fetch_url")) {
      strategyLines.push(
        "- When using fetch_url with Git hosting services (github.com, gitlab.com, dev.azure.com, git.* hosts, etc.), always set use_git_auth: true to inject saved credentials. Without it, many Git servers return a login page instead of API data.",
        "- When using fetch_url with non-Git services that have a saved account (e.g. Figma, Notion, or any service configured under Settings → Accounts), set use_account_auth: true to inject the matching PAT in the service's expected format (e.g. Bearer token, X-Figma-Token, etc.). The account is matched by host pattern automatically. Do NOT also pass manual auth headers when using use_account_auth — they are mutually exclusive.",
      );
    }

    if (has("manage_email") && has("email_read_messages")) {
      strategyLines.push(
        "- Use manage_email for email setup and inspection only (status, list_connections, connect, configure, enable, disable, delete, test).",
        "- Use email_read_messages to retrieve email from a configured IMAP connection, and email_send_message to send email.",
        "- Use manage_email action=download_attachments (with message_uid) to save inbound email attachments to the workspace.",
        "- For outbound file attachments, use manage_email action=send_message with attachments as workspace paths.",
        "- If the user asks for recent emails, first identify or configure the IMAP connection with manage_email, then call email_read_messages with the connection_id.",
      );
    }

    if (has("manage_email") && !has("email_read_messages")) {
      strategyLines.push(
        "- If email_read_messages is not available, use manage_email with action=read_messages to retrieve recent IMAP email, action=send_message (supports attachments), action=download_attachments for inbound files, and action=mark_as_read/mark_as_unread/delete_messages (with message_uids) to manage inbox state.",
      );
    }

    if (has("read_file") || has("write_file") || has("patch_file")) {
      strategyLines.push(
        "- Minimize API calls: gather context with a few read_file calls, think carefully, then act.",
      );
    }

    if (has("git_merge")) {
      gitConflictLines.push(
        "- After git_merge reports conflicts, use read_file to see each conflicted file (with <<<<<<< / ======= / >>>>>>> markers).",
        "- Use write_file to overwrite each file with the fully resolved content — no conflict markers.",
        "- Do NOT use bash, sed, or awk for conflict resolution. Use read_file + write_file exclusively.",
      );

      if (has("git_add") && has("git_commit")) {
        gitConflictLines.push(
          "- After resolving all files, git_add each file then git_commit.",
        );
      }
    }

    if (strategyLines.length > 0) {
      parts.push("", "Tool usage strategy:", ...strategyLines);
    }

    if (shellFallbackLines.length > 0) {
      parts.push(
        "",
        "Shell fallback tips (when WebVM is unavailable):",
        ...shellFallbackLines,
      );
    }

    if (gitConflictLines.length > 0) {
      parts.push("", "Git merge conflict resolution:", ...gitConflictLines);
    }
  }

  if (memory) {
    parts.push("", "## Persistent Memory", "", memory);
  }

  if (promptOverride) {
    parts.push("", promptOverride);
  }

  return parts.join("\n");
}
