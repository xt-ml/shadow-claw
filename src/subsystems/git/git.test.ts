import { jest } from "@jest/globals";

const mockPfs: any = {
  mkdir: jest.fn<any>().mockResolvedValue(undefined),
  readdir: jest.fn<any>().mockResolvedValue([]),
  readFile: jest.fn<any>().mockResolvedValue(""),
  rmdir: jest.fn<any>().mockResolvedValue(undefined),
  stat: jest.fn<any>().mockResolvedValue({ isDirectory: () => false }),
  unlink: jest.fn<any>().mockResolvedValue(undefined),
  writeFile: jest.fn<any>().mockResolvedValue(undefined),
};

// Mock navigator.storage.getDirectory() to return a fake directory handle that
// ultimately hands back mockPfs via the makeDirHandleFs factory in git.ts.
const mockDirHandle: any = {
  entries: jest.fn<any>().mockReturnValue((async function* () {})()),
  getDirectoryHandle: jest
    .fn<any>()
    .mockImplementation(() => Promise.resolve(mockDirHandle)),
  getFileHandle: jest.fn<any>().mockResolvedValue({
    createWritable: jest
      .fn<any>()
      .mockResolvedValue({ write: jest.fn(), close: jest.fn() }),
    getFile: jest.fn<any>().mockResolvedValue({
      size: 0,
      lastModified: 0,
      arrayBuffer: async () => new ArrayBuffer(0),
    }),
    kind: "file",
  }),
  kind: "directory",
  name: "workspace-root",
  removeEntry: jest.fn<any>().mockResolvedValue(undefined),
};

const mockGit: any = {
  add: jest.fn(),
  branch: jest.fn(),
  checkout: jest.fn(),
  clone: jest.fn(),
  commit: jest.fn(),
  currentBranch: jest.fn(),
  fetch: jest.fn(),
  listBranches: jest.fn(),
  log: jest.fn(),
  merge: jest.fn(),
  pull: jest.fn(),
  push: jest.fn(),
  remove: jest.fn(),
  resolveRef: jest.fn(),
  statusMatrix: jest.fn(),
  TREE: jest.fn(() => ({ type: "tree" })),
  walk: jest.fn<any>().mockResolvedValue([]),
  getConfig: jest.fn(),
  setConfig: jest.fn(),
  readBlob: jest.fn(),
  readCommit: jest.fn(),
  deleteBranch: jest.fn(),
  init: jest.fn(),
  annotatedTag: jest.fn(),
  tag: jest.fn(),
  listTags: jest.fn(),
  listRemotes: jest.fn(),
  addRemote: jest.fn(),
  deleteRemote: jest.fn(),
};

// Patch navigator.storage before the module is imported.
Object.defineProperty(globalThis.navigator, "storage", {
  configurable: true,
  value: {
    getDirectory: jest.fn<any>().mockResolvedValue(mockDirHandle),
  },
  writable: true,
});

jest.unstable_mockModule("isomorphic-git", () => ({
  default: mockGit,
}));

jest.unstable_mockModule("@zip.js/zip.js", () => ({}) as any);

