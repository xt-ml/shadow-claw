/**
 * @typedef {Object} ToolDefinition
 *
 * @property {string} name
 * @property {string} description
 * @property {Object} input_schema
 */

/**
 * ShadowClaw — Tool definitions
 */
export const TOOL_DEFINITIONS = [
  {
    name: "bash",
    description:
      "Execute a command in a full Alpine Linux VM (x86). " +
      "Provides a real Linux environment with persistent filesystem. " +
      "Supports all standard Linux commands (ls, cat, grep, uptime, top, apk, etc.), " +
      "pipes (|), redirects (> >>), and shell operators (&& || ;). " +
      "Runs with root privileges inside the VM. " +
      "Uses the group workspace filesystem mounted via 9p. ",
    input_schema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The bash command to execute",
        },
        timeout: {
          type: "number",
          description: "Timeout in seconds (default: 30, max: 240)",
        },
      },
      required: ["command"],
    },
  },
  {
    name: "read_file",
    description:
      "Read the contents of a file from the group workspace. " +
      "Returns the full text content of the file.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File path relative to the group workspace root",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "open_file",
    description:
      "Open a file from the group workspace in the UI file viewer dialog. " +
      "Use this when the user asks to inspect a file visually with preview support.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File path relative to the group workspace root",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description:
      "Write content to a file in the group workspace. " +
      "Creates the file and any intermediate directories if they don't exist. " +
      "Overwrites the file if it already exists.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File path relative to the group workspace root",
        },
        content: {
          type: "string",
          description: "Content to write to the file",
        },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "list_files",
    description:
      "List files and directories in the group workspace. " +
      "Directory names end with /. Returns sorted entries.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "Directory path relative to workspace root (default: root)",
        },
      },
    },
  },
  {
    name: "fetch_url",
    description:
      "Fetch a URL via HTTP and return the response body. " +
      "Subject to browser CORS restrictions — works with most public APIs. " +
      "Response is truncated to 100KB.",
    input_schema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL to fetch",
        },
        method: {
          type: "string",
          description: "HTTP method (default: GET)",
        },
        headers: {
          type: "object",
          description: "Request headers as key-value pairs",
        },
        body: {
          type: "string",
          description: "Request body (for POST/PUT/PATCH)",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "update_memory",
    description:
      "Update the MEMORY.md memory file for this group. " +
      "Use this to persist important context, user preferences, project state, " +
      "and anything the agent should remember across conversations. " +
      "This file is loaded as system context on every invocation.",
    input_schema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "New content for the MEMORY.md memory file",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "create_task",
    description:
      "Create a scheduled recurring task. The task will run automatically " +
      "on the specified schedule and send the result back to this group. " +
      "Uses cron expressions (minute hour day-of-month month day-of-week).",
    input_schema: {
      type: "object",
      properties: {
        schedule: {
          type: "string",
          description: 'Cron expression, e.g. "0 9 * * 1-5" for 9am weekdays',
        },
        prompt: {
          type: "string",
          description: "The prompt/instruction to execute on each run",
        },
      },
      required: ["schedule", "prompt"],
    },
  },
  {
    name: "javascript",
    description:
      "Execute JavaScript code in a sandboxed context and return the result. " +
      "Lighter than bash — no VM boot required. Use for calculations, " +
      "data transformations, JSON processing, etc. " +
      "Has access to standard JS built-ins but no DOM or network.",
    input_schema: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description:
            "JavaScript code to execute. The return value of the last expression is captured.",
        },
      },
      required: ["code"],
    },
  },
  {
    name: "list_tasks",
    description:
      "List all scheduled recurring tasks for this group. " +
      "Returns a list of tasks with their IDs, schedules, and prompts.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "update_task",
    description: "Update an existing scheduled task's schedule or prompt.",
    input_schema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The unique ID of the task to update",
        },
        schedule: {
          type: "string",
          description: "New cron expression (optional)",
        },
        prompt: {
          type: "string",
          description: "New prompt/instruction (optional)",
        },
        enabled: {
          type: "boolean",
          description: "Whether the task is enabled (optional)",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_task",
    description: "Delete a scheduled task by its ID.",
    input_schema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The unique ID of the task to delete",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "enable_task",
    description: "Enable a scheduled task so it runs on its schedule.",
    input_schema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The unique ID of the task to enable",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "disable_task",
    description: "Disable a scheduled task so it stops running.",
    input_schema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The unique ID of the task to disable",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "clear_chat",
    description:
      "Clear the current chat history and start a new session. " +
      "Useful for scheduled tasks to prevent context from growing indefinitely.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },

  // ── Git tools (isomorphic-git) ─────────────────────────────────────
  {
    name: "git_clone",
    description:
      "Clone a git repository into browser-persistent storage (LightningFS). " +
      "The cloned files are automatically synchronized to the OPFS workspace under " +
      "repos/<repo-name> so you can interact with them. " +
      "Works with any public GitHub/GitLab repo. Uses a CORS proxy. " +
      "Returns the short repo name used for subsequent git_* operations.",
    input_schema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description:
            "Full HTTPS repo URL (e.g. https://github.com/user/repo)",
        },
        branch: {
          type: "string",
          description: "Branch to clone (default: default branch)",
        },
        depth: {
          type: "number",
          description: "Shallow clone depth (default: 20)",
        },
        include_git: {
          type: "boolean",
          description:
            "If true, also syncs the internal .git folder to the workspace (default: false)",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "git_checkout",
    description: "Checkout a branch, tag, or commit SHA in a cloned repo.",
    input_schema: {
      type: "object",
      properties: {
        repo: {
          type: "string",
          description: "Short repo name (returned by git_clone)",
        },
        ref: {
          type: "string",
          description: "Branch name, tag, or commit SHA to checkout",
        },
      },
      required: ["repo", "ref"],
    },
  },
  {
    name: "git_status",
    description:
      "Show the working tree status of a cloned repo. " +
      "Reports modified, added, deleted, and unstaged files.",
    input_schema: {
      type: "object",
      properties: {
        repo: {
          type: "string",
          description: "Short repo name",
        },
      },
      required: ["repo"],
    },
  },
  {
    name: "git_log",
    description:
      "Show the commit log for a cloned repo. " +
      "Returns commit SHA, date, author, and message.",
    input_schema: {
      type: "object",
      properties: {
        repo: {
          type: "string",
          description: "Short repo name",
        },
        ref: {
          type: "string",
          description: "Ref to log from (default: HEAD)",
        },
        depth: {
          type: "number",
          description: "Number of commits to show (default: 10)",
        },
      },
      required: ["repo"],
    },
  },
  {
    name: "git_diff",
    description:
      "Show changed files between HEAD and working tree, or between two refs.",
    input_schema: {
      type: "object",
      properties: {
        repo: {
          type: "string",
          description: "Short repo name",
        },
        ref1: {
          type: "string",
          description: "First ref (default: HEAD)",
        },
        ref2: {
          type: "string",
          description: "Second ref (if omitted, diffs HEAD vs workdir)",
        },
      },
      required: ["repo"],
    },
  },
  {
    name: "git_branches",
    description:
      "List branches in a cloned repo. Current branch is marked with *.",
    input_schema: {
      type: "object",
      properties: {
        repo: {
          type: "string",
          description: "Short repo name",
        },
        remote: {
          type: "boolean",
          description: "List remote-tracking branches instead (default: false)",
        },
      },
      required: ["repo"],
    },
  },
  {
    name: "git_list_repos",
    description:
      "List all git repositories currently cloned in browser storage.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "git_add",
    description:
      "Stage files in a cloned repo. Accepts a single filepath or an array of filepaths.",
    input_schema: {
      type: "object",
      properties: {
        repo: {
          type: "string",
          description: "Short repo name",
        },
        filepath: {
          oneOf: [
            { type: "string" },
            { type: "array", items: { type: "string" } },
          ],
          description:
            "File path or array of file paths to stage (relative to repo root)",
        },
      },
      required: ["repo", "filepath"],
    },
  },
  {
    name: "git_commit",
    description:
      "Stage all changes and create a commit in a cloned repo. " +
      "Uses configured git author name/email or defaults.",
    input_schema: {
      type: "object",
      properties: {
        repo: {
          type: "string",
          description: "Short repo name",
        },
        message: {
          type: "string",
          description: "Commit message",
        },
        author_name: {
          type: "string",
          description: "Author name (optional, uses configured default)",
        },
        author_email: {
          type: "string",
          description: "Author email (optional, uses configured default)",
        },
      },
      required: ["repo", "message"],
    },
  },
  {
    name: "git_push",
    description:
      "Push commits to the remote repository. " +
      "Requires a GitHub personal access token (PAT) to be configured. " +
      "The token is loaded from the encrypted credential store.",
    input_schema: {
      type: "object",
      properties: {
        repo: {
          type: "string",
          description: "Short repo name",
        },
        branch: {
          type: "string",
          description: "Branch to push (default: current branch)",
        },
        force: {
          type: "boolean",
          description: "Force push (default: false)",
        },
      },
      required: ["repo"],
    },
  },
  {
    name: "git_pull",
    description:
      "Fetch and merge commits from the remote repository. " +
      "Uses configured git author name/email for merge commits if needed.",
    input_schema: {
      type: "object",
      properties: {
        repo: {
          type: "string",
          description: "Short repo name",
        },
        branch: {
          type: "string",
          description: "Branch to pull (default: current branch)",
        },
        author_name: {
          type: "string",
          description: "Author name (optional, uses configured default)",
        },
        author_email: {
          type: "string",
          description: "Author email (optional, uses configured default)",
        },
      },
      required: ["repo"],
    },
  },
  {
    name: "git_sync",
    description:
      "Manually synchronize files between the OPFS workspace and the private LightningFS git database.",
    input_schema: {
      type: "object",
      properties: {
        repo: {
          type: "string",
          description: "Short repo name",
        },
        direction: {
          type: "string",
          description:
            "Direction to sync: 'push' (workspace to git db) or 'pull' (git db to workspace)",
        },
        include_git: {
          type: "boolean",
          description:
            "If true, includes the hidden .git directory in the sync (default: false)",
        },
      },
      required: ["repo", "direction"],
    },
  },
  {
    name: "show_toast",
    description:
      "Show a toast notification to the user. " +
      "Toasts are non-blocking, auto-dismissing notifications that appear in the bottom-right corner. " +
      "Use for: operation status (success/failure), warnings, informational messages, progress updates. " +
      "Avoid for: critical errors requiring acknowledgment (use clear error messages instead), " +
      "lengthy content (keep messages concise).",
    input_schema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "The message to display in the toast (keep concise)",
        },
        type: {
          type: "string",
          description:
            "Type of toast: 'success', 'error', 'warning', or 'info' (default: 'info')",
          enum: ["success", "error", "warning", "info"],
        },
        duration: {
          type: "number",
          description:
            "Auto-dismiss duration in milliseconds (default: 5000 for info/success, 8000 for warning/error). Set to 0 to disable auto-dismiss.",
        },
      },
      required: ["message"],
    },
  },
];
