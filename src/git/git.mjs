/**
 * ShadowClaw — Isomorphic-git browser operations
 *
 * Uses LightningFS as the filesystem backend (separate "/git" namespace).
 * Repos are stored at /git/<repo-name>/.
 *
 * Dependencies are loaded lazily via dynamic import() using full CDN URLs
 * so this module works inside Web Workers (which lack the page importmap).
 */

const UNPKG = "https://unpkg.com";
const JSDELIVR = "https://cdn.jsdelivr.net";

const LFS_URL = `${UNPKG}/@isomorphic-git/lightning-fs@4.6.2/dist/lightning-fs.min.js`;
const GIT_URL = `${UNPKG}/isomorphic-git@1.36.1/index.umd.min.js`;
const HTTP_URL = `${UNPKG}/isomorphic-git@1.36.1/http/web/index.js`;
const BUFFER_URL = `${JSDELIVR}/npm/buffer@6.0.3/+esm`;

/* eslint-disable no-undef */
/** @type {any} */
let _git = null;

/** @type {any} */
let _http = null;

/** @type {any} */
let _fs = null;

/** @type {any} */
let _pfs = null;

/** @type {Promise<void>|null} */
let _initPromise = null;

const GIT_NAMESPACE = "shadowclaw-git";
const GIT_ROOT = "/git";
const PUBLIC_CORS_PROXY = "https://cors.isomorphic-git.org";
const DEFAULT_DEPTH = 20;

/**
 * Get the CORS proxy URL based on preference.
 *
 * @param {"local" | "public"} preference
 *
 * @returns {string}
 */
export function getProxyUrl(preference) {
  if (preference === "public") {
    return PUBLIC_CORS_PROXY;
  }

  // Default to local proxy
  const { protocol, host } = globalThis.location;
  return `${protocol}//${host}/git-proxy`;
}

/**
 * Lazily load all git dependencies and initialise LightningFS.
 * Safe to call multiple times — idempotent. Returns cached refs after
 * the first successful load.
 *
 * @returns {Promise<{ git: any, http: any, fs: any, pfs: any }>}
 */
