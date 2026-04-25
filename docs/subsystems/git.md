# Git Integration

> In-browser Git operations using isomorphic-git with LightningFS as the filesystem,
> synchronized to the OPFS workspace.

**Source:** `src/git/git.ts` · `src/git/sync.ts` · `src/git/credentials.ts`

## Architecture

```mermaid
graph TD
  Tools["Agent git_* tools"] --> Git["src/git/git.ts"]
  Git --> IG["isomorphic-git"]
  IG --> LFS["LightningFS<br>In-memory / in-browser FS"]
  Git --> Sync["src/git/sync.ts<br>LightningFS ↔ OPFS sync"]
  Sync --> OPFS["OPFS Workspace<br>shadowclaw/<groupId>/workspace/repos/"]
  Sync --> LFS
  Git --> Creds["src/git/credentials.ts<br>Token management"]
  Creds --> DB["IndexedDB<br>Encrypted Git token"]
  Git --> HTTP["isomorphic-git/http/web<br>CORS-aware HTTP client"]
  HTTP --> Proxy["Express proxy<br>/proxy/git/*<br>(for restricted CORS hosts)"]
```

## Supported Git Operations

| Tool              | Operation                      |
| ----------------- | ------------------------------ |
| `git_clone`       | Clone a remote repository      |
| `git_sync`        | Pull + push (sync with remote) |
| `git_checkout`    | Switch branch                  |
| `git_branch`      | Create a new branch            |
| `git_branches`    | List all branches              |
| `git_status`      | Working tree status            |
| `git_add`         | Stage files                    |
| `git_log`         | Commit history                 |
| `git_diff`        | Show changes                   |
| `git_commit`      | Create a commit                |
| `git_pull`        | Fetch + merge from remote      |
| `git_push`        | Push to remote                 |
| `git_merge`       | Merge branch                   |
| `git_reset`       | Reset HEAD / unstage           |
| `git_list_repos`  | List cloned repos              |
| `git_delete_repo` | Remove a repo from workspace   |

## LightningFS ↔ OPFS Sync

isomorphic-git requires a synchronous filesystem interface, which OPFS can't provide on the main thread. ShadowClaw solves this by:

1. **Clone operation:** isomorphic-git writes to LightningFS (in-memory)
2. **OPFS sync:** `syncLightningFsToOpfs()` mirrors the LightningFS tree to OPFS
3. **Future reads:** Files are read from OPFS directly; LightningFS is re-seeded from OPFS before git operations

The sync is directional — LightningFS → OPFS — to ensure changes are durable (OPFS survives page reload, LightningFS doesn't).

## Workspace Layout

Repos live in the group workspace at `repos/<repo-name>/`:

```text
shadowclaw/<groupId>/workspace/
└── repos/
    ├── my-project/
    │   ├── .git/
    │   ├── src/
    │   └── README.md
    └── another-repo/
        ├── .git/
        └── ...
```

`git_list_repos` lists all immediate subdirectories of `repos/` that contain a `.git` directory.

## Merge Workflow

> **Important:** Git merges in the browser require special handling.

The agent is instructed to **never** use `bash`, `sed`, or `grep` to resolve merge conflicts. The correct workflow is:

1. `read_file` on the conflicted file(s)
2. Resolve conflicts in memory
3. `write_file` the resolved content
4. `git_add` the resolved file
5. `git_commit` the merge

This is reflected in the system prompt (`src/orchestrator.ts` → `buildSystemPrompt`).

## Credentials

**File:** `src/git/credentials.ts`

Git credentials are managed via the encrypted `CONFIG_KEYS.GIT_TOKEN` config key.

- `getGitCredentials(db)` — returns `{ username, password }` decoded from stored token
- Token format: `base64(username:token)` or plain token (treated as password with `"token"` username)
- Used by `http.onAuth` callback for all authenticated operations

### Auth injection for `fetch_url`

The `fetch_url` tool supports `use_git_auth: true` to inject Git credentials as an `Authorization: Basic <token>` header. This is the preferred way for the agent to access private Git host APIs (e.g., listing repos via API).

### Login page detection

`fetch_url` detects common Git host login pages (GitHub, GitLab, Bitbucket) and returns a descriptive error instead of the HTML login page content.

## HTTP Client

isomorphic-git uses the standard `isomorphic-git/http/web` HTTP client. Direct calls to GitHub/GitLab CORS-bypass via the Express proxy at `/proxy/git/*`.

The proxy is only needed when:

- The Git host doesn't support CORS for API endpoints
- Basic Auth is needed (some browsers strip `Authorization` on cross-origin requests)

## Lazy Loading

All git operations lazy-import `src/git/git.ts`:

```ts
const { gitTool } = await import("../../git/git.js");
```

This ensures the isomorphic-git bundle (fairly large) is only loaded when a git tool is actually invoked, not on worker startup.