describe("git", () => {
  let buildAuthCallbacks: Function;
  let ensureDir: Function;
  let getProxyUrl: Function;
  let gitAdd: Function;
  let gitBranch: Function;
  let gitCheckout: Function;
  let gitClone: Function;
  let gitCommit: Function;
  let gitCurrentBranch: Function;
  let gitDeleteRepo: Function;
  let gitDiff: Function;
  let gitFetch: Function;
  let gitReadFileAtRef: Function;
  let gitShow: Function;
  let gitDeleteBranch: Function;
  let gitInit: Function;
  let gitTag: Function;
  let gitListTags: Function;
  let gitRemote: Function;
  let getRemoteUrl: Function;
  let gitConfig: Function;
  let gitUnstage: Function;
  let gitListBranches: Function;
  let gitListRepos: Function;
  let gitLog: Function;
  let gitMerge: Function;
  let gitPull: Function;
  let gitPush: Function;
  let gitReset: Function;
  let gitStatus: Function;
  let initGitFs: Function;
  let makeDirHandleFs: Function;
  let repoDir: Function;
  let repoNameFromUrl: Function;
  let rmdirRecursive: Function;

  // Inject the same mockPfs the tests exercise — patch the internal _pfs reference
  // by calling initGitFs() and then overwriting its promises object.
  beforeAll(async () => {
    const mod = await import("./git.js");

    buildAuthCallbacks = mod.buildAuthCallbacks;
    ensureDir = mod.ensureDir;
    getProxyUrl = mod.getProxyUrl;
    gitAdd = mod.gitAdd;
    gitBranch = mod.gitBranch;
    gitCheckout = mod.gitCheckout;
    gitClone = mod.gitClone;
    gitCommit = mod.gitCommit;
    gitCurrentBranch = mod.gitCurrentBranch;
    gitDeleteRepo = mod.gitDeleteRepo;
    gitDiff = mod.gitDiff;
    gitFetch = mod.gitFetch;
    gitReadFileAtRef = mod.gitReadFileAtRef;
    gitShow = mod.gitShow;
    gitDeleteBranch = mod.gitDeleteBranch;
    gitInit = mod.gitInit;
    gitTag = mod.gitTag;
    gitListTags = mod.gitListTags;
    gitRemote = mod.gitRemote;
    getRemoteUrl = mod.getRemoteUrl;
    gitConfig = mod.gitConfig;
    gitUnstage = mod.gitUnstage;
    gitListBranches = mod.gitListBranches;
    gitListRepos = mod.gitListRepos;
    gitLog = mod.gitLog;
    gitMerge = mod.gitMerge;
    gitPull = mod.gitPull;
    gitPush = mod.gitPush;
    gitReset = mod.gitReset;
    gitStatus = mod.gitStatus;
    initGitFs = mod.initGitFs;
    makeDirHandleFs = mod.makeDirHandleFs;
    repoDir = mod.repoDir;
    repoNameFromUrl = mod.repoNameFromUrl;
    rmdirRecursive = mod.rmdirRecursive;

    const { pfs } = await initGitFs();

    // Replace each method on the live pfs object with mock fns so tests can spy.
    Object.assign(pfs, mockPfs);
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    // Reset default mock behaviors
    mockGit.clone.mockResolvedValue(undefined);
    mockGit.fetch.mockResolvedValue(undefined);
    mockPfs.readdir.mockResolvedValue([]);
    mockPfs.stat.mockResolvedValue({ isDirectory: () => false });

    (globalThis as any).git = mockGit;

    globalThis.Buffer = globalThis.Buffer || Uint8Array;
  });

  describe("buildAuthCallbacks", () => {
    const password = "pass";
    const username = "user";

    it("returns proactive Authorization header for token", () => {
      const result = buildAuthCallbacks({ token: "fake" });

      expect(result.headers).toEqual({
        Authorization: `Basic ${btoa("fake:x-oauth-basic")}`,
      });
    });

    it("returns proactive Authorization header for username/password", () => {
      const result = buildAuthCallbacks({
        password,
        username,
      });

      expect(result.headers).toEqual({
        Authorization: `Basic ${btoa("user:pass")}`,
      });
    });

    it("returns token-based onAuth when token is provided", () => {
      const { onAuth }: any = buildAuthCallbacks({ token: "fake" });

      expect(onAuth!()).toEqual({
        password: "x-oauth-basic",
        username: "fake",
      });
    });

    it("returns username/password onAuth when provided", () => {
      const { onAuth }: any = buildAuthCallbacks({
        password,
        username,
      });

      expect(onAuth!()).toEqual({ password, username });
    });

    it("prefers token over username/password", () => {
      const result: any = buildAuthCallbacks({
        password,
        token: "fake",
        username,
      });

      expect(result.onAuth!()).toEqual({
        password: "x-oauth-basic",
        username: "fake",
      });

      expect(result.headers).toEqual({
        Authorization: `Basic ${btoa("fake:x-oauth-basic")}`,
      });
    });

    it("returns no onAuth/onAuthFailure when no credentials provided", () => {
      const result: any = buildAuthCallbacks({} as any);

      expect(result.onAuth).toBeUndefined();
      expect(result.onAuthFailure).toBeUndefined();
      expect(result.headers).toBeUndefined();
    });

    it("returns empty object when called with no args", () => {
      const result = buildAuthCallbacks();

      expect(result.onAuth).toBeUndefined();
      expect(result.onAuthFailure).toBeUndefined();
    });

    it("omits headers when no credentials provided", () => {
      const result = buildAuthCallbacks();

      expect(result.headers).toBeUndefined();
    });

    it("onAuthFailure always cancels", () => {
      const { onAuthFailure }: any = buildAuthCallbacks({
        token: "fake",
      });

      expect(onAuthFailure()).toEqual({ cancel: true });
    });

    it("handles username with empty password", () => {
      const result: any = buildAuthCallbacks({ username });

      expect(result.onAuth()).toEqual({ username, password: "" });
      expect(result.headers).toEqual({
        Authorization: `Basic ${btoa("user:")}`,
      });
    });
  });

  describe("repoNameFromUrl", () => {
    it("extracts name from GitHub URL", () => {
      expect(repoNameFromUrl("https://github.com/user/my-repo")).toBe(
        "my-repo",
      );
    });

    it("strips .git suffix", () => {
      expect(repoNameFromUrl("https://github.com/user/my-repo.git")).toBe(
        "my-repo",
      );
    });

    it("handles trailing slashes", () => {
      expect(repoNameFromUrl("https://github.com/user/my-repo/")).toBe(
        "my-repo",
      );
    });

    it("returns 'repo' for empty URL", () => {
      expect(repoNameFromUrl("")).toBe("repo");
    });
  });

  describe("initGitFs", () => {
    it("returns fs and pfs objects", async () => {
      const result = await initGitFs();

      expect(result.fs).toBeDefined();
      expect(result.pfs).toBeDefined();
    });

    it("is idempotent", async () => {
      const first = await initGitFs();
      const second = await initGitFs();

      expect(first.fs).toBe(second.fs);
    });
  });

  describe("gitClone", () => {
    it("clones a repository", async () => {
      const repo = await gitClone({
        url: "https://github.com/user/my-repo",
      });

      expect(repo).toBe("my-repo");
      expect(mockGit.clone).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://github.com/user/my-repo",
          singleBranch: true,
        }),
      );
    });

    it("falls back to fetch if clone fails", async () => {
      mockGit.clone.mockRejectedValue(new Error("already exists"));

      const repo = await gitClone({
        url: "https://github.com/user/my-repo",
      });

      expect(repo).toBe("my-repo");
      expect(mockGit.fetch).toHaveBeenCalled();
    });

    it("throws if both clone and fetch fail", async () => {
      mockGit.clone.mockRejectedValue(new Error("fail1"));
      mockGit.fetch.mockRejectedValue(new Error("fail2"));

      await expect(
        gitClone({ url: "https://github.com/user/my-repo" }),
      ).rejects.toThrow("Failed to clone/fetch");
    });

    it("uses custom repo name", async () => {
      const repo = await gitClone({
        url: "https://github.com/user/my-repo",
        name: "custom-name",
      });

      expect(repo).toBe("custom-name");
    });
  });

  describe("gitCheckout", () => {
    it("checks out a ref", async () => {
      const result = await gitCheckout({ repo: "my-repo", ref: "main" });

      expect(result).toContain("Checked out main");
      expect(mockGit.checkout).toHaveBeenCalledWith(
        expect.objectContaining({ ref: "main", force: true }),
      );
    });
  });

  describe("gitBranch", () => {
    it("creates a new branch", async () => {
      const result = await gitBranch({ repo: "my-repo", name: "feature" });

      expect(result).toContain("Created branch feature");
      expect(mockGit.branch).toHaveBeenCalledWith(
        expect.objectContaining({ ref: "feature" }),
      );

      expect(mockGit.checkout).not.toHaveBeenCalled();
    });

    it("creates and checks out when checkout is true", async () => {
      const result = await gitBranch({
        repo: "my-repo",
        name: "feature",
        checkout: true,
      });

      expect(result).toContain("Created and switched to branch feature");
      expect(mockGit.branch).toHaveBeenCalledWith(
        expect.objectContaining({ ref: "feature" }),
      );

      expect(mockGit.checkout).toHaveBeenCalledWith(
        expect.objectContaining({ ref: "feature" }),
      );
    });

    it("branches from a start point", async () => {
      await gitBranch({
        repo: "my-repo",
        name: "hotfix",
        startPoint: "v1.0",
      });

      expect(mockGit.branch).toHaveBeenCalledWith(
        expect.objectContaining({ ref: "hotfix", object: "v1.0" }),
      );
    });
  });

  describe("gitStatus", () => {
    it("reports clean tree", async () => {
      mockGit.statusMatrix.mockResolvedValue([["file.txt", 1, 1, 1]]);
      mockGit.currentBranch.mockResolvedValue("main");

      const result = await gitStatus({ repo: "my-repo" });

      expect(result).toContain("Nothing to commit");
    });

    it("reports modified files", async () => {
      mockGit.statusMatrix.mockResolvedValue([["changed.txt", 1, 2, 1]]);
      mockGit.currentBranch.mockResolvedValue("main");

      const result = await gitStatus({ repo: "my-repo" });

      expect(result).toContain("modified: changed.txt");
    });

    it("reports empty repository", async () => {
      mockGit.statusMatrix.mockResolvedValue([]);

      const result = await gitStatus({ repo: "my-repo" });

      expect(result).toBe("Empty repository.");
    });
  });

  describe("gitLog", () => {
    it("returns formatted log", async () => {
      mockGit.log.mockResolvedValue([
        {
          oid: "abc1234567890",
          commit: {
            message: "Initial commit\n\nBody",
            author: { name: "Test User", timestamp: 1700000000 },
          },
        },
      ]);

      const result = await gitLog({ repo: "my-repo" });

      expect(result).toContain("abc1234567890");
      expect(result).toContain("Test User");
      expect(result).toContain("Initial commit");
    });

    it("handles no commits", async () => {
      mockGit.log.mockResolvedValue([]);

      const result = await gitLog({ repo: "my-repo" });

      expect(result).toBe("No commits found.");
    });
  });

  describe("gitDiff", () => {
    it("reports no differences for clean tree", async () => {
      mockGit.statusMatrix.mockResolvedValue([["file.txt", 1, 1, 1]]);

      const result = await gitDiff({ repo: "my-repo" });

      expect(result).toBe("No differences.");
    });

    it("shows content diff for modified files", async () => {
      mockGit.statusMatrix.mockResolvedValue([["src/app.js", 1, 2, 1]]);
      mockGit.resolveRef.mockResolvedValue("abc123");
      mockGit.readBlob = (jest.fn() as any).mockResolvedValue({
        blob: Buffer.from("line one\nline two\n"),
      });

      mockPfs.readFile.mockResolvedValue(
        Buffer.from("line one\nline TWO\nline three\n"),
      );

      const result = await gitDiff({ repo: "my-repo" });

      expect(result).toContain("src/app.js");
      expect(result).toContain("-line two");
      expect(result).toContain("+line TWO");
      expect(result).toContain("+line three");
    });

    it("shows full content for new files", async () => {
      mockGit.statusMatrix.mockResolvedValue([["new.txt", 0, 2, 0]]);
      mockPfs.readFile.mockResolvedValue(Buffer.from("hello world\n"));

      const result = await gitDiff({ repo: "my-repo" });

      expect(result).toContain("new.txt");
      expect(result).toContain("+hello world");
    });

    it("shows removed content for deleted files", async () => {
      mockGit.statusMatrix.mockResolvedValue([["old.txt", 1, 0, 0]]);
      mockGit.resolveRef.mockResolvedValue("abc123");

      mockGit.readBlob = (jest.fn() as any).mockResolvedValue({
        blob: Buffer.from("goodbye\n"),
      });

      const result = await gitDiff({ repo: "my-repo" });

      expect(result).toContain("old.txt");
      expect(result).toContain("-goodbye");
    });

    it("falls back to summary when blob read fails", async () => {
      mockGit.statusMatrix.mockResolvedValue([["binary.bin", 1, 2, 1]]);
      mockGit.resolveRef.mockResolvedValue("abc123");

      mockGit.readBlob = (jest.fn() as any).mockRejectedValue(
        new Error("bad blob"),
      );

      mockPfs.readFile.mockRejectedValue(new Error("read error"));

      const result = await gitDiff({ repo: "my-repo" });

      expect(result).toContain("binary.bin");
      expect(result).toContain("modified");
    });

    it("compares two refs", async () => {
      mockGit.resolveRef
        .mockResolvedValueOnce("aaa1111")
        .mockResolvedValueOnce("bbb2222");

      const result = await gitDiff({
        repo: "my-repo",
        ref1: "main",
        ref2: "dev",
      });

      expect(result).toContain("Comparing main");
    });
  });

  describe("gitListBranches", () => {
    it("lists branches with current marked", async () => {
      mockGit.listBranches.mockResolvedValue(["main", "dev"]);
      mockGit.currentBranch.mockResolvedValue("main");

      const result = await gitListBranches({ repo: "my-repo" });

      expect(result).toContain("* main");
      expect(result).toContain("  dev");
    });

    it("handles no branches", async () => {
      mockGit.listBranches.mockResolvedValue([]);

      const result = await gitListBranches({ repo: "my-repo" });

      expect(result).toBe("No branches found.");
    });
  });

  describe("gitCurrentBranch", () => {
    it("returns current branch", async () => {
      mockGit.currentBranch.mockResolvedValue("main");

      const result = await gitCurrentBranch({ repo: "my-repo" });

      expect(result).toBe("main");
    });

    it("handles detached HEAD", async () => {
      mockGit.currentBranch.mockResolvedValue(null);

      const result = await gitCurrentBranch({ repo: "my-repo" });

      expect(result).toBe("(detached HEAD)");
    });
  });

  describe("gitCommit", () => {
    it("stages changes and commits", async () => {
      mockGit.statusMatrix.mockResolvedValue([
        // modified, unstaged
        ["file.txt", 1, 2, 1],
      ]);

      mockGit.commit.mockResolvedValue("abc1234567890");

      const result = await gitCommit({
        message: "test commit",
        repo: "my-repo",
      });

      expect(mockGit.add).toHaveBeenCalledWith(
        expect.objectContaining({ filepath: "file.txt" }),
      );

      expect(mockGit.commit).toHaveBeenCalledWith(
        expect.objectContaining({
          author: expect.objectContaining({ name: "ShadowClaw" }),
          message: "test commit",
        }),
      );

      expect(result).toContain("Committed abc1234");
    });

    it("handles root directory entries from statusMatrix", async () => {
      mockGit.statusMatrix.mockResolvedValue([
        [".", 0, 2, 0], // root entry for a new/staged repo root
      ]);

      mockGit.commit.mockResolvedValue("abc1234567890");

      const result = await gitCommit({
        message: "root commit",
        repo: "my-repo",
      });

      expect(mockGit.add).toHaveBeenCalledWith(
        expect.objectContaining({ filepath: "." }),
      );

      expect(mockGit.commit).toHaveBeenCalled();

      expect(result).toContain("Committed abc1234");
    });

    it("handles removed files", async () => {
      mockGit.statusMatrix.mockResolvedValue([
        // deleted
        ["deleted.txt", 1, 0, 1],
      ]);

      mockGit.commit.mockResolvedValue("def5678901234");

      await gitCommit({ repo: "my-repo", message: "remove file" });

      expect(mockGit.remove).toHaveBeenCalledWith(
        expect.objectContaining({ filepath: "deleted.txt" }),
      );
    });
  });

  describe("gitPush", () => {
    it("pushes with token auth", async () => {
      mockGit.currentBranch.mockResolvedValue("main");
      mockGit.push.mockResolvedValue({ ok: true });

      const result = await gitPush({
        token: "fake",
        repo: "my-repo",
      });

      expect(result).toContain("Pushed main to origin/main successfully");
      expect(mockGit.push).toHaveBeenCalledWith(
        expect.objectContaining({
          ref: "main",
          remote: "origin",
        }),
      );
    });

    it("throws on detached HEAD with no branch", async () => {
      mockGit.currentBranch.mockResolvedValue(null);

      await expect(
        gitPush({ repo: "my-repo", token: "ghp_test" }),
      ).rejects.toThrow("No branch to push");
    });

    it("pushes to a different remote ref when remoteRef is set", async () => {
      mockGit.currentBranch.mockResolvedValue("feature-rebased");
      mockGit.push.mockResolvedValue({ ok: true });

      const result = await gitPush({
        repo: "my-repo",
        token: "fake",
        remoteRef: "feature/original",
      });

      expect(result).toContain(
        "Pushed feature-rebased to origin/feature/original successfully",
      );

      expect(mockGit.push).toHaveBeenCalledWith(
        expect.objectContaining({
          ref: "feature-rebased",
          remoteRef: "feature/original",
        }),
      );
    });
  });

  describe("gitListRepos", () => {
    it("lists repos that contain a .git directory", async () => {
      mockPfs.readdir.mockResolvedValue(["repo-a", "repo-b", "not-a-repo"]);
      mockPfs.stat.mockImplementation(async (path: string) => {
        if (path === "repos/repo-a/.git" || path === "repos/repo-b/.git") {
          return { isDirectory: () => true };
        }

        throw new Error("ENOENT");
      });

      const result = await gitListRepos();

      expect(result).toContain("repo-a");
      expect(result).toContain("repo-b");
      expect(result).not.toContain("not-a-repo");
    });

    it("handles no repos", async () => {
      mockPfs.readdir.mockRejectedValue(new Error("ENOENT"));

      const result = await gitListRepos();

      expect(result).toBe("No repos cloned.");
    });
  });

  describe("getProxyUrl", () => {
    it("returns public CORS proxy when preference is public", () => {
      const url = getProxyUrl("public");

      expect(url).toBe("https://www.cors-anywhere.com");
    });

    it("returns local proxy URL for local preference", () => {
      const url = getProxyUrl("local");

      expect(url).toContain("git-proxy");
    });
  });

  describe("repoDir", () => {
    it("returns repo directory path", () => {
      expect(repoDir("my-repo")).toBe("repos/my-repo");
      expect(repoDir("another-repo")).toBe("repos/another-repo");
    });
  });

  describe("ensureDir", () => {
    it("creates directory if it does not exist", async () => {
      mockPfs.mkdir.mockResolvedValue(undefined);

      await ensureDir(mockPfs, "/test-dir");

      expect(mockPfs.mkdir).toHaveBeenCalledWith("/test-dir");
    });

    it("does not throw if directory already exists", async () => {
      mockPfs.mkdir.mockRejectedValue(new Error("EEXIST"));

      await expect(ensureDir(mockPfs, "/test-dir")).resolves.not.toThrow();
    });
  });

  describe("gitAdd", () => {
    it("adds a file to staging", async () => {
      const result = await gitAdd({
        filepath: "file.txt",
        repo: "my-repo",
      });

      expect(result).toContain("file.txt");
      expect(result).toContain("my-repo");
      expect(mockGit.add).toHaveBeenCalledWith(
        expect.objectContaining({
          filepath: "file.txt",
        }),
      );
    });

    it("normalizes leading ./ paths before staging", async () => {
      await gitAdd({ repo: "my-repo", filepath: "./file.txt" });

      expect(mockGit.add).toHaveBeenCalledWith(
        expect.objectContaining({
          filepath: "file.txt",
        }),
      );
    });

    it("stages the entire repo when filepath is omitted", async () => {
      mockGit.statusMatrix.mockResolvedValue([
        ["file.txt", 1, 1, 1],
        ["bin/build.mjs", 1, 1, 1],
        ["new-file.txt", 0, 1, 0],
        ["modified.txt", 1, 1, 0],
      ]);

      const result = await gitAdd({ repo: "my-repo" });

      expect(result).toContain("my-repo");
      expect(mockGit.add).toHaveBeenCalledTimes(2);
      expect(mockGit.add).toHaveBeenCalledWith(
        expect.objectContaining({ filepath: "new-file.txt" }),
      );

      expect(mockGit.add).toHaveBeenCalledWith(
        expect.objectContaining({ filepath: "modified.txt" }),
      );
    });

    it("uses '.' as repo root when omitted for commit and add flows", async () => {
      mockGit.statusMatrix.mockResolvedValue([
        ["file.txt", 1, 1, 1],
        ["bin/build.mjs", 1, 1, 1],
        ["new-file.txt", 0, 1, 0],
      ]);

      const result = await gitAdd({ repo: "my-repo" });

      expect(result).toContain("my-repo");
      expect(mockGit.add).toHaveBeenCalledTimes(1);
      expect(mockGit.add).toHaveBeenCalledWith(
        expect.objectContaining({ filepath: "new-file.txt" }),
      );
    });
  });

  describe("makeDirHandleFs", () => {
    it("returns stats objects with isSymbolicLink support", async () => {
      const fs = makeDirHandleFs(mockDirHandle);
      const stats = await fs.promises.stat("file.txt");

      expect(stats.isSymbolicLink()).toBe(false);
    });

    it("tracks exectuable mode from writeFile options", async () => {
      const { TextEncoder: TE, TextDecoder: TD } = await import("node:util");

      (globalThis as any).TextEncoder ??= TE;
      (globalThis as any).TextDecoder ??= TD;

      const files = new Map<
        string,
        { data: Uint8Array; lastModified: number }
      >();

      const dirs = new Set<string>(["."]);

      function makeMockDirHandle(prefix: string): any {
        return {
          entries() {
            return (async function* () {})();
          },
          kind: "directory",
          getDirectoryHandle(name: string, opts?: any) {
            const path = prefix ? `${prefix}/${name}` : name;
            if (!dirs.has(path) && !opts?.create) {
              return Promise.reject(
                Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
              );
            }

            dirs.add(path);

            return Promise.resolve(makeMockDirHandle(path));
          },
          getFileHandle(name: string, opts?: any) {
            const path = prefix ? `${prefix}/${name}` : name;
            if (!files.has(path) && !opts?.create) {
              return Promise.reject(
                Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
              );
            }

            if (opts?.create && !files.has(path)) {
              files.set(path, {
                data: new Uint8Array(0),
                lastModified: Date.now(),
              });
            }

            return Promise.resolve({
              createWritable() {
                let buf = new Uint8Array(0);

                return Promise.resolve({
                  write(chunk: Uint8Array | string) {
                    if (typeof chunk === "string") {
                      buf = new TextEncoder().encode(chunk);
                    } else {
                      buf = new Uint8Array(chunk);
                    }
                  },
                  close() {
                    files.set(path, { data: buf, lastModified: Date.now() });
                  },
                });
              },
              getFile() {
                const f = files.get(path)!;

                return Promise.resolve({
                  arrayBuffer: async () => f.data.buffer,
                  lastModified: f.lastModified,
                  size: f.data.byteLength,
                  text: async () => new TextDecoder().decode(f.data),
                });
              },
              kind: "file",
            });
          },
          name: prefix || "root",
          removeEntry: jest.fn<any>().mockResolvedValue(undefined),
        };
      }

      const root = makeMockDirHandle("");
      const fs = makeDirHandleFs(root);

      await fs.promises.writeFile("repos/my-repo/README.md", "hello");
      const readmeStats = await fs.promises.stat("repos/my-repo/README.md");
      expect(readmeStats.mode).toBe(0o100644);

      await fs.promises.writeFile(
        "repos/my-repo/bin/build.mjs",
        "#!/usr/bin/env node",
        { mode: 0o777 } as any,
      );

      const buildStats = await fs.promises.stat("repos/my-repo/bin/build.mjs");
      expect(buildStats.mode).toBe(0o100755);

      await fs.promises.writeFile(
        "repos/my-repo/bin/build.mjs",
        "#!/usr/bin/env node\console.log('v2')",
      );

      const buildStats2 = await fs.promises.stat("repos/my-repo/bin/build.mjs");
      expect(buildStats2.mode).toBe(0o100755);

      await fs.promises.writeFile("repos/my-repo/src/index.ts", "expoert {}");
      const indexStats = await fs.promises.stat("repos/my-repo/src/index.ts");
      expect(indexStats.mode).toBe(0o100644);
    });
  });

  describe("gitPull", () => {
    it("pulls changes from remote", async () => {
      mockGit.currentBranch.mockResolvedValue("main");
      mockGit.pull.mockResolvedValue(undefined);

      const result = await gitPull({
        repo: "my-repo",
        token: "fake",
      });

      expect(result).toContain("Pulled latest changes");
      expect(mockGit.pull).toHaveBeenCalled();
    });

    it("throws on detached HEAD", async () => {
      mockGit.currentBranch.mockResolvedValue(null);

      await expect(
        gitPull({ repo: "my-repo", token: "ghp_test" }),
      ).rejects.toThrow("No branch to pull");
    });

    it("uses custom branch", async () => {
      mockGit.currentBranch.mockResolvedValue("dev");
      mockGit.pull.mockResolvedValue(undefined);

      const result = await gitPull({
        repo: "my-repo",
        token: "fake",
        branch: "dev",
      });

      expect(result).toContain("dev");
    });
  });

  describe("gitMerge", () => {
    it("performs a merge and returns result", async () => {
      mockGit.currentBranch.mockResolvedValue("main");
      mockGit.merge.mockResolvedValue({
        alreadyMerged: false,
        fastForward: false,
        oid: "abc1234567890",
      });

      const result = await gitMerge({
        repo: "my-repo",
        theirs: "feature/branch",
      });

      expect(result).toContain("Merged feature/branch into main");
      expect(mockGit.merge).toHaveBeenCalledWith(
        expect.objectContaining({
          ours: "main",
          theirs: "feature/branch",
        }),
      );
    });

    it("reports fast-forward merge", async () => {
      mockGit.currentBranch.mockResolvedValue("main");
      mockGit.merge.mockResolvedValue({
        alreadyMerged: false,
        fastForward: true,
        oid: "def5678901234",
      });

      const result = await gitMerge({
        repo: "my-repo",
        theirs: "feature/branch",
      });

      expect(result).toContain("Fast-forward merge");
    });

    it("reports already merged", async () => {
      mockGit.currentBranch.mockResolvedValue("main");
      mockGit.merge.mockResolvedValue({ alreadyMerged: true });

      const result = await gitMerge({
        repo: "my-repo",
        theirs: "feature/branch",
      });

      expect(result).toContain("Already up to date");
    });

    it("throws on detached HEAD", async () => {
      mockGit.currentBranch.mockResolvedValue(null);

      await expect(
        gitMerge({ repo: "my-repo", theirs: "feature" }),
      ).rejects.toThrow("Cannot merge");
    });

    it("passes abortOnConflict: false to git.merge", async () => {
      mockGit.currentBranch.mockResolvedValue("main");
      mockGit.merge.mockResolvedValue({
        alreadyMerged: false,
        fastForward: false,
        oid: "abc1234567890",
      });

      await gitMerge({ repo: "my-repo", theirs: "feature/branch" });

      expect(mockGit.merge).toHaveBeenCalledWith(
        expect.objectContaining({ abortOnConflict: false }),
      );
    });

    it("rethrows conflict error with file list from e.data", async () => {
      const conflictErr: any = new Error("MergeConflictError");
      conflictErr.code = "MergeConflictError";

      conflictErr.data = { filepaths: ["src/a.js", "src/b.js"] };
      mockGit.merge.mockRejectedValue(conflictErr);
      mockGit.currentBranch.mockResolvedValue("main");

      await expect(
        gitMerge({ repo: "my-repo", theirs: "feature" }),
      ).rejects.toThrow(/conflict/i);
    });
  });

  describe("gitReset", () => {
    it("resets branch to target ref", async () => {
      mockGit.currentBranch.mockResolvedValue("feature");
      mockGit.resolveRef.mockResolvedValue(
        "abc1234567890abcdef1234567890abcdef123456",
      );

      mockPfs.writeFile.mockResolvedValue(undefined);

      const result = await gitReset({
        repo: "my-repo",
        ref: "main",
      });

      expect(result).toContain("Reset feature to main");
      expect(mockGit.resolveRef).toHaveBeenCalledWith(
        expect.objectContaining({ ref: "main" }),
      );

      expect(mockPfs.writeFile).toHaveBeenCalledWith(
        "repos/my-repo/.git/refs/heads/feature",
        expect.stringContaining("abc1234567890abcdef1234567890abcdef123456"),
        "utf8",
      );

      expect(mockGit.checkout).toHaveBeenCalledWith(
        expect.objectContaining({ ref: "feature", force: true }),
      );
    });

    it("throws on detached HEAD", async () => {
      mockGit.currentBranch.mockResolvedValue(null);

      await expect(gitReset({ repo: "my-repo", ref: "main" })).rejects.toThrow(
        "Cannot reset",
      );
    });
  });

  describe("rmdirRecursive", () => {
    it("removes a flat directory of files", async () => {
      mockPfs.readdir.mockResolvedValue(["a.txt", "b.txt"]);
      mockPfs.stat.mockResolvedValue({ isDirectory: () => false });
      mockPfs.unlink.mockResolvedValue(undefined);
      mockPfs.rmdir
        .mockRejectedValueOnce(new Error("ENOTEMPTY"))
        .mockResolvedValue(undefined);

      await rmdirRecursive(mockPfs, "repos/my-repo");

      expect(mockPfs.unlink).toHaveBeenCalledWith("repos/my-repo/a.txt");
      expect(mockPfs.unlink).toHaveBeenCalledWith("repos/my-repo/b.txt");
      expect(mockPfs.rmdir).toHaveBeenCalledWith("repos/my-repo");
    });

    it("recurses into subdirectories", async () => {
      mockPfs.readdir
        .mockResolvedValueOnce(["sub"])
        .mockResolvedValueOnce(["file.txt"]);

      mockPfs.stat
        .mockResolvedValueOnce({ isDirectory: () => true })
        .mockResolvedValueOnce({ isDirectory: () => false });

      mockPfs.unlink.mockResolvedValue(undefined);
      mockPfs.rmdir
        .mockRejectedValueOnce(new Error("ENOTEMPTY")) // my-repo
        .mockRejectedValueOnce(new Error("ENOTEMPTY")) // my-repo/sub
        .mockResolvedValue(undefined);

      await rmdirRecursive(mockPfs, "repos/my-repo");

      expect(mockPfs.unlink).toHaveBeenCalledWith("repos/my-repo/sub/file.txt");
      expect(mockPfs.rmdir).toHaveBeenCalledWith("repos/my-repo/sub");
      expect(mockPfs.rmdir).toHaveBeenCalledWith("repos/my-repo");
    });

    it("handles empty directory", async () => {
      mockPfs.readdir.mockResolvedValue([]);
      mockPfs.rmdir.mockResolvedValue(undefined);

      await rmdirRecursive(mockPfs, "repos/empty");

      expect(mockPfs.rmdir).toHaveBeenCalledWith("repos/empty");
      expect(mockPfs.unlink).not.toHaveBeenCalled();
    });
  });

  describe("gitDeleteRepo", () => {
    it("deletes only the .git metadata directory and leaves the working tree intact", async () => {
      mockPfs.readdir.mockResolvedValue([]);
      mockPfs.rmdir.mockResolvedValue(undefined);

      const result = await gitDeleteRepo({ repo: "my-repo" });

      expect(result).toContain("Deleted git metadata");
      expect(result).toContain("repos/my-repo");
      expect(mockPfs.rmdir).toHaveBeenCalledWith("repos/my-repo/.git");
    });

    it("throws if repo name is empty", async () => {
      await expect(gitDeleteRepo({ repo: "" })).rejects.toThrow(
        "repo name is required",
      );
    });

    it("throws if repo name contains path traversal", async () => {
      await expect(gitDeleteRepo({ repo: "../etc" })).rejects.toThrow(
        "Invalid repo name",
      );
    });

    it("returns message when repo does not exist", async () => {
      mockPfs.readdir.mockRejectedValueOnce(new Error("ENOENT"));

      const result = await gitDeleteRepo({ repo: "nonexistent" });

      expect(result).toContain("not found");
    });
  });

  describe("gitClone auto-clean on stale state", () => {
    it("auto-wipes and retries when clone+fetch both fail", async () => {
      mockGit.clone
        .mockRejectedValueOnce(new Error("Could not find HEAD"))
        .mockResolvedValueOnce(undefined);

      mockGit.fetch.mockRejectedValueOnce(
        new Error("Could not find a fetch refspec"),
      );

      mockPfs.readdir.mockResolvedValue([]);
      mockPfs.rmdir.mockResolvedValue(undefined);

      const repo = await gitClone({
        url: "https://github.com/user/my-repo",
      });

      expect(repo).toBe("my-repo");
      expect(mockGit.clone).toHaveBeenCalledTimes(2);
    });

    it("throws if retry after auto-clean also fails", async () => {
      mockGit.clone
        .mockRejectedValueOnce(new Error("Could not find HEAD"))
        .mockRejectedValueOnce(new Error("Network error"));

      mockGit.fetch.mockRejectedValueOnce(
        new Error("Could not find a fetch refspec"),
      );

      mockPfs.readdir.mockResolvedValue([]);
      mockPfs.rmdir.mockResolvedValue(undefined);

      await expect(
        gitClone({ url: "https://github.com/user/my-repo" }),
      ).rejects.toThrow("Failed to clone/fetch");
    });
  });

  describe("gitFetch", () => {
    it("fetches remote ref successfully", async () => {
      mockGit.fetch.mockResolvedValueOnce({ fetchHead: "f00ba1" });
      const result = await gitFetch({ repo: "my-repo", branch: "main" });
      expect(result).toContain("Fetched main from origin successfully");
      expect(result).toContain("f00ba1");
    });
  });

  describe("gitReadFileAtRef", () => {
    it("reads file blob at ref without checkout", async () => {
      mockGit.resolveRef.mockResolvedValueOnce("commita1b2");
      mockGit.readBlob.mockResolvedValueOnce({
        blob: new TextEncoder().encode("file content at ref"),
      });

      const content = await gitReadFileAtRef({
        repo: "my-repo",
        ref: "main",
        filepath: "src/index.ts",
      });
      expect(content).toBe("file content at ref");
    });
  });

  describe("gitShow", () => {
    it("shows commit details and diff against parent", async () => {
      mockGit.resolveRef.mockResolvedValueOnce("commita1b2");
      mockGit.readCommit.mockResolvedValueOnce({
        commit: {
          parent: ["parent123"],
          author: {
            name: "Dev",
            email: "dev@example.com",
            timestamp: 1700000000,
          },
          message: "Commit message here",
        },
      });
      mockGit.statusMatrix.mockResolvedValueOnce([]);

      const output = await gitShow({ repo: "my-repo", ref: "commita1b2" });
      expect(output).toContain("commit commita1b2");
      expect(output).toContain("Author: Dev <dev@example.com>");
      expect(output).toContain("Commit message here");
    });

    it("shows initial commit message when there is no parent", async () => {
      mockGit.resolveRef.mockResolvedValueOnce("rootcommit");
      mockGit.readCommit.mockResolvedValueOnce({
        commit: {
          parent: [],
          author: {
            name: "Dev",
            email: "dev@example.com",
            timestamp: 1700000000,
          },
          message: "Initial commit",
        },
      });

      const output = await gitShow({ repo: "my-repo", ref: "rootcommit" });
      expect(output).toContain("Initial commit.");
    });
  });

  describe("gitDeleteBranch", () => {
    it("deletes a local branch", async () => {
      mockGit.deleteBranch.mockResolvedValueOnce(undefined);
      const result = await gitDeleteBranch({
        repo: "my-repo",
        name: "old-feature",
      });
      expect(result).toBe("Deleted local branch old-feature in my-repo");
      expect(mockGit.deleteBranch).toHaveBeenCalledWith(
        expect.objectContaining({ ref: "old-feature" }),
      );
    });
  });

  describe("gitInit", () => {
    it("initializes a new empty git repository", async () => {
      mockGit.init.mockResolvedValueOnce(undefined);
      mockGit.getConfig.mockResolvedValueOnce(false);

      const result = await gitInit({ repo: "new-repo" });
      expect(result).toContain("Initialized empty Git repository in new-repo");
      expect(mockGit.init).toHaveBeenCalledWith(
        expect.objectContaining({ defaultBranch: "main" }),
      );
    });
  });

  describe("gitTag & gitListTags", () => {
    it("creates lightweight and annotated tags", async () => {
      mockGit.tag.mockResolvedValueOnce(undefined);
      const resLight = await gitTag({ repo: "my-repo", tag: "v1.0.0" });
      expect(resLight).toBe("Created tag v1.0.0 in my-repo");

      mockGit.annotatedTag.mockResolvedValueOnce(undefined);
      const resAnnotated = await gitTag({
        repo: "my-repo",
        tag: "v1.1.0",
        message: "Release 1.1.0",
      });
      expect(resAnnotated).toBe("Created annotated tag v1.1.0 in my-repo");
    });

    it("lists tags", async () => {
      mockGit.listTags.mockResolvedValueOnce(["v1.0.0", "v1.1.0"]);
      const list = await gitListTags({ repo: "my-repo" });
      expect(list).toBe("v1.0.0\nv1.1.0");

      mockGit.listTags.mockResolvedValueOnce([]);
      const emptyList = await gitListTags({ repo: "my-repo" });
      expect(emptyList).toBe("No tags found.");
    });
  });

  describe("gitRemote", () => {
    it("manages remotes (list, add, remove)", async () => {
      mockGit.listRemotes.mockResolvedValueOnce([
        { remote: "origin", url: "https://github.com/user/repo" },
      ]);
      const list = await gitRemote({ repo: "my-repo", command: "list" });
      expect(list).toContain("origin\thttps://github.com/user/repo");

      mockGit.addRemote.mockResolvedValueOnce(undefined);
      const add = await gitRemote({
        repo: "my-repo",
        command: "add",
        remote: "upstream",
        url: "https://github.com/upstream/repo",
      });
      expect(add).toBe(
        "Added remote upstream -> https://github.com/upstream/repo",
      );

      mockGit.deleteRemote.mockResolvedValueOnce(undefined);
      const remove = await gitRemote({
        repo: "my-repo",
        command: "remove",
        remote: "upstream",
      });
      expect(remove).toBe("Removed remote upstream");

      mockGit.listRemotes.mockResolvedValueOnce([]);
      const emptyList = await gitRemote({ repo: "my-repo", command: "list" });
      expect(emptyList).toBe("No remotes.");

      await expect(
        gitRemote({ repo: "my-repo", command: "add", remote: "" }),
      ).rejects.toThrow("remote and url are required for add");

      await expect(
        gitRemote({ repo: "my-repo", command: "remove", remote: "" }),
      ).rejects.toThrow("remote is required for remove");

      await expect(
        gitRemote({ repo: "my-repo", command: "unknown" as any }),
      ).rejects.toThrow("Invalid command");
    });
  });

  describe("getRemoteUrl", () => {
    it("returns url of matching remote", async () => {
      mockGit.listRemotes.mockResolvedValueOnce([
        { remote: "origin", url: "https://github.com/user/origin-repo" },
        { remote: "upstream", url: "https://github.com/user/upstream-repo" },
      ]);

      const url = await getRemoteUrl({ repo: "my-repo", remote: "upstream" });
      expect(url).toBe("https://github.com/user/upstream-repo");
    });

    it("returns undefined if remote not found or on error", async () => {
      mockGit.listRemotes.mockResolvedValueOnce([
        { remote: "origin", url: "https://github.com/user/origin-repo" },
      ]);

      const url = await getRemoteUrl({ repo: "my-repo", remote: "missing" });
      expect(url).toBeUndefined();

      mockGit.listRemotes.mockRejectedValueOnce(new Error("No repo"));
      const errUrl = await getRemoteUrl({ repo: "not-a-repo" });
      expect(errUrl).toBeUndefined();
    });
  });

  describe("gitConfig", () => {
    it("gets and sets config values", async () => {
      mockGit.getConfig.mockResolvedValueOnce("user@example.com");
      const getRes = await gitConfig({
        repo: "my-repo",
        command: "get",
        key: "user.email",
      });
      expect(getRes).toBe("user@example.com");

      mockGit.getConfig.mockResolvedValueOnce(undefined);
      const emptyGet = await gitConfig({
        repo: "my-repo",
        command: "get",
        key: "user.signingkey",
      });
      expect(emptyGet).toBe("");

      mockGit.setConfig.mockResolvedValueOnce(undefined);
      const setRes = await gitConfig({
        repo: "my-repo",
        command: "set",
        key: "user.name",
        value: "Custom Dev",
      });
      expect(setRes).toBe("Set user.name = Custom Dev");

      await expect(
        gitConfig({
          repo: "my-repo",
          command: "set",
          key: "user.name",
        }),
      ).rejects.toThrow("value is required for set");

      await expect(
        gitConfig({
          repo: "my-repo",
          command: "invalid" as any,
          key: "user.name",
        }),
      ).rejects.toThrow("Invalid command");
    });
  });

  describe("gitUnstage", () => {
    it("unstages single file or array of files", async () => {
      mockGit.remove.mockResolvedValue(undefined);
      const single = await gitUnstage({
        repo: "my-repo",
        filepath: "file1.txt",
      });
      expect(single).toBe("Unstaged file1.txt in my-repo");

      const multiple = await gitUnstage({
        repo: "my-repo",
        filepath: ["file1.txt", "file2.txt"],
      });
      expect(multiple).toBe("Unstaged file1.txt, file2.txt in my-repo");
      expect(mockGit.remove).toHaveBeenCalledTimes(3);
    });
  });

  describe("git utilities and context helpers", () => {
    it("derives repo name from various url formats", () => {
      expect(repoNameFromUrl("https://github.com/xt-ml/shadow-claw.git")).toBe(
        "shadow-claw",
      );
      expect(repoNameFromUrl("https://github.com/xt-ml/shadow-claw/")).toBe(
        "shadow-claw",
      );
      expect(repoNameFromUrl("git@github.com:xt-ml/custom-repo.git")).toBe(
        "custom-repo",
      );
      expect(repoNameFromUrl("")).toBe("repo");
    });

    it("formats repo dir path correctly", () => {
      expect(repoDir("my-repo")).toBe("repos/my-repo");
    });

    it("resolves proxy URLs according to preferences", () => {
      expect(getProxyUrl("custom", "https://proxy.example.com")).toBe(
        "https://proxy.example.com",
      );
      expect(getProxyUrl("public")).toBe("https://www.cors-anywhere.com");
      expect(getProxyUrl("local")).toContain("/git-proxy");
    });

    it("initializes git context with and without groupRoot", async () => {
      const { initGitContext, makeOpfsFs, ensureCoreFilemodeFalse } =
        await import("./git.js");

      const baseCtx = await initGitContext();
      expect(baseCtx.repoDirFn("test-repo")).toBe("repos/test-repo");

      const mockGroupHandle: any = {
        kind: "directory",
        name: "group-dir",
        getDirectoryHandle: jest.fn(),
        getFileHandle: jest.fn(),
      };
      const groupCtx = await initGitContext(mockGroupHandle);
      expect(groupCtx.repoDirFn("test-repo")).toBe("repos/test-repo");

      expect(typeof makeOpfsFs).toBe("function");

      mockGit.getConfig.mockResolvedValueOnce(true);
      await ensureCoreFilemodeFalse(mockGit, {}, "repos/test-repo");
      expect(mockGit.setConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "core.filemode",
          value: false,
        }),
      );
    });

    it("handles gitInit, gitTag, gitListTags, gitRemote, gitConfig, gitUnstage, gitReset", async () => {
      const {
        gitInit,
        gitTag,
        gitListTags,
        gitRemote,
        gitConfig,
        gitUnstage,
        gitReset,
      } = await import("./git.js");

      // 1. gitInit
      mockGit.init.mockResolvedValue(undefined);
      const initRes = await gitInit({ repo: "new-repo" });
      expect(initRes).toContain("Initialized empty Git repository");

      // 2. gitTag
      mockGit.tag.mockResolvedValue(undefined);
      const tagRes = await gitTag({ repo: "new-repo", tag: "v1.0.0" });
      expect(tagRes).toContain("Created tag v1.0.0");

      // 3. gitListTags
      mockGit.listTags.mockResolvedValue(["v1.0.0", "v1.1.0"]);
      const tagsRes = await gitListTags({ repo: "new-repo" });
      expect(tagsRes).toBe("v1.0.0\nv1.1.0");

      // 4. gitRemote - list, add, remove
      mockGit.listRemotes.mockResolvedValue([
        { remote: "origin", url: "https://github.com/xt-ml/repo.git" },
      ]);
      const remotesRes = await gitRemote({ repo: "new-repo", command: "list" });
      expect(remotesRes).toContain("origin\thttps://github.com/xt-ml/repo.git");

      mockGit.addRemote.mockResolvedValue(undefined);
      const addRemoteRes = await gitRemote({
        repo: "new-repo",
        command: "add",
        remote: "upstream",
        url: "https://github.com/upstream/repo.git",
      });
      expect(addRemoteRes).toContain("Added remote upstream");

      mockGit.deleteRemote.mockResolvedValue(undefined);
      const delRemoteRes = await gitRemote({
        repo: "new-repo",
        command: "remove",
        remote: "upstream",
      });
      expect(delRemoteRes).toContain("Removed remote upstream");

      // 5. gitConfig - get and set
      mockGit.getConfig.mockResolvedValue("John Doe");
      const configRes = await gitConfig({
        repo: "new-repo",
        key: "user.name",
        command: "get",
      });
      expect(configRes).toBe("John Doe");

      mockGit.setConfig.mockResolvedValue(undefined);
      const setConfigRes = await gitConfig({
        repo: "new-repo",
        key: "user.name",
        value: "Jane Doe",
        command: "set",
      });
      expect(setConfigRes).toContain("Set user.name = Jane Doe");

      // 6. gitUnstage
      mockGit.resetIndex = jest.fn<any>().mockResolvedValue(undefined);
      const unstageRes = await gitUnstage({
        repo: "new-repo",
        filepath: "file.txt",
      });
      expect(unstageRes).toContain("Unstaged file.txt");

      // 7. gitReset
      mockGit.currentBranch.mockResolvedValue("main");
      mockGit.resolveRef.mockResolvedValue("abc1234");
      mockGit.writeRef = jest.fn<any>().mockResolvedValue(undefined);
      const resetRes = await gitReset({
        repo: "new-repo",
        ref: "HEAD~1",
      });
      expect(resetRes).toContain("Reset main to HEAD~1");

      // 8. gitDiff between two commits (ref1 & ref2)
      mockGit.resolveRef = jest
        .fn<any>()
        .mockImplementation(async ({ ref }: any) => {
          return ref === "HEAD~1"
            ? "11111111111111111111"
            : "22222222222222222222";
        });
      mockGit.readCommit = jest.fn<any>().mockResolvedValue({
        commit: { tree: "tree-oid" },
      });
      mockGit.walk = jest.fn<any>().mockImplementation(async ({ map }: any) => {
        const A = {
          type: async () => "blob",
          oid: async () => "oid-a",
          content: async () =>
            new TextEncoder().encode("line 1\nold line\nline 3"),
        };
        const B = {
          type: async () => "blob",
          oid: async () => "oid-b",
          content: async () =>
            new TextEncoder().encode("line 1\nnew line\nline 3"),
        };
        const diff = await map("test.txt", [A, B]);
        return [diff];
      });

      const { gitDiff } = await import("./git.js");
      const diffTwoRefs = await gitDiff({
        repo: "new-repo",
        ref1: "HEAD~1",
        ref2: "HEAD",
      });
      expect(diffTwoRefs).toContain("Comparing HEAD~1");
      expect(diffTwoRefs).toContain("test.txt");
    });
  });
});
