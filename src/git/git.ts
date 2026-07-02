/**
 * ShadowClaw — Isomorphic-git browser operations
 *
 * Uses native OPFS handles as the filesystem backend.
 * Repos are stored under `repos/<repo-name>/` relative to the filesystem root.
 *
 * Provides a minimal `fs.promises`-compatible adapter so isomorphic-git
 * can operate fully on OPFS without any intermediate in-memory layer.
 */

import { DEFAULT_DEV_HOST, DEFAULT_DEV_PORT } from "../config.js";

import git from "isomorphic-git";
import http from "isomorphic-git/http/web";
import { Buffer } from "buffer";

if (!globalThis.Buffer) {
  globalThis.Buffer = Buffer;
}

let _git: any = null;
let _http: any = null;
let _fs: any = null;
let _pfs: any = null;
let _initPromise: Promise<void> | null = null;

// ---------------------------------------------------------------------------
// OPFS path resolver helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a posix-style path string into a FileSystemHandle relative to
 * a given root DirectoryHandle, optionally creating missing directories.
 *
 * Returns a FileSystemFileHandle for leaf paths that look like files (i.e.
 * the last segment has a "." in it or `forceFile` is true), and a
 * FileSystemDirectoryHandle otherwise.
 */
function normalizeOpfsPath(path: string): string {
  return path
    .trim()
    .replace(/^[\\/]+/, "")
    .replace(/[\\/]+$/, "")
    .split(/[\\/]+/)
    .filter((segment) => segment !== "." && segment !== "")
    .join("/");
}

async function resolvePathToHandle(
  root: FileSystemDirectoryHandle,
  path: string,
  opts: { create?: boolean; forceFile?: boolean } = {},
): Promise<FileSystemHandle> {
  const normalizedPath = normalizeOpfsPath(path);
  const segments = normalizedPath.split("/").filter(Boolean);
  if (segments.length === 0) {
    return root;
  }

  let current: FileSystemDirectoryHandle = root;
  for (let i = 0; i < segments.length - 1; i++) {
    current = await current.getDirectoryHandle(segments[i], {
      create: opts.create ?? false,
    });
  }

  const last = segments[segments.length - 1];

  // Treat as file when the caller says so, or when there's an extension.
  if (opts.forceFile || last.includes(".")) {
    try {
      return await current.getFileHandle(last, {
        create: opts.create ?? false,
      });
    } catch {
      // Fall through and try as directory.
    }
  }

  // Try directory first.
  try {
    return await current.getDirectoryHandle(last, {
      create: opts.create ?? false,
    });
  } catch {
    // If that failed, try as file (e.g. `.git` config file).

    return await current.getFileHandle(last, { create: opts.create ?? false });
  }
}

async function resolveDirHandle(
  root: FileSystemDirectoryHandle,
  path: string,
  opts: { create?: boolean } = {},
): Promise<FileSystemDirectoryHandle> {
  const normalizedPath = normalizeOpfsPath(path);
  const segments = normalizedPath.split("/").filter(Boolean);
  if (segments.length === 0) {
    return root;
  }

  let current: FileSystemDirectoryHandle = root;
  for (const seg of segments) {
    current = await current.getDirectoryHandle(seg, {
      create: opts.create ?? false,
    });
  }

  return current;
}

async function resolveFileHandle(
  root: FileSystemDirectoryHandle,
  path: string,
  opts: { create?: boolean } = {},
): Promise<FileSystemFileHandle> {
  const normalizedPath = normalizeOpfsPath(path);
  const segments = normalizedPath.split("/").filter(Boolean);
  if (segments.length === 0) {
    throw new Error(`Cannot resolve '.' as file`);
  }

  let current: FileSystemDirectoryHandle = root;
  for (let i = 0; i < segments.length - 1; i++) {
    current = await current.getDirectoryHandle(segments[i], {
      create: opts.create ?? false,
    });
  }

  return current.getFileHandle(segments[segments.length - 1], {
    create: opts.create ?? false,
  });
}

