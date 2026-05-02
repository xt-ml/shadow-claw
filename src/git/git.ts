/**
 * ShadowClaw — Isomorphic-git browser operations
 *
 * Uses LightningFS as the filesystem backend (separate "/git" namespace).
 * Repos are stored at /git/<repo-name>/.
 *
 * Dependencies are loaded lazily via dynamic import() using full CDN URLs
 * so this module works inside Web Workers (which lack the page importmap).
 */

import { DEFAULT_DEV_HOST, DEFAULT_DEV_PORT } from "../config.js";

import LightningFS from "@isomorphic-git/lightning-fs";
import * as zip from "@zip.js/zip.js";
import git from "isomorphic-git";
import http from "isomorphic-git/http/web";
import { Buffer } from "buffer";

if (!globalThis.Buffer) {
  globalThis.Buffer = Buffer;
}

/* eslint-disable no-undef */
/* eslint-disable no-undef */
let _git: any = null;
let _http: any = null;
let _fs: any = null;
let _pfs: any = null;
let _initPromise: Promise<void> | null = null;

const GIT_NAMESPACE = "shadowclaw-git";
const GIT_ROOT = "/git";
const PUBLIC_CORS_PROXY = "https://www.cors-anywhere.com";
const DEFAULT_DEPTH = 20;

/**
 * Get the CORS proxy URL based on preference.
 */
export function getProxyUrl(
  preference: "local" | "public" | "custom",
  customUrl?: string,
): string {
  if (preference === "custom" && customUrl) {
    return customUrl;
  }

  if (preference === "public") {
    return PUBLIC_CORS_PROXY;
  }

  // Default to local proxy
  const { protocol, host, hostname } = globalThis.location;

  // If running on localhost/127.0.0.1, use the current host (works for dev)
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return `${protocol}//${host}/git-proxy`;
  }

  // If on a remote host (e.g. GitHub Pages), default to local dev server port

  return `http://${DEFAULT_DEV_HOST}:${DEFAULT_DEV_PORT}/git-proxy`;
}

/**
 * Lazily load all git dependencies and initialise LightningFS.
 * Safe to call multiple times — idempotent. Returns cached refs after
 * the first successful load.
 */
export async function initGitFs(): Promise<{
  git: any;
  http: any;
  fs: any;
  pfs: any;
}> {
  if (!_initPromise) {
    _initPromise = (async () => {
      _git = git;
      _http = http;

      if (!_fs) {
        _fs = new LightningFS(GIT_NAMESPACE);
        _pfs = _fs.promises;
      }
    })();
  }

  await _initPromise;

  return { git: _git, http: _http, fs: _fs, pfs: _pfs };
}

/**
 * Derive a short repo name from a URL.
 *
 * "https://github.com/xt-ml/shadow-claw" → "shadow-claw"
 * "https://github.com/xt-ml/shadow-claw.git" → "shadow-claw"
 */
export function repoNameFromUrl(url: string): string {
  const last = url.replace(/\/+$/, "").split("/").pop() || "repo";

  return last.replace(/\.git$/, "");
}

/**
 * Build the LightningFS dir path for a repo identifier.
 */
export function repoDir(repo: string): string {
  return `${GIT_ROOT}/${repo}`;
}

/**
 * Ensure a directory exists in LightningFS (mkdir -p).
 */
export async function ensureDir(pfs: any, dir: string): Promise<void> {
  try {
    await pfs.mkdir(dir);
  } catch {
    // already exists — fine
  }
}

// ---------------------------------------------------------------------------
// Git operations
// ---------------------------------------------------------------------------

/**
 * Build auth options for isomorphic-git operations.
 *
 * Returns `headers` with a proactive Authorization header so the credential
 * is sent on the **first** request. This avoids a 401 round-trip, which
 * prevents the browser from showing its native username/password popup.
 *
 * Also provides `onAuth` and `onAuthFailure` callbacks as a safety net:
 * if a 401 still occurs, `onAuth` returns the credentials (or cancels),
 * and `onAuthFailure` always cancels to suppress popups.
 *
 * Priority: token (PAT) > username+password > cancel.
 */
