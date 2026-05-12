import type { ShadowClawDatabase } from "../../types.js";

interface GitToolDeps {
  getConfig: (db: ShadowClawDatabase, key: string) => Promise<any>;
  getProxyUrl: (
    pref: "local" | "public" | "custom",
    customUrl?: string,
  ) => string;
  resolveGitCredentials: (
    db: ShadowClawDatabase,
    url: any,
  ) => Promise<{
    token?: string;
    username?: string;
    password?: string;
    authorName?: string;
    authorEmail?: string;
  }>;
  gitClone: (input: any) => Promise<string>;
  gitCheckout: (input: any) => Promise<string>;
  gitBranch: (input: any) => Promise<string>;
  gitStatus: (input: any) => Promise<string>;
  gitAdd: (input: any) => Promise<string>;
  gitLog: (input: any) => Promise<string>;
  gitDiff: (input: any) => Promise<string>;
  gitListBranches: (input: any) => Promise<string>;
  gitListRepos: () => Promise<string>;
  gitDeleteRepo: (input: any) => Promise<string>;
  gitCommit: (input: any) => Promise<string>;
  gitPull: (input: any) => Promise<string>;
  gitPush: (input: any) => Promise<string>;
  gitMerge: (input: any) => Promise<string>;
  gitReset: (input: any) => Promise<string>;
  getRemoteUrl: (input: { repo: string; remote?: string }) => Promise<any>;
  syncLfsToOpfs: (
    db: ShadowClawDatabase,
    groupId: string,
    repo: string,
    dir: string,
    includeGit?: boolean,
  ) => Promise<void>;
  syncOpfsToLfs: (
    db: ShadowClawDatabase,
    groupId: string,
    dir: string,
    repo: string,
    includeGit?: boolean,
  ) => Promise<void>;
  readGroupFile: (
    db: ShadowClawDatabase,
    groupId: string,
    path: string,
  ) => Promise<string>;
  configKeys: {
    GIT_CORS_PROXY: string;
    GIT_PROXY_URL: string;
    GIT_AUTHOR_NAME: string;
    GIT_AUTHOR_EMAIL: string;
  };
}

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

function indent(text: string, prefix: string): string {
  return text
    .split("\n")
    .map((line) => prefix + line)
    .join("\n");
}

async function resolveCorsProxy(
  db: ShadowClawDatabase,
  deps: GitToolDeps,
): Promise<string> {
  const pref = await deps.getConfig(db, deps.configKeys.GIT_CORS_PROXY);
  const customUrl = await deps.getConfig(db, deps.configKeys.GIT_PROXY_URL);

  return deps.getProxyUrl(
    pref === "public" ? "public" : pref === "custom" ? "custom" : "local",
    customUrl,
  );
}

