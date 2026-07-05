import type { GitToolDeps } from "../../subsystems/git/types.js";
import type { ShadowClawDatabase } from "../../db/types.js";

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

function indent(text: string, prefix: string): string {
  return text
    .split("\n")
    .map((line) => prefix + line)
    .join("\n");
}

function parseConflictRegions(content: string): {
  ours: string;
  oursLabel: string;
  startLine: number;
  theirs: string;
  theirsLabel: string;
}[] {
  const regions: {
    ours: string;
    oursLabel: string;
    startLine: number;
    theirs: string;
    theirsLabel: string;
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
        ours: oursLines.join("\n"),
        oursLabel,
        startLine,
        theirs: theirsLines.join("\n"),
        theirsLabel,
      });
    }

    i++;
  }

  return regions;
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
  // Resolve the workspace group dir once — all git ops write here so repos
  // are immediately visible to read_file / write_file / the Files panel.
  const groupRoot = await deps.getGroupDir(db, groupId);

  switch (name) {
    case "git_add": {
      return deps.gitAdd({
        filepath: input.filepaths ?? input.filepath,
        groupRoot,
        repo: input.repo,
      });
    }

    case "git_branch": {
      const result = await deps.gitBranch({
        checkout: input.checkout,
        groupRoot,
        name: input.name,
        repo: input.repo,
        startPoint: input.start_point,
      });

      return result;
    }

    case "git_branches": {
      return deps.gitListBranches({
        groupRoot,
        remote: input.remote,
        repo: input.repo,
      });
    }

    case "git_checkout": {
      const result = await deps.gitCheckout({
        groupRoot,
        ref: input.ref,
        repo: input.repo,
      });

      return result;
    }

    case "git_clone": {
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
    }

    case "git_commit": {
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
    }

    case "git_config": {
      return deps.gitConfig({
        command: input.command,
        groupRoot,
        key: input.key,
        repo: input.repo,
        value: input.value,
      });
    }

    case "git_delete_branch": {
      return deps.gitDeleteBranch({
        groupRoot,
        name: input.name,
        repo: input.repo,
      });
    }

    case "git_delete_repo": {
      return deps.gitDeleteRepo({ repo: input.repo, groupRoot });
    }

    case "git_diff": {
      return deps.gitDiff({
        groupRoot,
        ref1: input.ref1,
        ref2: input.ref2,
        repo: input.repo,
      });
    }

    case "git_fetch": {
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
    }

    case "git_init": {
      const result = await deps.gitInit({ repo: input.repo, groupRoot });

      return result;
    }

    case "git_list_repos": {
      return deps.gitListRepos({ groupRoot });
    }

    case "git_log": {
      return deps.gitLog({
        depth: input.depth,
        groupRoot,
        ref: input.ref,
        repo: input.repo,
      });
    }

    case "git_merge": {
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
    }

    case "git_pull": {
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
    }

    case "git_push": {
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
    }

    case "git_read_file_at_ref": {
      return deps.gitReadFileAtRef({
        filepath: input.filepath,
        groupRoot,
        ref: input.ref,
        repo: input.repo,
      });
    }

    case "git_remote": {
      return deps.gitRemote({
        command: input.command,
        groupRoot,
        remote: input.remote,
        repo: input.repo,
        url: input.url,
      });
    }

    case "git_reset": {
      const result = await deps.gitReset({
        groupRoot,
        ref: input.ref,
        repo: input.repo,
      });

      return result;
    }

    case "git_show": {
      return deps.gitShow({
        groupRoot,
        ref: input.ref || "HEAD",
        repo: input.repo,
      });
    }

    case "git_status": {
      return deps.gitStatus({ repo: input.repo, groupRoot });
    }

    case "git_tag": {
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
    }

    case "git_unstage": {
      return deps.gitUnstage({
        filepath: input.filepath,
        groupRoot,
        repo: input.repo,
      });
    }

    default:
      return `Unknown tool: ${name}`;
  }
}
