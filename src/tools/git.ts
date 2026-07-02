import type { ToolDefinition } from "./types.js";

export const git_clone: ToolDefinition = {
  name: "git_clone",
  description:
    "Clone a git repository into browser-persistent OPFS storage. " +
    "Files are stored directly under repos/<repo-name>/ in the workspace and are " +
    "immediately accessible to other git_* tools without any extra sync step. " +
    "Works with public and private repos (GitHub, GitLab, GitHub Enterprise, etc.). " +
    "If a Git PAT is configured in Settings, it is used automatically for authentication. " +
    "Uses a CORS proxy. Returns the short repo name used for subsequent git_* operations.",
  input_schema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "Full HTTPS repo URL (e.g. https://github.com/user/repo)",
      },
      name: {
        type: "string",
        description:
          "Optional short repo name to use for the clone directory; defaults to the repository name parsed from the URL.",
      },
      branch: {
        type: "string",
        description: "Branch to clone (default: default branch)",
      },
      depth: {
        type: "number",
        description: "Shallow clone depth (default: 20)",
      },
    },
    required: ["url"],
  },
};

export const git_checkout: ToolDefinition = {
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
};

export const git_branch: ToolDefinition = {
  name: "git_branch",
  description:
    "Create a new branch in a cloned repo. " +
    "Optionally switch to it immediately (like git checkout -b).",
  input_schema: {
    type: "object",
    properties: {
      repo: {
        type: "string",
        description: "Short repo name (returned by git_clone)",
      },
      name: {
        type: "string",
        description: "Name for the new branch",
      },
      checkout: {
        type: "boolean",
        description:
          "Switch to the new branch after creating it (default: false)",
      },
      start_point: {
        type: "string",
        description:
          "Branch, tag, or commit SHA to branch from (default: HEAD)",
      },
    },
    required: ["repo", "name"],
  },
};

export const git_status: ToolDefinition = {
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
};

export const git_log: ToolDefinition = {
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
};

export const git_diff: ToolDefinition = {
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
};

export const git_branches: ToolDefinition = {
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
};

export const git_list_repos: ToolDefinition = {
  name: "git_list_repos",
  description: "List all git repositories currently cloned in browser storage.",
  input_schema: {
    type: "object",
    properties: {},
  },
};

export const git_delete_repo: ToolDefinition = {
  name: "git_delete_repo",
  description:
    "Delete the git metadata for a cloned repository while leaving the working tree files in place. " +
    "Use this to clean up corrupted or stale repos that fail to re-clone. " +
    "The repo directory remains under repos/<repo>, but the `.git/` metadata is removed.",
  input_schema: {
    type: "object",
    properties: {
      repo: {
        type: "string",
        description:
          "Short repo name (as returned by git_clone or git_list_repos)",
      },
    },
    required: ["repo"],
  },
};

export const git_add: ToolDefinition = {
  name: "git_add",
  description:
    "Stage files in a cloned repo. Accepts an array of filepaths. If omitted or empty, stages the repo root.",
  input_schema: {
    type: "object",
    properties: {
      repo: {
        type: "string",
        description: "Short repo name",
      },
      filepaths: {
        type: "array",
        items: { type: "string" },
        description:
          "Array of file paths to stage (relative to repo root). Pass a single item for one file.",
      },
    },
    required: ["repo"],
  },
};

export const git_commit: ToolDefinition = {
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
};

export const git_push: ToolDefinition = {
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
        description: "Local branch to push (default: current branch)",
      },
      remote_ref: {
        type: "string",
        description:
          "Remote branch name to push to, if different from local branch. " +
          "Example: push local 'feature-rebased' to remote 'feature/original'.",
      },
      force: {
        type: "boolean",
        description: "Force push (default: false)",
      },
      tags: {
        type: "boolean",
        description: "Also push all local tags to the remote (default: false)",
      },
    },
    required: ["repo"],
  },
};

export const git_pull: ToolDefinition = {
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
};