export async function executeGitTool(
  db: ShadowClawDatabase,
  name: string,
  input: Record<string, any>,
  groupId: string,
  deps: GitToolDeps,
): Promise<string> {
  switch (name) {
    case "git_clone": {
      const creds = await deps.resolveGitCredentials(db, input.url);
      const corsProxy = await resolveCorsProxy(db, deps);

      const repo = await deps.gitClone({
        url: input.url,
        branch: input.branch,
        depth: input.depth,
        corsProxy,
        token: creds.token,
        username: creds.username,
        password: creds.password,
      });

      const includeGit = input.include_git === true;
      await deps.syncLfsToOpfs(db, groupId, repo, `repos/${repo}`, includeGit);

      return `Cloned ${input.url} as "${repo}". Files are available recursively at "repos/${repo}". Use repo="${repo}" for other git_ tools.`;
    }

    case "git_sync": {
      const dir = `repos/${input.repo}`;
      const includeGit = input.include_git === true;

      if (input.direction === "push") {
        await deps.syncOpfsToLfs(db, groupId, dir, input.repo, includeGit);

        return `Synced workspace files in ${dir} to git clone (ready for commit/status).`;
      }

      await deps.syncLfsToOpfs(db, groupId, input.repo, dir, includeGit);

      return `Synced git clone files to workspace ${dir} (overwriting local changes).`;
    }

    case "git_checkout": {
      const result = await deps.gitCheckout({
        repo: input.repo,
        ref: input.ref,
      });
      await deps.syncLfsToOpfs(db, groupId, input.repo, `repos/${input.repo}`);

      return result;
    }

    case "git_branch": {
      const result = await deps.gitBranch({
        repo: input.repo,
        name: input.name,
        checkout: input.checkout,
        startPoint: input.start_point,
      });

      if (input.checkout) {
        await deps.syncLfsToOpfs(
          db,
          groupId,
          input.repo,
          `repos/${input.repo}`,
        );
      }

      return result;
    }

    case "git_status": {
      try {
        await deps.syncOpfsToLfs(
          db,
          groupId,
          `repos/${input.repo}`,
          input.repo,
        );
      } catch {
        // Ignore if OPFS folder doesn't exist yet.
      }

      return deps.gitStatus({ repo: input.repo });
    }

    case "git_add": {
      try {
        await deps.syncOpfsToLfs(
          db,
          groupId,
          `repos/${input.repo}`,
          input.repo,
        );
      } catch {
        // Ignore if OPFS folder doesn't exist yet.
      }

      return deps.gitAdd({
        repo: input.repo,
        filepath: input.filepath,
      });
    }

    case "git_log": {
      return deps.gitLog({
        repo: input.repo,
        ref: input.ref,
        depth: input.depth,
      });
    }

    case "git_diff": {
      try {
        await deps.syncOpfsToLfs(
          db,
          groupId,
          `repos/${input.repo}`,
          input.repo,
        );
      } catch {
        // Ignore missing OPFS directory.
      }

      return deps.gitDiff({
        repo: input.repo,
        ref1: input.ref1,
        ref2: input.ref2,
      });
    }

    case "git_branches": {
      return deps.gitListBranches({
        repo: input.repo,
        remote: input.remote,
      });
    }

    case "git_list_repos": {
      return deps.gitListRepos();
    }

    case "git_delete_repo": {
      return deps.gitDeleteRepo({ repo: input.repo });
    }

    case "git_commit": {
      try {
        await deps.syncOpfsToLfs(
          db,
          groupId,
          `repos/${input.repo}`,
          input.repo,
        );
      } catch {
        return `Error: Could not sync from OPFS. Did you delete repos/${input.repo}?`;
      }

      const commitRemoteUrl = await deps.getRemoteUrl({ repo: input.repo });
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
        repo: input.repo,
        message: input.message,
        authorName,
        authorEmail,
      });
    }

    case "git_pull": {
      const remoteUrl = await deps.getRemoteUrl({ repo: input.repo });
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
        repo: input.repo,
        branch: input.branch,
        authorName,
        authorEmail,
        token: creds.token,
        username: creds.username,
        password: creds.password,
        corsProxy,
      });
    }

    case "git_push": {
      const pushRemoteUrl = await deps.getRemoteUrl({ repo: input.repo });
      const creds = await deps.resolveGitCredentials(db, pushRemoteUrl);

      if (!creds.token && !creds.username) {
        return "Error: No git credentials configured. Add a Git account with a Personal Access Token or username/password in Settings → Git.";
      }

      const corsProxy = await resolveCorsProxy(db, deps);

      return deps.gitPush({
        repo: input.repo,
        branch: input.branch,
        remoteRef: input.remote_ref,
        force: input.force,
        token: creds.token,
        username: creds.username,
        password: creds.password,
        corsProxy,
      });
    }

    case "git_merge": {
      try {
        await deps.syncOpfsToLfs(
          db,
          groupId,
          `repos/${input.repo}`,
          input.repo,
        );
      } catch {
        // Ignore if OPFS folder doesn't exist yet.
      }

      let authorName = input.author_name;
      let authorEmail = input.author_email;

      if (!authorName) {
        const stored = await deps.getConfig(
          db,
          deps.configKeys.GIT_AUTHOR_NAME,
        );
        if (stored) {
          authorName = stored;
        }
      }

      if (!authorEmail) {
        const stored = await deps.getConfig(
          db,
          deps.configKeys.GIT_AUTHOR_EMAIL,
        );
        if (stored) {
          authorEmail = stored;
        }
      }

      let mergeResult: string;
      try {
        mergeResult = await deps.gitMerge({
          repo: input.repo,
          theirs: input.theirs,
          authorName,
          authorEmail,
        });
      } catch (mergeErr: any) {
        await deps.syncLfsToOpfs(
          db,
          groupId,
          input.repo,
          `repos/${input.repo}`,
        );

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

      await deps.syncLfsToOpfs(db, groupId, input.repo, `repos/${input.repo}`);

      return mergeResult;
    }

    case "git_reset": {
      const result = await deps.gitReset({
        repo: input.repo,
        ref: input.ref,
      });

      await deps.syncLfsToOpfs(db, groupId, input.repo, `repos/${input.repo}`);

      return result;
    }

    default:
      return `Unknown git tool: ${name}`;
  }
}