export function buildAuthCallbacks({
  token,
  username,
  password,
}: {
  token?: string;
  username?: string;
  password?: string;
} = {}): {
  headers?: Record<string, string>;
  onAuth: () => any;
  onAuthFailure: () => any;
} {
  let headers: Record<string, string> | undefined;

  if (token) {
    headers = { Authorization: `Basic ${btoa(`${token}:x-oauth-basic`)}` };
  } else if (username) {
    headers = {
      Authorization: `Basic ${btoa(`${username}:${password || ""}`)}`,
    };
  }

  const onAuth = () => {
    if (token) {
      return { username: token, password: "x-oauth-basic" };
    }

    if (username) {
      return { username, password: password || "" };
    }

    return { cancel: true };
  };

  const onAuthFailure = () => ({ cancel: true });

  return { ...(headers ? { headers } : {}), onAuth, onAuthFailure };
}

/**
 * Clone a repository into LightningFS.
 */
export async function gitClone({
  url,
  branch,
  depth = DEFAULT_DEPTH,
  corsProxy,
  name,
  token,
  username,
  password,
}: {
  url: string;
  branch?: string;
  depth?: number;
  corsProxy?: string;
  name?: string;
  token?: string;
  username?: string;
  password?: string;
}): Promise<string> {
  const { git, http, fs, pfs } = await initGitFs();
  const repo = name || repoNameFromUrl(url);
  const dir = repoDir(repo);

  if (!corsProxy) {
    corsProxy = getProxyUrl("local");
  }

  await ensureDir(pfs, GIT_ROOT);
  await ensureDir(pfs, dir);

  const auth = buildAuthCallbacks({ token, username, password });

  try {
    const cloneOpts: any = {
      fs,
      http,
      dir,
      url,
      singleBranch: true,
      depth,
      corsProxy,
      ...auth,
    };

    if (branch) {
      cloneOpts.ref = branch;
    }

    await git.clone(cloneOpts);
  } catch (cloneErr) {
    // If already cloned, try fetch instead
    try {
      const fetchOpts: any = {
        fs,
        http,
        dir,
        url,
        singleBranch: true,
        depth,
        corsProxy,
        ...auth,
      };

      if (branch) {
        fetchOpts.ref = branch;
      }

      await git.fetch(fetchOpts);
    } catch (fetchErr) {
      // Stale LightningFS state — wipe and retry clone once
      try {
        await rmdirRecursive(pfs, dir);
        await ensureDir(pfs, dir);

        const retryOpts: any = {
          fs,
          http,
          dir,
          url,
          singleBranch: true,
          depth,
          corsProxy,
          ...auth,
        };
        if (branch) {
          retryOpts.ref = branch;
        }

        await git.clone(retryOpts);
      } catch (retryErr) {
        throw new Error(
          `Failed to clone/fetch ${url}: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`,
        );
      }
    }
  }

  return repo;
}

/**
 * Checkout a branch, tag, or commit.
 */
export async function gitCheckout({
  repo,
  ref,
}: {
  repo: string;
  ref: string;
}): Promise<string> {
  const { git, fs } = await initGitFs();
  const dir = repoDir(repo);

  await git.checkout({ fs, dir, ref, force: true });

  return `Checked out ${ref} in ${repo}`;
}

/**
 * Create a new branch, optionally checking it out.
 */
export async function gitBranch({
  repo,
  name,
  checkout = false,
  startPoint,
}: {
  repo: string;
  name: string;
  checkout?: boolean;
  startPoint?: string;
}): Promise<string> {
  const { git, fs } = await initGitFs();
  const dir = repoDir(repo);

  const branchOpts: { fs: any; dir: string; ref: string; object?: string } = {
    fs,
    dir,
    ref: name,
  };
  if (startPoint) {
    branchOpts.object = startPoint;
  }

  await git.branch(branchOpts);

  if (checkout) {
    await git.checkout({ fs, dir, ref: name });

    return `Created and switched to branch ${name} in ${repo}`;
  }

  return `Created branch ${name} in ${repo}`;
}