/**
 * Return [parentDirHandle, leafName] for a given path.
 */
async function resolveParent(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<[FileSystemDirectoryHandle, string]> {
  const normalizedPath = normalizeOpfsPath(path);
  const segments = normalizedPath.split("/").filter(Boolean);
  if (segments.length === 0) {
    throw new Error(`Cannot get parent of root`);
  }

  const name = segments[segments.length - 1];
  let parent: FileSystemDirectoryHandle = root;
  for (let i = 0; i < segments.length - 1; i++) {
    parent = await parent.getDirectoryHandle(segments[i], { create: false });
  }

  return [parent, name];
}

function normalizeGitPath(filepath: string): string {
  return filepath
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^\.\//, "");
}

// ---------------------------------------------------------------------------
// Native OPFS fs.promises adapter for isomorphic-git
// ---------------------------------------------------------------------------

export function makeOpfsFs(root: FileSystemDirectoryHandle) {
  const promises = {
    async readFile(
      path: string,
      opts?: BufferEncoding | { encoding?: BufferEncoding },
    ): Promise<Uint8Array | string> {
      const fh = await resolveFileHandle(root, path);
      const file = await fh.getFile();
      const buf = await file.arrayBuffer();
      const encoding =
        typeof opts === "string" ? opts : (opts as any)?.encoding;
      if (encoding === "utf8" || encoding === "utf-8") {
        return new TextDecoder().decode(buf);
      }

      return new Uint8Array(buf);
    },

    async writeFile(
      path: string,
      data: Uint8Array | string,
      _opts?: BufferEncoding | { encoding?: BufferEncoding },
    ): Promise<void> {
      const fh = await resolveFileHandle(root, path, { create: true });
      const writable = await (fh as any).createWritable();
      if (typeof data === "string") {
        data = new TextEncoder().encode(data);
      }

      await writable.write(data);
      await writable.close();
    },

    async mkdir(path: string, _opts?: any): Promise<void> {
      await resolveDirHandle(root, path, { create: true });
    },

    async rmdir(path: string, _opts?: any): Promise<void> {
      const [parent, name] = await resolveParent(root, path);
      await parent.removeEntry(name, { recursive: true });
    },

    async readdir(path: string): Promise<string[]> {
      const dh = await resolveDirHandle(root, path);
      const names: string[] = [];
      for await (const [name] of (dh as any).entries()) {
        names.push(name);
      }

      return names;
    },

    async stat(path: string): Promise<{
      isDirectory(): boolean;
      isFile(): boolean;
      isSymbolicLink(): boolean;
      size: number;
      mtimeMs: number;
      mode: number;
      ino: number;
      dev: number;
      nlink: number;
      uid: number;
      gid: number;
      ctime: Date;
      mtime: Date;
    }> {
      let handle: FileSystemHandle;
      try {
        handle = await resolvePathToHandle(root, path);
      } catch {
        const err: any = new Error(
          `ENOENT: no such file or directory, stat '${path}'`,
        );
        err.code = "ENOENT";

        throw err;
      }

      if (handle.kind === "directory") {
        const now = new Date();

        return {
          isDirectory: () => true,
          isFile: () => false,
          isSymbolicLink: () => false,
          size: 0,
          mtimeMs: Date.now(),
          mode: 0o40755,
          ino: 0,
          dev: 0,
          nlink: 1,
          uid: 0,
          gid: 0,
          ctime: now,
          mtime: now,
        };
      } else {
        const file = await (handle as FileSystemFileHandle).getFile();
        const mtime = new Date(file.lastModified);

        return {
          isDirectory: () => false,
          isFile: () => true,
          isSymbolicLink: () => false,
          size: file.size,
          mtimeMs: file.lastModified,
          mode: 0o100644,
          ino: 0,
          dev: 0,
          nlink: 1,
          uid: 0,
          gid: 0,
          ctime: mtime,
          mtime,
        };
      }
    },

    async lstat(path: string) {
      // OPFS has no symlinks; lstat == stat.

      return promises.stat(path);
    },

    async unlink(path: string): Promise<void> {
      const [parent, name] = await resolveParent(root, path);
      await parent.removeEntry(name);
    },

    async symlink(_target: string, _path: string): Promise<void> {
      // OPFS does not support symlinks; isomorphic-git rarely needs this.

      throw new Error("OPFS does not support symlinks");
    },

    async readlink(path: string): Promise<string> {
      // Fallback: read the file content as a symlink target.
      const data = await promises.readFile(path, "utf8");

      return data as string;
    },
  };

  return { promises };
}

const REPOS_ROOT = "repos";
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

  // If on a remote host, default to local dev server port

  return `http://${DEFAULT_DEV_HOST}:${DEFAULT_DEV_PORT}/git-proxy`;
}

