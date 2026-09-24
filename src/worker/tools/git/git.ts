import { extractConflictPaths } from "./utils/extractConflictPaths.js";
import { indent } from "./utils/indent.js";
import { parseConflictRegions } from "./utils/parseConflictRegions.js";
import { resolveCorsProxy } from "./utils/resolveCorsProxy.js";
import { truncateSnippet } from "./utils/truncateSnippet.js";

import type { ShadowClawDatabase } from "../../../db/types.js";
import type { GitToolDeps } from "../../../subsystems/git/types.js";

export interface ConflictRegion {
  ours: string;
  oursLabel: string;
  startLine: number;
  theirs: string;
  theirsLabel: string;
}

export interface GitToolContext {
  db: ShadowClawDatabase;
  groupId: string;
  groupRoot: any;
  deps: GitToolDeps;
}

export type GitToolHandler = (
  input: Record<string, any>,
  ctx: GitToolContext,
) => Promise<string> | string;

export const GIT_TOOL_HANDLERS = new Map<string, GitToolHandler>();

// ── Basic Staging & Repositories ────────────────────────────────────────────

GIT_TOOL_HANDLERS.set("git_add", (input, { groupRoot, deps }) => {
  return deps.gitAdd({
    filepath: input.filepaths ?? input.filepath,
    groupRoot,
    repo: input.repo,
  });
});

GIT_TOOL_HANDLERS.set("git_unstage", (input, { groupRoot, deps }) => {
  return deps.gitUnstage({
    filepath: input.filepath,
    groupRoot,
    repo: input.repo,
  });
});

GIT_TOOL_HANDLERS.set("git_status", (input, { groupRoot, deps }) => {
  return deps.gitStatus({ repo: input.repo, groupRoot });
});

GIT_TOOL_HANDLERS.set("git_diff", (input, { groupRoot, deps }) => {
  return deps.gitDiff({
    groupRoot,
    ref1: input.ref1,
    ref2: input.ref2,
    repo: input.repo,
  });
});

GIT_TOOL_HANDLERS.set("git_show", (input, { groupRoot, deps }) => {
  return deps.gitShow({
    groupRoot,
    ref: input.ref || "HEAD",
    repo: input.repo,
  });
});

GIT_TOOL_HANDLERS.set("git_log", (input, { groupRoot, deps }) => {
  return deps.gitLog({
    depth: input.depth,
    groupRoot,
    ref: input.ref,
    repo: input.repo,
  });
});

GIT_TOOL_HANDLERS.set("git_read_file_at_ref", (input, { groupRoot, deps }) => {
  return deps.gitReadFileAtRef({
    filepath: input.filepath,
    groupRoot,
    ref: input.ref,
    repo: input.repo,
  });
});

GIT_TOOL_HANDLERS.set("git_init", async (input, { groupRoot, deps }) => {
  return await deps.gitInit({ repo: input.repo, groupRoot });
});

GIT_TOOL_HANDLERS.set("git_list_repos", (_input, { groupRoot, deps }) => {
  return deps.gitListRepos({ groupRoot });
});

GIT_TOOL_HANDLERS.set("git_delete_repo", (input, { groupRoot, deps }) => {
  return deps.gitDeleteRepo({ repo: input.repo, groupRoot });
});

GIT_TOOL_HANDLERS.set("git_config", (input, { groupRoot, deps }) => {
  return deps.gitConfig({
    command: input.command,
    groupRoot,
    key: input.key,
    repo: input.repo,
    value: input.value,
  });
});

// ── Branches & Checkouts ────────────────────────────────────────────────────

GIT_TOOL_HANDLERS.set("git_branch", async (input, { groupRoot, deps }) => {
  return await deps.gitBranch({
    checkout: input.checkout,
    groupRoot,
    name: input.name,
    repo: input.repo,
    startPoint: input.start_point,
  });
});

GIT_TOOL_HANDLERS.set("git_branches", (input, { groupRoot, deps }) => {
  return deps.gitListBranches({
    groupRoot,
    remote: input.remote,
    repo: input.repo,
  });
});

GIT_TOOL_HANDLERS.set("git_checkout", async (input, { groupRoot, deps }) => {
  return await deps.gitCheckout({
    groupRoot,
    ref: input.ref,
    repo: input.repo,
  });
});