/**
 * Get the status matrix for a repo.
 *
 * Returns a human-readable status string.
 */
export async function gitStatus({ repo }: { repo: string }): Promise<string> {
  const { git, fs } = await initGitFs();
  const dir = repoDir(repo);

  const matrix = await git.statusMatrix({ fs, dir });

  if (matrix.length === 0) {
    return "Empty repository.";
  }

  // Status matrix: [filepath, HEAD, WORKDIR, STAGE]
  // 0 = absent, 1 = identical to HEAD, 2 = modified
  const lines: string[] = [];

  for (const [filepath, head, workdir, stage] of matrix) {
    let status = "";

    if (head === 0 && workdir === 2 && stage === 2) {
      status = "added";
    } else if (head === 0 && workdir === 2 && stage === 0) {
      status = "new (unstaged)";
    } else if (head === 1 && workdir === 2 && stage === 2) {
      status = "modified (staged)";
    } else if (head === 1 && workdir === 2 && stage === 1) {
      status = "modified";
    } else if (head === 1 && workdir === 0 && stage === 0) {
      status = "deleted";
    } else if (head === 1 && workdir === 1 && stage === 1) {
      continue; // unmodified
    } else {
      status = `[${head},${workdir},${stage}]`;
    }

    lines.push(`${status}: ${filepath}`);
  }

  if (lines.length === 0) {
    const branch = await git.currentBranch({ fs, dir });

    return `On branch ${branch || "(detached HEAD)"}\nNothing to commit, working tree clean.`;
  }

  const branch = await git.currentBranch({ fs, dir });

  return `On branch ${branch || "(detached HEAD)"}\n${lines.join("\n")}`;
}

/**
 * Get the commit log.
 */
export async function gitLog({
  repo,
  ref,
  depth = 10,
}: {
  repo: string;
  ref?: string;
  depth?: number;
}): Promise<string> {
  const { git, fs } = await initGitFs();
  const dir = repoDir(repo);

  const logOpts: any = { fs, dir, depth };
  if (ref) {
    logOpts.ref = ref;
  }

  const commits = await git.log(logOpts);

  if (commits.length === 0) {
    return "No commits found.";
  }

  return commits
    .map((entry: any) => {
      const c = entry.commit;
      const date = new Date(c.author.timestamp * 1000).toISOString();

      return `${entry.oid} ${date} ${c.author.name} — ${c.message.trim().split("\n")[0]}`;
    })
    .join("\n");
}

/**
 * Show a diff between two refs (or HEAD vs working tree).
 *
 * Uses git.walk with TREE comparisons.
 */
export async function gitDiff({
  repo,
  ref1,
  ref2,
}: {
  repo: string;
  ref1?: string;
  ref2?: string;
}): Promise<string> {
  const { git, fs } = await initGitFs();
  const dir = repoDir(repo);
  const pfs = fs.promises;

  // Simple approach: compare statusMatrix-style for working tree changes
  if (!ref1 && !ref2) {
    // HEAD vs working directory
    const matrix = await git.statusMatrix({ fs, dir });
    const changed = matrix.filter(
      ([, head, workdir]: any[]) => !(head === 1 && workdir === 1),
    );

    if (changed.length === 0) {
      return "No differences.";
    }

    const sections: string[] = [];
    for (const [filepath, head, workdir] of changed) {
      try {
        if (head === 0 && workdir === 2) {
          // New file — show all lines as added
          const content = await readWorkdirText(pfs, dir, filepath);
          const added = content
            .split("\n")
            .map((l) => `+${l}`)
            .join("\n");
          sections.push(`--- /dev/null\n+++ ${filepath} (new file)\n${added}`);
        } else if (head === 1 && workdir === 0) {
          // Deleted file — show all lines as removed
          const content = await readHeadText(git, fs, dir, filepath);
          const removed = content
            .split("\n")
            .map((l) => `-${l}`)
            .join("\n");
          sections.push(`--- ${filepath} (deleted)\n+++ /dev/null\n${removed}`);
        } else if (head === 1 && workdir === 2) {
          // Modified — show simple line diff
          const oldText = await readHeadText(git, fs, dir, filepath);
          const newText = await readWorkdirText(pfs, dir, filepath);
          sections.push(simpleDiff(filepath, oldText, newText));
        } else {
          sections.push(`??? ${filepath} [${head},${workdir}]`);
        }
      } catch {
        // Fall back to summary if content can't be read (binary, etc.)
        if (head === 0 && workdir === 2) {
          sections.push(`+++ ${filepath} (new file)`);
        } else if (head === 1 && workdir === 0) {
          sections.push(`--- ${filepath} (deleted)`);
        } else {
          sections.push(`~~~ ${filepath} (modified)`);
        }
      }
    }

    return sections.join("\n");
  }

  // Compare two refs using readTree
  const oid1 = await git.resolveRef({ fs, dir, ref: ref1 || "HEAD" });
  const oid2 = await git.resolveRef({ fs, dir, ref: ref2 });

  if (oid1 === oid2) {
    return "Refs are identical.";
  }

  return `Comparing ${ref1 || "HEAD"} (${oid1.substring(0, 7)}) → ${ref2} (${oid2.substring(0, 7)})\n(Full tree diff not yet implemented — use git_status for working tree changes.)`;
}