/**
 * Lazily initialise the native OPFS filesystem adapter and isomorphic-git.
 * Safe to call multiple times — idempotent. Returns cached refs after
 * the first successful call.
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
        // Obtain the OPFS root and use it directly. Workspace-scoped git
        // operations are routed through groupRoot when available.
        const opfsRoot = await navigator.storage.getDirectory();
        _fs = makeOpfsFs(opfsRoot);
        _pfs = _fs.promises;
      }
    })();
  }

  await _initPromise;

  return { git: _git, http: _http, fs: _fs, pfs: _pfs };
}

/**
 * Resolve git modules + an OPFS fs adapter, optionally scoped to a workspace
 * group directory. When `groupRoot` is supplied the repos are stored at
 * `repos/<name>/` inside that directory, making them visible to workspace
 * tools such as `read_file` and the Files panel.
 */
export async function initGitContext(
  groupRoot?: FileSystemDirectoryHandle,
): Promise<{
  git: any;
  http: any;
  fs: any;
  pfs: any;
  repoDirFn: (repo: string) => string;
}> {
  // Always initialise so _git / _http modules are cached.
  const base = await initGitFs();
  if (groupRoot) {
    const customFs = makeOpfsFs(groupRoot);

    return {
      git: base.git,
      http: base.http,
      fs: customFs,
      pfs: customFs.promises,
      repoDirFn: (repo: string) => `repos/${repo}`,
    };
  }

  return { ...base, repoDirFn: repoDir };
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
 * Build the OPFS-relative dir path for a repo identifier.
 * The OPFS root is already scoped to the git namespace, so paths
 * are relative to that root (e.g. "/git/my-repo" maps to "git/my-repo"
 * inside the OPFS namespace directory).
 */
export function repoDir(repo: string): string {
  return `${REPOS_ROOT}/${repo}`;
}

/**
 * Ensure core.filemode is set to false to prevent isomorphic-git from
 * considering mode changes (like 100755 to 100644) as file modifications
 * which breaks diff/status/add/commit on OPFS.
 */
export async function ensureCoreFilemodeFalse(git: any, fs: any, dir: string) {
  try {
    const filemode = await git.getConfig({ fs, dir, path: "core.filemode" });
    if (filemode !== false) {
      await git.setConfig({ fs, dir, path: "core.filemode", value: false });
    }
  } catch (err) {
    console.error("Failed to set core.filemode=false:", err);
  }
}

/**
 * Ensure a directory exists in the OPFS adapter (mkdir -p).
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
 * Clone a repository into OPFS or workspace-scoped git storage.
 *
 * When a `groupRoot` handle is provided, the repo is cloned under that
 * workspace root, making it visible to other workspace file tools.
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
  groupRoot,
}: {
  url: string;
  branch?: string;
  depth?: number;
  corsProxy?: string;
  name?: string;
  token?: string;
  username?: string;
  password?: string;
  groupRoot?: FileSystemDirectoryHandle;
}): Promise<string> {
  const { git, http, fs, pfs, repoDirFn } = await initGitContext(groupRoot);
  const repo = name || repoNameFromUrl(url);
  const dir = repoDirFn(repo);

  if (!corsProxy) {
    corsProxy = getProxyUrl("local");
  }

  await ensureDir(pfs, REPOS_ROOT);
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
      // Stale OPFS state — wipe and retry clone once
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

  await ensureCoreFilemodeFalse(git, fs, dir);

  return repo;
}

/**
 * Checkout a branch, tag, or commit.
 */
export async function gitCheckout({
  repo,
  ref,
  groupRoot,
}: {
  repo: string;
  ref: string;
  groupRoot?: FileSystemDirectoryHandle;
}): Promise<string> {
  const { git, fs, repoDirFn } = await initGitContext(groupRoot);
  const dir = repoDirFn(repo);

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
  groupRoot,
}: {
  repo: string;
  name: string;
  checkout?: boolean;
  startPoint?: string;
  groupRoot?: FileSystemDirectoryHandle;
}): Promise<string> {
  const { git, fs, repoDirFn } = await initGitContext(groupRoot);
  const dir = repoDirFn(repo);

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
export async function gitStatus({
  repo,
  groupRoot,
}: {
  repo: string;
  groupRoot?: FileSystemDirectoryHandle;
}): Promise<string> {
  const { git, fs, repoDirFn } = await initGitContext(groupRoot);
  const dir = repoDirFn(repo);
  await ensureCoreFilemodeFalse(git, fs, dir);

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
  groupRoot,
}: {
  repo: string;
  ref?: string;
  depth?: number;
  groupRoot?: FileSystemDirectoryHandle;
}): Promise<string> {
  const { git, fs, repoDirFn } = await initGitContext(groupRoot);
  const dir = repoDirFn(repo);

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
  groupRoot,
}: {
  repo: string;
  ref1?: string;
  ref2?: string;
  groupRoot?: FileSystemDirectoryHandle;
}): Promise<string> {
  const { git, fs, repoDirFn } = await initGitContext(groupRoot);
  const dir = repoDirFn(repo);
  const pfs = fs.promises;
  await ensureCoreFilemodeFalse(git, fs, dir);

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

  // Compare two refs using readTree and git.walk
  const oid1 = await git.resolveRef({ fs, dir, ref: ref1 || "HEAD" });
  const oid2 = await git.resolveRef({ fs, dir, ref: ref2 });

  if (oid1 === oid2) {
    return "Refs are identical.";
  }

  const trees = [git.TREE({ ref: oid1 }), git.TREE({ ref: oid2 })];
  const changes = await git.walk({
    fs,
    dir,
    trees,
    map: async function (filepath, [A, B]) {
      // Ignore root directory
      if (filepath === ".") {
        return;
      }

      if ((await A?.type()) === "tree" || (await B?.type()) === "tree") {
        return;
      }

      const aOid = await A?.oid();
      const bOid = await B?.oid();

      // If identical, ignore
      if (aOid === bOid) {
        return;
      }

      // Read contents
      let oldText = "";
      let newText = "";
      let status = "modified";

      try {
        if (A && aOid) {
          const aBlob = await A.content();
          oldText = decodeBytes(aBlob);
        } else {
          status = "added";
        }

        if (B && bOid) {
          const bBlob = await B.content();
          newText = decodeBytes(bBlob);
        } else {
          status = "deleted";
        }
      } catch (err) {
        // Binary file or error reading

        return `??? ${filepath} (binary or read error)`;
      }

      if (status === "added") {
        const added = newText
          .split("\n")
          .map((l) => `+${l}`)
          .join("\n");

        return `--- /dev/null\n+++ ${filepath} (new file)\n${added}`;
      } else if (status === "deleted") {
        const removed = oldText
          .split("\n")
          .map((l) => `-${l}`)
          .join("\n");

        return `--- ${filepath} (deleted)\n+++ /dev/null\n${removed}`;
      } else {
        return simpleDiff(filepath, oldText, newText);
      }
    },
  });

  const diffStr = changes.filter(Boolean).join("\n\n");
  if (!diffStr) {
    return `Comparing ${ref1 || "HEAD"} (${oid1.substring(0, 7)}) → ${ref2} (${oid2.substring(0, 7)})\nNo differences.`;
  }

  return `Comparing ${ref1 || "HEAD"} (${oid1.substring(0, 7)}) → ${ref2} (${oid2.substring(0, 7)})\n\n${diffStr}`;
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
  groupRoot,
}: {
  repo: string;
  remote?: string;
  groupRoot?: FileSystemDirectoryHandle;
}): Promise<string | undefined> {
  const { git, fs, repoDirFn } = await initGitContext(groupRoot);
  const dir = repoDirFn(repo);

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
  groupRoot,
}: {
  repo: string;
  remote?: boolean;
  groupRoot?: FileSystemDirectoryHandle;
}): Promise<string> {
  const { git, fs, repoDirFn } = await initGitContext(groupRoot);
  const dir = repoDirFn(repo);

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
  groupRoot,
}: {
  repo: string;
  groupRoot?: FileSystemDirectoryHandle;
}): Promise<string> {
  const { git, fs, repoDirFn } = await initGitContext(groupRoot);
  const dir = repoDirFn(repo);

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
  authorEmail = "agent@example.com",
  groupRoot,
}: {
  repo: string;
  message: string;
  authorName?: string;
  authorEmail?: string;
  groupRoot?: FileSystemDirectoryHandle;
}): Promise<string> {
  const { git, fs, repoDirFn } = await initGitContext(groupRoot);
  const dir = repoDirFn(repo);
  await ensureCoreFilemodeFalse(git, fs, dir);

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
  groupRoot,
}: {
  repo: string;
  filepath?: string | string[];
  groupRoot?: FileSystemDirectoryHandle;
}): Promise<string> {
  const { git, fs, repoDirFn } = await initGitContext(groupRoot);
  const dir = repoDirFn(repo);

  const paths =
    filepath === undefined || filepath === null || filepath === ""
      ? ["."]
      : Array.isArray(filepath)
        ? filepath
            .filter((p) => p !== undefined && p !== null && p !== "")
            .map((p) => normalizeGitPath(p))
        : [normalizeGitPath(filepath)];

  if (paths.length === 0) {
    paths.push(".");
  }

  await ensureCoreFilemodeFalse(git, fs, dir);

  if (paths.length === 1 && paths[0] === ".") {
    const matrix: [string, number, number, number][] = await git.statusMatrix({
      fs,
      dir,
    });

    const changedPaths = matrix
      .filter(([, head, workdir, stage]) => workdir !== stage || head === 0)
      .map(([filepath]) => filepath);

    if (changedPaths.length === 0) {
      return `No changes to add in ${repo}`;
    }

    for (const filepath of changedPaths) {
      await git.add({ fs, dir, filepath });
    }

    return `Added ${changedPaths.join(", ")} to the index in ${repo}`;
  }

  for (const f of paths) {
    await git.add({ fs, dir, filepath: f });
  }

  return `Added ${paths.join(", ")} to the index in ${repo}`;
}