export async function initGitFs() {
  if (!_initPromise) {
    _initPromise = (async () => {
      // Load Buffer polyfill
      if (!globalThis.Buffer) {
        const bufMod = await import(/* @vite-ignore */ BUFFER_URL);
        globalThis.Buffer =
          bufMod.Buffer || bufMod.default?.Buffer || bufMod.default;
      }

      // Load LightningFS (UMD — sets globalThis.LightningFS)
      // @ts-ignore — dynamic UMD global
      if (!globalThis.LightningFS) {
        await import(/* @vite-ignore */ LFS_URL);
      }
      // Load isomorphic-git (UMD — sets globalThis.git)
      // @ts-ignore — dynamic UMD global
      if (!globalThis.git) {
        await import(/* @vite-ignore */ GIT_URL);
      }
      // Load isomorphic-git HTTP client
      if (!_http) {
        const httpMod = await import(/* @vite-ignore */ HTTP_URL);
        _http = httpMod.default || httpMod;
      }

      _git = /** @type {any} */ (globalThis).git;

      if (!_fs) {
        // @ts-ignore – LightningFS is a UMD global
        _fs = new LightningFS(GIT_NAMESPACE);
        _pfs = /** @type {any} */ (_fs).promises;
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
 *
 * @param {string} url
 * @returns {string}
 */
export function repoNameFromUrl(url) {
  const last = url.replace(/\/+$/, "").split("/").pop() || "repo";
  return last.replace(/\.git$/, "");
}

/**
 * Build the LightningFS dir path for a repo identifier.
 *
 * @param {string} repo - Short repo name (e.g. "shadow-claw")
 * @returns {string}
 */
export function repoDir(repo) {
  return `${GIT_ROOT}/${repo}`;
}

/**
 * Ensure a directory exists in LightningFS (mkdir -p).
 *
 * @param {any} pfs
 * @param {string} dir
 */
export async function ensureDir(pfs, dir) {
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
 * Clone a repository into LightningFS.
 *
 * @param {Object} opts
 * @param {string} opts.url - Remote repo URL
 * @param {string} [opts.branch] - Branch to clone (default: default branch)
 * @param {number} [opts.depth] - Shallow clone depth
 * @param {string} [opts.corsProxy] - CORS proxy URL
 * @param {string} [opts.name] - Override repo name (default: derived from url)
 *
 * @returns {Promise<string>} - The repo name used
 */
export async function gitClone({
  url,
  branch,
  depth = DEFAULT_DEPTH,
  corsProxy,
  name,
}) {
  const { git, http, fs, pfs } = await initGitFs();
  const repo = name || repoNameFromUrl(url);
  const dir = repoDir(repo);

  if (!corsProxy) {
    corsProxy = getProxyUrl("local");
  }

  await ensureDir(pfs, GIT_ROOT);
  await ensureDir(pfs, dir);

  try {
    /** @type {any} */ const cloneOpts = {
      fs,
      http,
      dir,
      url,
      singleBranch: true,
      depth,
      corsProxy,
    };

    if (branch) {
      cloneOpts.ref = branch;
    }

    await git.clone(cloneOpts);
  } catch (cloneErr) {
    // If already cloned, try fetch instead
    try {
      /** @type {any} */ const fetchOpts = {
        fs,
        http,
        dir,
        url,
        singleBranch: true,
        depth,
        corsProxy,
      };

      if (branch) {
        fetchOpts.ref = branch;
      }

      await git.fetch(fetchOpts);
    } catch (fetchErr) {
      throw new Error(
        `Failed to clone/fetch ${url}: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`,
      );
    }
  }

  return repo;
}

/**
 * Checkout a branch, tag, or commit.
 *
 * @param {Object} opts
 * @param {string} opts.repo - Repo name
 * @param {string} opts.ref - Branch, tag, or commit SHA
 *
 * @returns {Promise<string>}
 */
export async function gitCheckout({ repo, ref }) {
  const { git, fs } = await initGitFs();
  const dir = repoDir(repo);

  await git.checkout({ fs, dir, ref, force: true });

  return `Checked out ${ref} in ${repo}`;
}

/**
 * Get the status matrix for a repo.
 *
 * Returns a human-readable status string.
 *
 * @param {Object} opts
 * @param {string} opts.repo - Repo name
 *
 * @returns {Promise<string>}
 */
export async function gitStatus({ repo }) {
  const { git, fs } = await initGitFs();
  const dir = repoDir(repo);

  const matrix = await git.statusMatrix({ fs, dir });

  if (matrix.length === 0) {
    return "Empty repository.";
  }

  // Status matrix: [filepath, HEAD, WORKDIR, STAGE]
  // 0 = absent, 1 = identical to HEAD, 2 = modified
  const lines = [];

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
 *
 * @param {Object} opts
 * @param {string} opts.repo - Repo name
 * @param {string} [opts.ref] - Ref to log (default: HEAD)
 * @param {number} [opts.depth] - Number of commits to show
 *
 * @returns {Promise<string>}
 */
export async function gitLog({ repo, ref, depth = 10 }) {
  const { git, fs } = await initGitFs();
  const dir = repoDir(repo);

  const logOpts = { fs, dir, depth };
  if (ref) {
    /** @type {any} */ (logOpts).ref = ref;
  }

  const commits = await git.log(logOpts);

  if (commits.length === 0) {
    return "No commits found.";
  }

  return commits
    .map((/** @type {any} */ entry) => {
      const c = entry.commit;
      const date = new Date(c.author.timestamp * 1000).toISOString();
      return `${entry.oid.substring(0, 7)} ${date} ${c.author.name} — ${c.message.trim().split("\n")[0]}`;
    })
    .join("\n");
}

/**
 * Show a diff between two refs (or HEAD vs working tree).
 *
 * Uses git.walk with TREE comparisons.
 *
 * @param {Object} opts
 * @param {string} opts.repo - Repo name
 * @param {string} [opts.ref1] - First ref (default: HEAD)
 * @param {string} [opts.ref2] - Second ref (if omitted, diffs HEAD vs workdir)
 *
 * @returns {Promise<string>}
 */
export async function gitDiff({ repo, ref1, ref2 }) {
  const { git, fs } = await initGitFs();
  const dir = repoDir(repo);

  // Simple approach: compare statusMatrix-style for working tree changes
  if (!ref1 && !ref2) {
    // HEAD vs working directory
    const matrix = await git.statusMatrix({ fs, dir });
    const changed = matrix.filter(
      (/** @type {any[]} */ [, head, workdir]) =>
        !(head === 1 && workdir === 1),
    );

    if (changed.length === 0) {
      return "No differences.";
    }

    const lines = [];
    for (const [filepath, head, workdir] of changed) {
      if (head === 0 && workdir === 2) {
        lines.push(`+++ ${filepath} (new file)`);
      } else if (head === 1 && workdir === 0) {
        lines.push(`--- ${filepath} (deleted)`);
      } else if (head === 1 && workdir === 2) {
        lines.push(`~~~ ${filepath} (modified)`);
      } else {
        lines.push(`??? ${filepath} [${head},${workdir}]`);
      }
    }

    return lines.join("\n");
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
 * List branches.
 *
 * @param {Object} opts
 * @param {string} opts.repo - Repo name
 * @param {boolean} [opts.remote] - List remote branches
 *
 * @returns {Promise<string>}
 */
export async function gitListBranches({ repo, remote = false }) {
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
    .map((/** @type {string} */ b) => (b === current ? `* ${b}` : `  ${b}`))
    .join("\n");
}

/**
 * Get the current branch name.
 *
 * @param {Object} opts
 * @param {string} opts.repo - Repo name
 *
 * @returns {Promise<string>}
 */
export async function gitCurrentBranch({ repo }) {
  const { git, fs } = await initGitFs();
  const dir = repoDir(repo);

  const branch = await git.currentBranch({ fs, dir });
  return branch || "(detached HEAD)";
}

/**
 * Stage all changed files and commit.
 *
 * @param {Object} opts
 * @param {string} opts.repo - Repo name
 * @param {string} opts.message - Commit message
 * @param {string} [opts.authorName] - Author name (default: "ShadowClaw")
 * @param {string} [opts.authorEmail] - Author email (default: "k9@shadowclaw.local")
 *
 * @returns {Promise<string>}
 */
export async function gitCommit({
  repo,
  message,
  authorName = "ShadowClaw",
  authorEmail = "k9@shadowclaw.local",
}) {
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
 *
 * @param {Object} opts
 * @param {string} opts.repo - Repo name
 * @param {string|string[]} opts.filepath - File path or array of file paths to stage
 *
 * @returns {Promise<string>}
 */
export async function gitAdd({ repo, filepath }) {
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
 *
 * @param {Object} opts
 * @param {string} opts.repo - Repo name
 * @param {string} [opts.branch] - Branch to pull (default: current)
 * @param {string} [opts.authorName] - Author name (default: "ShadowClaw")
 * @param {string} [opts.authorEmail] - Author email (default: "k9@shadowclaw.local")
 * @param {string} [opts.token] - Auth token
 * @param {string} [opts.remote] - Remote name (default: "origin")
 * @param {string} [opts.corsProxy] - CORS proxy URL
 *
 * @returns {Promise<string>}
 */
export async function gitPull({
  repo,
  branch,
  authorName = "ShadowClaw",
  authorEmail = "k9@shadowclaw.local",
  token,
  remote = "origin",
  corsProxy,
}) {
  const { git, http, fs } = await initGitFs();
  const dir = repoDir(repo);

  const ref = branch || (await git.currentBranch({ fs, dir }));

  if (!ref) {
    throw new Error("No branch to pull — HEAD is detached.");
  }

  const pullOpts = {
    fs,
    http,
    dir,
    ref,
    remote,
    singleBranch: true,
    author: { name: authorName, email: authorEmail },
    corsProxy: corsProxy || getProxyUrl("local"),
    onAuth: token
      ? () => ({ username: token, password: "x-oauth-basic" })
      : undefined,
  };

  await git.pull(pullOpts);

  return `Pulled latest changes for ${ref} from ${remote} successfully.`;
}

/**
 * Push to a remote.
 *
 * @param {Object} opts
 * @param {string} opts.repo - Repo name
 * @param {string} [opts.branch] - Branch to push (default: current)
 * @param {string} [opts.token] - Auth token (GitHub PAT)
 * @param {string} [opts.remote] - Remote name (default: "origin")
 * @param {string} [opts.corsProxy] - CORS proxy URL
 * @param {boolean} [opts.force] - Force push (default: false)
 *
 * @returns {Promise<string>}
 */
export async function gitPush({
  repo,
  branch,
  token,
  remote = "origin",
  corsProxy,
  force = false,
}) {
  const { git, http, fs } = await initGitFs();
  const dir = repoDir(repo);

  const ref = branch || (await git.currentBranch({ fs, dir }));

  if (!ref) {
    throw new Error("No branch to push — HEAD is detached.");
  }

  const pushOpts = {
    fs,
    http,
    dir,
    ref,
    remote,
    force,
    corsProxy: corsProxy || getProxyUrl("local"),
    onAuth: token
      ? () => ({ username: token, password: "x-oauth-basic" })
      : undefined,
  };

  const result = await git.push(pushOpts);

  if (result.ok) {
    return `Pushed ${ref} to ${remote} successfully.`;
  }

  return `Push result: ${JSON.stringify(result.refs || result)}`;
}

/**
 * List all cloned repos in the /git directory.
 *
 * @returns {Promise<string>}
 */
export async function gitListRepos() {
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