/**
 * Read file content from HEAD as UTF-8 text.
 */
async function readHeadText(
  git: any,
  fs: any,
  dir: string,
  filepath: string,
): Promise<string> {
  const oid = await git.resolveRef({ fs, dir, ref: "HEAD" });
  const { blob } = await git.readBlob({ fs, dir, oid, filepath });

  return decodeBytes(blob);
}

/**
 * Read file content from the working directory as UTF-8 text.
 */
async function readWorkdirText(
  pfs: any,
  dir: string,
  filepath: string,
): Promise<string> {
  const buf = await pfs.readFile(`${dir}/${filepath}`);
  if (typeof buf === "string") {
    return buf;
  }

  return decodeBytes(buf);
}

/**
 * Decode bytes to string, preferring TextDecoder with Buffer fallback.
 */
function decodeBytes(bytes: Uint8Array | Buffer): string {
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder().decode(bytes);
  }

  return Buffer.from(bytes).toString("utf-8");
}

/**
 * Produce a simple unified-style diff between two texts.
 */
function simpleDiff(
  filepath: string,
  oldText: string,
  newText: string,
): string {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const header = `--- a/${filepath}\n+++ b/${filepath}`;
  const diffLines: string[] = [];

  const max = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < max; i++) {
    const ol = i < oldLines.length ? oldLines[i] : undefined;
    const nl = i < newLines.length ? newLines[i] : undefined;
    if (ol === nl) {
      diffLines.push(` ${ol}`);
    } else {
      if (ol !== undefined) {
        diffLines.push(`-${ol}`);
      }

      if (nl !== undefined) {
        diffLines.push(`+${nl}`);
      }
    }
  }

  return `${header}\n${diffLines.join("\n")}`;
}

/**
 * Get the URL of a remote (default: "origin").
 */
export async function getRemoteUrl({
  repo,
  remote = "origin",
}: {
  repo: string;
  remote?: string;
}): Promise<string | undefined> {
  const { git, fs } = await initGitFs();
  const dir = repoDir(repo);

  try {
    const remotes = await git.listRemotes({ fs, dir });
    const match = remotes.find(
      (r: { remote: string; url: string }) => r.remote === remote,
    );

    return match?.url;
  } catch {
    return undefined;
  }
}

/**
 * List branches.
 */
export async function gitListBranches({
  repo,
  remote = false,
}: {
  repo: string;
  remote?: boolean;
}): Promise<string> {
  const { git, fs } = await initGitFs();
  const dir = repoDir(repo);

  const branches = await git.listBranches({
    fs,
    dir,
    remote: remote ? "origin" : undefined,
  });

  let current = null;
  try {
    current = await git.currentBranch({ fs, dir });
  } catch {
    // detached HEAD or error
  }

  if (branches.length === 0) {
    return "No branches found.";
  }

  return branches
    .map((b: string) => (b === current ? `* ${b}` : `  ${b}`))
    .join("\n");
}