GIT_TOOL_HANDLERS.set("git_delete_branch", (input, { groupRoot, deps }) => {
  return deps.gitDeleteBranch({
    groupRoot,
    name: input.name,
    repo: input.repo,
  });
});

GIT_TOOL_HANDLERS.set("git_reset", async (input, { groupRoot, deps }) => {
  return await deps.gitReset({
    groupRoot,
    ref: input.ref,
    repo: input.repo,
  });
});

// ── Commit & Tags ───────────────────────────────────────────────────────────

GIT_TOOL_HANDLERS.set("git_commit", async (input, { db, groupRoot, deps }) => {
  const commitRemoteUrl = await deps.getRemoteUrl({
    groupRoot,
    repo: input.repo,
  });
  const commitCreds = await deps.resolveGitCredentials(db, commitRemoteUrl);

  let authorName = input.author_name;
  let authorEmail = input.author_email;

  if (!authorName) {
    authorName =
      commitCreds.authorName ||
      (await deps.getConfig(db, deps.configKeys.GIT_AUTHOR_NAME)) ||
      undefined;
  }

  if (!authorEmail) {
    authorEmail =
      commitCreds.authorEmail ||
      (await deps.getConfig(db, deps.configKeys.GIT_AUTHOR_EMAIL)) ||
      undefined;
  }

  return deps.gitCommit({
    authorEmail,
    authorName,
    groupRoot,
    message: input.message,
    repo: input.repo,
  });
});

GIT_TOOL_HANDLERS.set("git_tag", async (input, { db, groupRoot, deps }) => {
  const tagRemoteUrl = await deps.getRemoteUrl({
    groupRoot,
    repo: input.repo,
  });

  const tagCreds = await deps.resolveGitCredentials(db, tagRemoteUrl);

  let authorName = input.author_name;
  let authorEmail = input.author_email;

  if (!authorName) {
    authorName =
      tagCreds.authorName ||
      (await deps.getConfig(db, deps.configKeys.GIT_AUTHOR_NAME)) ||
      undefined;
  }

  if (!authorEmail) {
    authorEmail =
      tagCreds.authorEmail ||
      (await deps.getConfig(db, deps.configKeys.GIT_AUTHOR_EMAIL)) ||
      undefined;
  }

  return deps.gitTag({
    authorEmail,
    authorName,
    groupRoot,
    message: input.message,
    repo: input.repo,
    tag: input.tag,
  });
});

// ── Remotes, Fetch, Pull, Push, Clone, Merge ────────────────────────────────

GIT_TOOL_HANDLERS.set("git_clone", async (input, { db, groupRoot, deps }) => {
  const creds = await deps.resolveGitCredentials(db, input.url);
  const corsProxy = await resolveCorsProxy(db, deps);

  const repo = await deps.gitClone({
    branch: input.branch,
    corsProxy,
    depth: input.depth,
    groupRoot,
    name: input.name,
    password: creds.password,
    token: creds.token,
    url: input.url,
    username: creds.username,
  });

  return `Cloned ${input.url} as "${repo}". Files are at "repos/${repo}/" in the workspace. Use repo="${repo}" for other git_* tools.`;
});

GIT_TOOL_HANDLERS.set("git_fetch", async (input, { db, groupRoot, deps }) => {
  const fetchRemoteUrl = await deps.getRemoteUrl({
    groupRoot,
    repo: input.repo,
  });

  const creds = await deps.resolveGitCredentials(db, fetchRemoteUrl);
  const corsProxy = await resolveCorsProxy(db, deps);

  return deps.gitFetch({
    branch: input.branch,
    corsProxy,
    groupRoot,
    password: creds.password,
    remote: input.remote,
    repo: input.repo,
    token: creds.token,
    username: creds.username,
  });
});

GIT_TOOL_HANDLERS.set("git_remote", (input, { groupRoot, deps }) => {
  return deps.gitRemote({
    command: input.command,
    groupRoot,
    remote: input.remote,
    repo: input.repo,
    url: input.url,
  });
});

