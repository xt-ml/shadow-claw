import type { ToolDefinition } from "./types.js";

export const git_clone: ToolDefinition = {
  name: "git_clone",
  description:
    "Clone a git repository into browser-persistent storage (LightningFS). " +
    "The cloned files are automatically synchronized to the OPFS workspace under " +
    "repos/<repo-name> so you can interact with them. " +
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
    "Delete a cloned git repository from browser storage (LightningFS). " +
    "Use this to clean up corrupted or stale repos that fail to re-clone. " +
    "Does NOT remove workspace files under repos/ — only the internal git database.",
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
    "Stage files in a cloned repo. Accepts a single filepath or an array of filepaths.",
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
          "File path or array of file paths to stage (relative to repo root)",
      },
    },
    required: ["repo", "filepath"],
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

export const git_sync: ToolDefinition = {
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
};