/**
 * Get the current branch name.
 */
export async function gitCurrentBranch({
  repo,
}: {
  repo: string;
}): Promise<string> {
  const { git, fs } = await initGitFs();
  const dir = repoDir(repo);

  const branch = await git.currentBranch({ fs, dir });

  return branch || "(detached HEAD)";
}

/**
 * Stage all changed files and commit.
 */
export async function gitCommit({
  repo,
  message,
  authorName = "ShadowClaw",
  authorEmail = "k9@shadowclaw.local",
}: {
  repo: string;
  message: string;
  authorName?: string;
  authorEmail?: string;
}): Promise<string> {
  const { git, fs } = await initGitFs();
  const dir = repoDir(repo);

  // Stage all changes
  const matrix = await git.statusMatrix({ fs, dir });
  for (const [filepath, head, workdir, stage] of matrix) {
    if (workdir !== stage || head === 0) {
      if (workdir === 0) {
        await git.remove({ fs, dir, filepath });
      } else {
        await git.add({ fs, dir, filepath });
      }
    }
  }

  const oid = await git.commit({
    fs,
    dir,
    message,
    author: { name: authorName, email: authorEmail },
  });

  return `Committed ${oid.substring(0, 7)}: ${message}`;
}

/**
 * Add files to the git index (stage files).
 */
export async function gitAdd({
  repo,
  filepath,
}: {
  repo: string;
  filepath: string | string[];
}): Promise<string> {
  const { git, fs } = await initGitFs();
  const dir = repoDir(repo);

  if (Array.isArray(filepath)) {
    for (const f of filepath) {
      await git.add({ fs, dir, filepath: f });
    }
  } else {
    await git.add({ fs, dir, filepath });
  }

  return `Added ${Array.isArray(filepath) ? filepath.join(", ") : filepath} to the index in ${repo}`;
}

/**
 * Fetch and merge commits from a remote.
 */
export async function gitPull({
  repo,
  branch,
  authorName = "ShadowClaw",
  authorEmail = "k9@shadowclaw.local",
  token,
  username,
  password,
  remote = "origin",
  corsProxy,
}: {
  repo: string;
  branch?: string;
  authorName?: string;
  authorEmail?: string;
  token?: string;
  username?: string;
  password?: string;
  remote?: string;
  corsProxy?: string;
}): Promise<string> {
  const { git, http, fs } = await initGitFs();
  const dir = repoDir(repo);

  const ref = branch || (await git.currentBranch({ fs, dir }));

  if (!ref) {
    throw new Error("No branch to pull — HEAD is detached.");
  }

  const auth = buildAuthCallbacks({ token, username, password });

  const pullOpts = {
    fs,
    http,
    dir,
    ref,
    remote,
    singleBranch: true,
    author: { name: authorName, email: authorEmail },
    corsProxy: corsProxy || getProxyUrl("local"),
    ...auth,
  };

  await git.pull(pullOpts);

  return `Pulled latest changes for ${ref} from ${remote} successfully.`;
}

/**
 * Push to a remote.
 */
export async function gitPush({
  repo,
  branch,
  remoteRef,
  token,
  username,
  password,
  remote = "origin",
  corsProxy,
  force = false,
}: {
  repo: string;
  branch?: string;
  remoteRef?: string;
  token?: string;
  username?: string;
  password?: string;
  remote?: string;
  corsProxy?: string;
  force?: boolean;
}): Promise<string> {
  const { git, http, fs } = await initGitFs();
  const dir = repoDir(repo);

  const ref = branch || (await git.currentBranch({ fs, dir }));

  if (!ref) {
    throw new Error("No branch to push — HEAD is detached.");
  }

  const auth = buildAuthCallbacks({ token, username, password });

  const pushOpts = {
    fs,
    http,
    dir,
    ref,
    remote,
    force,
    corsProxy: corsProxy || getProxyUrl("local"),
    ...auth,
    ...(remoteRef ? { remoteRef } : {}),
  };

  const result = await git.push(pushOpts);

  const target = remoteRef || ref;
  if (result.ok) {
    return `Pushed ${ref} to ${remote}/${target} successfully.`;
  }

  return `Push result: ${JSON.stringify(result.refs || result)}`;
}