export const git_merge: ToolDefinition = {
  name: "git_merge",
  description:
    "Merge a branch or ref into the current branch. " +
    "Supports fast-forward and three-way merges. " +
    "If the merge has conflicts, a detailed report is returned with the conflicted files and their conflict regions inline. " +
    "To resolve: use read_file on each conflicted file, then write_file with the complete resolved content (no conflict markers). " +
    "After all files are resolved, use git_add for each, then git_commit. Do NOT use bash/sed for conflict resolution.",
  input_schema: {
    type: "object",
    properties: {
      repo: {
        type: "string",
        description: "Short repo name",
      },
      theirs: {
        type: "string",
        description:
          "Branch name, tag, or commit SHA to merge into the current branch",
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
    required: ["repo", "theirs"],
  },
};

export const git_reset: ToolDefinition = {
  name: "git_reset",
  description:
    "Reset the current branch HEAD to a specific ref or commit SHA. " +
    "Updates the branch pointer and checks out the target, discarding local changes. " +
    "Equivalent to 'git reset --hard <ref>'.",
  input_schema: {
    type: "object",
    properties: {
      repo: {
        type: "string",
        description: "Short repo name",
      },
      ref: {
        type: "string",
        description: "Branch name, tag, or commit SHA to reset to",
      },
    },
    required: ["repo", "ref"],
  },
};

export const git_fetch: ToolDefinition = {
  name: "git_fetch",
  description:
    "Fetch commits from the remote without merging. " +
    "Safe for inspecting remote state before deciding to merge or rebase.",
  input_schema: {
    type: "object",
    properties: {
      repo: {
        type: "string",
        description: "Short repo name",
      },
      branch: {
        type: "string",
        description: "Remote branch to fetch (default: default branch)",
      },
      remote: {
        type: "string",
        description: "Remote name (default: origin)",
      },
    },
    required: ["repo"],
  },
};

export const git_read_file_at_ref: ToolDefinition = {
  name: "git_read_file_at_ref",
  description:
    "Read a file's contents at a specific ref (branch, tag, or commit SHA) " +
    "without checking it out. Useful for code review across branches.",
  input_schema: {
    type: "object",
    properties: {
      repo: {
        type: "string",
        description: "Short repo name",
      },
      ref: {
        type: "string",
        description: "Branch name, tag, or commit SHA",
      },
      filepath: {
        type: "string",
        description: "File path relative to the repo root",
      },
    },
    required: ["repo", "ref", "filepath"],
  },
};

export const git_show: ToolDefinition = {
  name: "git_show",
  description:
    "Show the metadata and diff of a specific commit. " +
    "Returns author, date, message, and a unified diff against the parent commit.",
  input_schema: {
    type: "object",
    properties: {
      repo: {
        type: "string",
        description: "Short repo name",
      },
      ref: {
        type: "string",
        description: "Commit SHA, branch, or tag to inspect (default: HEAD)",
      },
    },
    required: ["repo", "ref"],
  },
};

export const git_delete_branch: ToolDefinition = {
  name: "git_delete_branch",
  description: "Delete a local branch from a cloned repo.",
  input_schema: {
    type: "object",
    properties: {
      repo: {
        type: "string",
        description: "Short repo name",
      },
      name: {
        type: "string",
        description: "Name of the branch to delete",
      },
    },
    required: ["repo", "name"],
  },
};

export const git_init: ToolDefinition = {
  name: "git_init",
  description:
    "Initialize a new empty git repository in browser storage. " +
    "Use this to create a new project from scratch before using git_push to push to a remote.",
  input_schema: {
    type: "object",
    properties: {
      repo: {
        type: "string",
        description:
          "Short name for the new repo (used for all subsequent git_ operations)",
      },
    },
    required: ["repo"],
  },
};

export const git_tag: ToolDefinition = {
  name: "git_tag",
  description:
    "Create a lightweight or annotated tag at HEAD. " +
    "Use git_push with tags=true to push tags to the remote.",
  input_schema: {
    type: "object",
    properties: {
      repo: {
        type: "string",
        description: "Short repo name",
      },
      tag: {
        type: "string",
        description: "Tag name (e.g. v1.2.3)",
      },
      message: {
        type: "string",
        description:
          "Annotation message — if provided, creates an annotated tag; otherwise lightweight",
      },
      author_name: {
        type: "string",
        description: "Tagger name (optional, uses configured default)",
      },
      author_email: {
        type: "string",
        description: "Tagger email (optional, uses configured default)",
      },
    },
    required: ["repo", "tag"],
  },
};

export const git_remote: ToolDefinition = {
  name: "git_remote",
  description:
    "Manage git remotes: list, add, or remove a remote in a cloned repo.",
  input_schema: {
    type: "object",
    properties: {
      repo: {
        type: "string",
        description: "Short repo name",
      },
      command: {
        type: "string",
        enum: ["list", "add", "remove"],
        description: "Operation to perform",
      },
      remote: {
        type: "string",
        description:
          "Remote name (e.g. origin, upstream) — required for add/remove",
      },
      url: {
        type: "string",
        description: "Remote URL — required for add",
      },
    },
    required: ["repo", "command"],
  },
};

export const git_config: ToolDefinition = {
  name: "git_config",
  description:
    "Get or set a git config value for a repo (e.g. user.name, user.email). " +
    "Persistent per-repo identity avoids specifying author on every commit.",
  input_schema: {
    type: "object",
    properties: {
      repo: {
        type: "string",
        description: "Short repo name",
      },
      command: {
        type: "string",
        enum: ["get", "set"],
        description: "Operation: get or set a config value",
      },
      key: {
        type: "string",
        description:
          "Config key path (e.g. user.name, user.email, core.autocrlf)",
      },
      value: {
        type: "string",
        description: "Value to set — required when command is set",
      },
    },
    required: ["repo", "command", "key"],
  },
};

export const git_unstage: ToolDefinition = {
  name: "git_unstage",
  description:
    "Remove one or more staged files from the index without touching the working tree. " +
    "The inverse of git_add — use to undo accidental staging.",
  input_schema: {
    type: "object",
    properties: {
      repo: {
        type: "string",
        description: "Short repo name",
      },
      filepath: {
        anyOf: [
          { type: "string" },
          { type: "array", items: { type: "string" } },
        ],
        description:
          "File path or array of file paths to unstage (relative to repo root)",
      },
    },
    required: ["repo", "filepath"],
  },
};