GIT_TOOL_HANDLERS.set("git_pull", async (input, { db, groupRoot, deps }) => {
  const remoteUrl = await deps.getRemoteUrl({
    groupRoot,
    repo: input.repo,
  });

  const creds = await deps.resolveGitCredentials(db, remoteUrl);
  const corsProxy = await resolveCorsProxy(db, deps);

  let authorName = input.author_name;
  let authorEmail = input.author_email;

  if (!authorName) {
    authorName =
      creds.authorName ||
      (await deps.getConfig(db, deps.configKeys.GIT_AUTHOR_NAME)) ||
      undefined;
  }

  if (!authorEmail) {
    authorEmail =
      creds.authorEmail ||
      (await deps.getConfig(db, deps.configKeys.GIT_AUTHOR_EMAIL)) ||
      undefined;
  }

  return deps.gitPull({
    authorEmail,
    authorName,
    branch: input.branch,
    corsProxy,
    groupRoot,
    password: creds.password,
    repo: input.repo,
    token: creds.token,
    username: creds.username,
  });
});

GIT_TOOL_HANDLERS.set("git_push", async (input, { db, groupRoot, deps }) => {
  const pushRemoteUrl = await deps.getRemoteUrl({
    groupRoot,
    repo: input.repo,
  });

  const creds = await deps.resolveGitCredentials(db, pushRemoteUrl);

  if (!creds.token && !creds.username) {
    return "Error: No git credentials configured. Add a Git account with a Personal Access Token or username/password in Settings → Git.";
  }

  const corsProxy = await resolveCorsProxy(db, deps);

  return deps.gitPush({
    branch: input.branch,
    corsProxy,
    force: input.force,
    groupRoot,
    password: creds.password,
    remoteRef: input.remote_ref,
    repo: input.repo,
    tags: input.tags,
    token: creds.token,
    username: creds.username,
  });
});

GIT_TOOL_HANDLERS.set(
  "git_merge",
  async (input, { db, groupId, groupRoot, deps }) => {
    let authorName = input.author_name;
    let authorEmail = input.author_email;

    if (!authorName) {
      const stored = await deps.getConfig(db, deps.configKeys.GIT_AUTHOR_NAME);

      if (stored) {
        authorName = stored;
      }
    }

    if (!authorEmail) {
      const stored = await deps.getConfig(db, deps.configKeys.GIT_AUTHOR_EMAIL);

      if (stored) {
        authorEmail = stored;
      }
    }

    let mergeResult: string;
    try {
      mergeResult = await deps.gitMerge({
        authorEmail,
        authorName,
        groupRoot,
        repo: input.repo,
        theirs: input.theirs,
      });
    } catch (mergeErr: any) {
      const conflictPaths =
        mergeErr?.data?.filepaths ||
        extractConflictPaths(mergeErr?.message ?? String(mergeErr));

      const sections: string[] = [];
      for (const fp of conflictPaths) {
        const wsPath = `repos/${input.repo}/${fp}`;
        try {
          const content = await deps.readGroupFile(db, groupId, wsPath);
          const regions = parseConflictRegions(content);
          if (regions.length > 0) {
            const regionDescs = regions.map((region, idx) => {
              const oursSnip = truncateSnippet(region.ours, 30);
              const theirsSnip = truncateSnippet(region.theirs, 30);

              return (
                `  Conflict ${idx + 1} (line ~${region.startLine}):\n` +
                `    <<<<<<< ${region.oursLabel}\n${indent(oursSnip, "    ")}\n` +
                `    =======\n${indent(theirsSnip, "    ")}\n` +
                `    >>>>>>> ${region.theirsLabel}`
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
        "Conflicted files have been synced to the workspace with conflict markers.\n";

      const instructions =
        "\nResolution steps:\n" +
        "1. Use read_file on each conflicted file to see the full content with <<<<<<< / ======= / >>>>>>> markers.\n" +
        "2. Decide the correct resolution (keep ours, keep theirs, or combine).\n" +
        "3. Use write_file to write the COMPLETE resolved file without any conflict markers.\n" +
        "4. After ALL files are resolved, use git_add for each file, then git_commit.\n" +
        "Important: Use write_file (not bash/sed) to write resolved files. Ensure NO conflict markers remain.";

      return `${header}\n${sections.join("\n\n")}\n${instructions}`;
    }

    return mergeResult;
  },
);

// ── Dispatcher Entry Point ──────────────────────────────────────────────────

export async function executeGitTool(
  db: ShadowClawDatabase,
  name: string,
  input: Record<string, any>,
  groupId: string,
  deps: GitToolDeps,
): Promise<string> {
  const groupRoot = await deps.getGroupDir(db, groupId);
  const handler = GIT_TOOL_HANDLERS.get(name);
  if (!handler) {
    return `Unknown tool: ${name}`;
  }

  return await handler(input, { db, groupId, groupRoot, deps });
}