/**
 * Fetch and merge commits from a remote.
 */
export async function gitPull({
  repo,
  branch,
  authorName = "ShadowClaw",
  authorEmail = "agent@example.com",
  token,
  username,
  password,
  remote = "origin",
  corsProxy,
  groupRoot,
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
  groupRoot?: FileSystemDirectoryHandle;
}): Promise<string> {
  const { git, http, fs, repoDirFn } = await initGitContext(groupRoot);
  const dir = repoDirFn(repo);

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
  tags = false,
  groupRoot,
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
  tags?: boolean;
  groupRoot?: FileSystemDirectoryHandle;
}): Promise<string> {
  const { git, http, fs, repoDirFn } = await initGitContext(groupRoot);
  const dir = repoDirFn(repo);

  const ref = branch || (await git.currentBranch({ fs, dir }));

  if (!ref) {
    throw new Error("No branch to push — HEAD is detached.");
  }

  const auth = buildAuthCallbacks({ token, username, password });

  const pushOpts: any = {
    fs,
    http,
    dir,
    ref,
    remote,
    force,
    corsProxy: corsProxy || getProxyUrl("local"),
    ...auth,
    ...(remoteRef ? { remoteRef } : {}),
    ...(tags ? { tags: true } : {}),
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
  authorEmail = "agent@example.com",
  groupRoot,
}: {
  repo: string;
  theirs: string;
  authorName?: string;
  authorEmail?: string;
  groupRoot?: FileSystemDirectoryHandle;
}): Promise<string> {
  const { git, fs, repoDirFn } = await initGitContext(groupRoot);
  const dir = repoDirFn(repo);

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
  groupRoot,
}: {
  repo: string;
  ref: string;
  groupRoot?: FileSystemDirectoryHandle;
}): Promise<string> {
  const { git, fs, pfs, repoDirFn } = await initGitContext(groupRoot);
  const dir = repoDirFn(repo);

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
 * List all cloned repos in the repos directory.
 */
export async function gitListRepos({
  groupRoot,
}: { groupRoot?: FileSystemDirectoryHandle } = {}): Promise<string> {
  const { pfs } = await initGitContext(groupRoot);
  const listDir = REPOS_ROOT;

  try {
    const entries = await pfs.readdir(listDir);
    const repos: string[] = [];

    for (const entry of entries) {
      const gitDir = `${listDir}/${entry}/.git`;
      try {
        const stat = await pfs.stat(gitDir);
        if (stat.isDirectory()) {
          repos.push(entry);
        }
      } catch {
        // Skip entries that are not git repositories.
      }
    }

    if (repos.length === 0) {
      return "No repos cloned.";
    }

    return repos.join("\n");
  } catch {
    return "No repos cloned.";
  }
}

/**
 * Delete only the `.git` metadata directory for a repo, leaving the working
 * tree files intact in `repos/<repo>`.
 */
export async function gitDeleteRepo({
  repo,
  groupRoot,
}: {
  repo: string;
  groupRoot?: FileSystemDirectoryHandle;
}): Promise<string> {
  if (!repo) {
    throw new Error("repo name is required");
  }

  if (repo.includes("..") || repo.includes("/")) {
    throw new Error("Invalid repo name");
  }

  const { pfs, repoDirFn } = await initGitContext(groupRoot);
  const dir = repoDirFn(repo);
  const gitDir = `${dir}/.git`;

  try {
    await pfs.readdir(gitDir);
  } catch {
    return `Repo "${repo}" not found in git storage.`;
  }

  await rmdirRecursive(pfs, gitDir);

  return `Deleted git metadata for "${repo}" from OPFS git storage. Working tree files remain in repos/${repo}.`;
}

/**
 * Recursively remove a directory tree.
 * OPFS natively supports `{ recursive: true }` on `removeEntry`, so
 * we simply delegate to `pfs.rmdir` which uses that flag internally.
 * The manual walk fallback handles any adapter that doesn't support it.
 */
export async function rmdirRecursive(pfs: any, dirPath: string): Promise<void> {
  try {
    await pfs.rmdir(dirPath);
  } catch {
    // Fallback: manual recursive walk for adapters without recursive rmdir.
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
}

/**
 * Fetch commits from a remote without merging.
 */
export async function gitFetch({
  repo,
  branch,
  token,
  username,
  password,
  remote = "origin",
  corsProxy,
  groupRoot,
}: {
  repo: string;
  branch?: string;
  token?: string;
  username?: string;
  password?: string;
  remote?: string;
  corsProxy?: string;
  groupRoot?: FileSystemDirectoryHandle;
}): Promise<string> {
  const { git, http, fs, repoDirFn } = await initGitContext(groupRoot);
  const dir = repoDirFn(repo);

  const auth = buildAuthCallbacks({ token, username, password });

  const fetchOpts: any = {
    fs,
    http,
    dir,
    remote,
    singleBranch: true,
    corsProxy: corsProxy || getProxyUrl("local"),
    ...auth,
  };

  if (branch) {
    fetchOpts.ref = branch;
  }

  const result = await git.fetch(fetchOpts);
  const fetchedRef = result.fetchHead || "unknown";

  return `Fetched ${branch || "default branch"} from ${remote} successfully. (FETCH_HEAD is ${fetchedRef})`;
}

/**
 * Read the contents of a file at a specific ref without checking it out.
 */
export async function gitReadFileAtRef({
  repo,
  ref,
  filepath,
  groupRoot,
}: {
  repo: string;
  ref: string;
  filepath: string;
  groupRoot?: FileSystemDirectoryHandle;
}): Promise<string> {
  const { git, fs, repoDirFn } = await initGitContext(groupRoot);
  const dir = repoDirFn(repo);

  const oid = await git.resolveRef({ fs, dir, ref });
  const { blob } = await git.readBlob({ fs, dir, oid, filepath });

  return decodeBytes(blob);
}

/**
 * Show the commit metadata and the diff of a commit against its parent.
 */
export async function gitShow({
  repo,
  ref,
  groupRoot,
}: {
  repo: string;
  ref: string;
  groupRoot?: FileSystemDirectoryHandle;
}): Promise<string> {
  const { git, fs, repoDirFn } = await initGitContext(groupRoot);
  const dir = repoDirFn(repo);

  const oid = await git.resolveRef({ fs, dir, ref });
  const commit = await git.readCommit({ fs, dir, oid });

  const parentOid =
    commit.commit.parent && commit.commit.parent.length > 0
      ? commit.commit.parent[0]
      : undefined;

  let diffStr =
    "(No parent commit, showing as new file is not yet supported in gitShow)";
  if (parentOid) {
    diffStr = await gitDiff({ repo, ref1: parentOid, ref2: oid });
  } else {
    diffStr = "Initial commit.";
  }

  const author = `${commit.commit.author.name} <${commit.commit.author.email}>`;
  const date = new Date(commit.commit.author.timestamp * 1000).toISOString();

  return `commit ${oid}\nAuthor: ${author}\nDate: ${date}\n\n    ${commit.commit.message.replace(/\n/g, "\n    ")}\n\n${diffStr}`;
}

/**
 * Delete a branch locally.
 */
export async function gitDeleteBranch({
  repo,
  name,
  groupRoot,
}: {
  repo: string;
  name: string;
  groupRoot?: FileSystemDirectoryHandle;
}): Promise<string> {
  const { git, fs, repoDirFn } = await initGitContext(groupRoot);
  const dir = repoDirFn(repo);

  await git.deleteBranch({ fs, dir, ref: name });

  return `Deleted local branch ${name} in ${repo}`;
}

/**
 * Initialize a new git repository locally.
 */
export async function gitInit({
  repo,
  groupRoot,
}: {
  repo: string;
  groupRoot?: FileSystemDirectoryHandle;
}): Promise<string> {
  const { git, fs, pfs, repoDirFn } = await initGitContext(groupRoot);
  const dir = repoDirFn(repo);

  await ensureDir(pfs, REPOS_ROOT);
  await ensureDir(pfs, dir);

  await git.init({ fs, dir, defaultBranch: "main" });
  await ensureCoreFilemodeFalse(git, fs, dir);

  return `Initialized empty Git repository in ${repo} (branch: main)`;
}

/**
 * Create an annotated tag.
 */
export async function gitTag({
  repo,
  tag,
  message,
  authorName = "ShadowClaw",
  authorEmail = "agent@example.com",
  groupRoot,
}: {
  repo: string;
  tag: string;
  message?: string;
  authorName?: string;
  authorEmail?: string;
  groupRoot?: FileSystemDirectoryHandle;
}): Promise<string> {
  const { git, fs, repoDirFn } = await initGitContext(groupRoot);
  const dir = repoDirFn(repo);

  if (message) {
    await git.annotatedTag({
      fs,
      dir,
      ref: tag,
      message,
      tagger: { name: authorName, email: authorEmail },
    });

    return `Created annotated tag ${tag} in ${repo}`;
  } else {
    await git.tag({
      fs,
      dir,
      ref: tag,
    });

    return `Created tag ${tag} in ${repo}`;
  }
}

/**
 * List all tags.
 */
export async function gitListTags({
  repo,
  groupRoot,
}: {
  repo: string;
  groupRoot?: FileSystemDirectoryHandle;
}): Promise<string> {
  const { git, fs, repoDirFn } = await initGitContext(groupRoot);
  const dir = repoDirFn(repo);

  const tags = await git.listTags({ fs, dir });

  if (tags.length === 0) {
    return "No tags found.";
  }

  return tags.join("\n");
}

/**
 * Manage remotes (add/remove/list).
 */
export async function gitRemote({
  repo,
  command,
  remote,
  url,
  groupRoot,
}: {
  repo: string;
  command: "add" | "remove" | "list";
  remote?: string;
  url?: string;
  groupRoot?: FileSystemDirectoryHandle;
}): Promise<string> {
  const { git, fs, repoDirFn } = await initGitContext(groupRoot);
  const dir = repoDirFn(repo);

  if (command === "list") {
    const remotes = await git.listRemotes({ fs, dir });
    if (remotes.length === 0) {
      return "No remotes.";
    }

    return remotes.map((r: any) => `${r.remote}\t${r.url}`).join("\n");
  } else if (command === "add") {
    if (!remote || !url) {
      throw new Error("remote and url are required for add");
    }

    await git.addRemote({ fs, dir, remote, url });

    return `Added remote ${remote} -> ${url}`;
  } else if (command === "remove") {
    if (!remote) {
      throw new Error("remote is required for remove");
    }

    await git.deleteRemote({ fs, dir, remote });

    return `Removed remote ${remote}`;
  }

  throw new Error("Invalid command");
}

/**
 * Get or set git config values.
 */
export async function gitConfig({
  repo,
  command,
  key,
  value,
  groupRoot,
}: {
  repo: string;
  command: "get" | "set";
  key: string;
  value?: string;
  groupRoot?: FileSystemDirectoryHandle;
}): Promise<string> {
  const { git, fs, repoDirFn } = await initGitContext(groupRoot);
  const dir = repoDirFn(repo);

  if (command === "get") {
    const val = await git.getConfig({ fs, dir, path: key });

    return val !== undefined ? String(val) : "";
  } else if (command === "set") {
    if (value === undefined) {
      throw new Error("value is required for set");
    }

    await git.setConfig({ fs, dir, path: key, value });

    return `Set ${key} = ${value}`;
  }

  throw new Error("Invalid command");
}

/**
 * Unstage files (remove from index).
 */
export async function gitUnstage({
  repo,
  filepath,
  groupRoot,
}: {
  repo: string;
  filepath: string | string[];
  groupRoot?: FileSystemDirectoryHandle;
}): Promise<string> {
  const { git, fs, repoDirFn } = await initGitContext(groupRoot);
  const dir = repoDirFn(repo);

  if (Array.isArray(filepath)) {
    for (const f of filepath) {
      await git.remove({ fs, dir, filepath: f });
    }
  } else {
    await git.remove({ fs, dir, filepath });
  }

  return `Unstaged ${Array.isArray(filepath) ? filepath.join(", ") : filepath} in ${repo}`;
}