/**
 * Merge a branch into the current branch.
 */
export async function gitMerge({
  repo,
  theirs,
  authorName = "ShadowClaw",
  authorEmail = "k9@shadowclaw.local",
}: {
  repo: string;
  theirs: string;
  authorName?: string;
  authorEmail?: string;
}): Promise<string> {
  const { git, fs } = await initGitFs();
  const dir = repoDir(repo);

  const currentBranch = await git.currentBranch({ fs, dir });
  if (!currentBranch) {
    throw new Error("Cannot merge — HEAD is detached.");
  }

  const result = await git.merge({
    fs,
    dir,
    ours: currentBranch,
    theirs,
    abortOnConflict: false,
    author: { name: authorName, email: authorEmail },
  });

  if (result.alreadyMerged) {
    return `Already up to date — ${currentBranch} already contains ${theirs}.`;
  }

  if (result.fastForward) {
    await git.checkout({ fs, dir, ref: currentBranch });

    return `Fast-forward merge: ${currentBranch} updated to ${theirs} (${result.oid?.substring(0, 7)}).`;
  }

  return `Merged ${theirs} into ${currentBranch} (merge commit: ${result.oid?.substring(0, 7)}).`;
}

/**
 * Reset the current branch HEAD to a specific ref or commit.
 */
export async function gitReset({
  repo,
  ref,
}: {
  repo: string;
  ref: string;
}): Promise<string> {
  const { git, fs, pfs } = await initGitFs();
  const dir = repoDir(repo);

  const currentBranch = await git.currentBranch({ fs, dir });
  if (!currentBranch) {
    throw new Error("Cannot reset — HEAD is detached.");
  }

  // Resolve the target to a full OID
  const targetOid = await git.resolveRef({ fs, dir, ref });

  // Update the branch ref to point to the target commit
  // Write the new OID directly to the branch ref file
  const refPath = `${dir}/.git/refs/heads/${currentBranch}`;
  await (pfs as any).writeFile(refPath, targetOid + "\n", "utf8");

  // Checkout the new HEAD to update the working tree
  await git.checkout({ fs, dir, ref: currentBranch, force: true });

  return `Reset ${currentBranch} to ${ref} (${targetOid.substring(0, 7)}). Working tree updated.`;
}

/**
 * List all cloned repos in the /git directory.
 */
export async function gitListRepos(): Promise<string> {
  const { pfs } = await initGitFs();

  try {
    const entries = await pfs.readdir(GIT_ROOT);
    if (entries.length === 0) {
      return "No repos cloned.";
    }

    return entries.join("\n");
  } catch {
    return "No repos cloned.";
  }
}

/**
 * Recursively remove a directory tree from LightningFS.
 * LightningFS rmdir only works on empty dirs, so we must walk.
 */
export async function rmdirRecursive(pfs: any, dirPath: string): Promise<void> {
  const entries = await pfs.readdir(dirPath);
  for (const entry of entries) {
    const full = `${dirPath}/${entry}`;
    const st = await pfs.stat(full);
    if (st.isDirectory()) {
      await rmdirRecursive(pfs, full);
    } else {
      await pfs.unlink(full);
    }
  }

  await pfs.rmdir(dirPath);
}

/**
 * Delete a cloned repo from LightningFS, wiping all git data.
 */
export async function gitDeleteRepo({
  repo,
}: {
  repo: string;
}): Promise<string> {
  if (!repo) {
    throw new Error("repo name is required");
  }

  if (repo.includes("..") || repo.includes("/")) {
    throw new Error("Invalid repo name");
  }

  const { pfs } = await initGitFs();
  const dir = repoDir(repo);

  try {
    await pfs.readdir(dir);
  } catch {
    return `Repo "${repo}" not found in LightningFS.`;
  }

  await rmdirRecursive(pfs, dir);

  return `Deleted "${repo}" from LightningFS git storage.`;
}
