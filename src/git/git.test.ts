import { jest } from "@jest/globals";

const mockPfs: any = {
  mkdir: jest.fn<any>().mockResolvedValue(undefined),
  readdir: jest.fn<any>().mockResolvedValue([]),
  readFile: jest.fn<any>().mockResolvedValue(""),
  writeFile: jest.fn<any>().mockResolvedValue(undefined),
  unlink: jest.fn<any>().mockResolvedValue(undefined),
  rmdir: jest.fn<any>().mockResolvedValue(undefined),
  stat: jest.fn<any>().mockResolvedValue({ isDirectory: () => false }),
};

const mockLightningFS: any = jest.fn(() => ({
  promises: mockPfs,
}));

const mockGit: any = {
  clone: jest.fn(),
  fetch: jest.fn(),
  checkout: jest.fn(),
  branch: jest.fn(),
  statusMatrix: jest.fn(),
  currentBranch: jest.fn(),
  log: jest.fn(),
  resolveRef: jest.fn(),
  listBranches: jest.fn(),
  add: jest.fn(),
  remove: jest.fn(),
  commit: jest.fn(),
  push: jest.fn(),
  pull: jest.fn(),
  merge: jest.fn(),
};

jest.unstable_mockModule("@isomorphic-git/lightning-fs", () => ({
  default: mockLightningFS,
}));
jest.unstable_mockModule("isomorphic-git", () => ({
  default: mockGit,
}));
jest.unstable_mockModule("isomorphic-git/http/web", () => ({
  default: {},
}));
jest.unstable_mockModule("@zip.js/zip.js", () => ({}) as any);

const mod = await import("./git.js");

describe("git.js", () => {
  beforeEach(async () => {
    jest.clearAllMocks();

    // Reset default mock behaviors that might have been changed in previous tests
    mockGit.clone.mockResolvedValue(undefined);
    mockGit.fetch.mockResolvedValue(undefined);
    mockPfs.readdir.mockResolvedValue([]);
    mockPfs.stat.mockResolvedValue({ isDirectory: () => false });

    // Set UMD globals that git.mjs expects at runtime if still needed,
    // though the modules should now be correctly mocked.
    globalThis.LightningFS = mockLightningFS;
    globalThis.git = mockGit;
    globalThis.Buffer = globalThis.Buffer || Uint8Array;
  });

  describe("buildAuthCallbacks", () => {
    it("returns proactive Authorization header for token", () => {
      const result = mod.buildAuthCallbacks({ token: "fake" });
      expect(result.headers).toEqual({
        Authorization: `Basic ${btoa("fake:x-oauth-basic")}`,
      });
    });

    it("returns proactive Authorization header for username/password", () => {
      const result = mod.buildAuthCallbacks({
        username: "user",
        password: "pass",
      });
      expect(result.headers).toEqual({
        Authorization: `Basic ${btoa("user:pass")}`,
      });
    });

    it("returns token-based onAuth when token is provided", () => {
      const { onAuth } = mod.buildAuthCallbacks({ token: "fake" });
      expect(onAuth()).toEqual({
        username: "fake",
        password: "x-oauth-basic",
      });
    });

    it("returns username/password onAuth when provided", () => {
      const { onAuth } = mod.buildAuthCallbacks({
        username: "user",
        password: "pass",
      });
      expect(onAuth()).toEqual({ username: "user", password: "pass" });
    });

    it("prefers token over username/password", () => {
      const result = mod.buildAuthCallbacks({
        token: "fake",
        username: "user",
        password: "pass",
      });
      expect(result.onAuth()).toEqual({
        username: "fake",
        password: "x-oauth-basic",
      });
      expect(result.headers).toEqual({
        Authorization: `Basic ${btoa("fake:x-oauth-basic")}`,
      });
    });

    it("returns cancel when no credentials provided", () => {
      const result = mod.buildAuthCallbacks({} as any);
      expect(result.onAuth()).toEqual({ cancel: true });
      expect(result.headers).toBeUndefined();
    });

    it("returns cancel when called with no args", () => {
      const { onAuth } = mod.buildAuthCallbacks();
      expect(onAuth()).toEqual({ cancel: true });
    });

    it("omits headers when no credentials provided", () => {
      const result = mod.buildAuthCallbacks();
      expect(result.headers).toBeUndefined();
    });

    it("onAuthFailure always cancels", () => {
      const { onAuthFailure } = mod.buildAuthCallbacks({
        token: "fake",
      });
      expect(onAuthFailure()).toEqual({ cancel: true });
    });

    it("handles username with empty password", () => {
      const result = mod.buildAuthCallbacks({ username: "user" });
      expect(result.onAuth()).toEqual({ username: "user", password: "" });
      expect(result.headers).toEqual({
        Authorization: `Basic ${btoa("user:")}`,
      });
    });
  });

  describe("repoNameFromUrl", () => {
    it("extracts name from GitHub URL", () => {
      expect(mod.repoNameFromUrl("https://github.com/user/my-repo")).toBe(
        "my-repo",
      );
    });

    it("strips .git suffix", () => {
      expect(mod.repoNameFromUrl("https://github.com/user/my-repo.git")).toBe(
        "my-repo",
      );
    });

    it("handles trailing slashes", () => {
      expect(mod.repoNameFromUrl("https://github.com/user/my-repo/")).toBe(
        "my-repo",
      );
    });

    it("returns 'repo' for empty URL", () => {
      expect(mod.repoNameFromUrl("")).toBe("repo");
    });
  });

  describe("initGitFs", () => {
    it("returns fs and pfs objects", async () => {
      const result = await mod.initGitFs();
      expect(result.fs).toBeDefined();
      expect(result.pfs).toBeDefined();
    });

    it("is idempotent", async () => {
      const first = await mod.initGitFs();
      const second = await mod.initGitFs();
      expect(first.fs).toBe(second.fs);
    });
  });

  describe("gitClone", () => {
    it("clones a repository", async () => {
      const repo = await mod.gitClone({
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

      const repo = await mod.gitClone({
        url: "https://github.com/user/my-repo",
      });

      expect(repo).toBe("my-repo");
      expect(mockGit.fetch).toHaveBeenCalled();
    });

    it("throws if both clone and fetch fail", async () => {
      mockGit.clone.mockRejectedValue(new Error("fail1"));
      mockGit.fetch.mockRejectedValue(new Error("fail2"));

      await expect(
        mod.gitClone({ url: "https://github.com/user/my-repo" }),
      ).rejects.toThrow("Failed to clone/fetch");
    });

    it("uses custom repo name", async () => {
      const repo = await mod.gitClone({
        url: "https://github.com/user/my-repo",
        name: "custom-name",
      });

      expect(repo).toBe("custom-name");
    });
  });

  describe("gitCheckout", () => {
    it("checks out a ref", async () => {
      const result = await mod.gitCheckout({ repo: "my-repo", ref: "main" });
      expect(result).toContain("Checked out main");
      expect(mockGit.checkout).toHaveBeenCalledWith(
        expect.objectContaining({ ref: "main", force: true }),
      );
    });
  });

  describe("gitBranch", () => {
    it("creates a new branch", async () => {
      const result = await mod.gitBranch({ repo: "my-repo", name: "feature" });
      expect(result).toContain("Created branch feature");
      expect(mockGit.branch).toHaveBeenCalledWith(
        expect.objectContaining({ ref: "feature" }),
      );
      expect(mockGit.checkout).not.toHaveBeenCalled();
    });

    it("creates and checks out when checkout is true", async () => {
      const result = await mod.gitBranch({
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
      await mod.gitBranch({
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

      const result = await mod.gitStatus({ repo: "my-repo" });
      expect(result).toContain("Nothing to commit");
    });

    it("reports modified files", async () => {
      mockGit.statusMatrix.mockResolvedValue([["changed.txt", 1, 2, 1]]);
      mockGit.currentBranch.mockResolvedValue("main");

      const result = await mod.gitStatus({ repo: "my-repo" });
      expect(result).toContain("modified: changed.txt");
    });

    it("reports empty repository", async () => {
      mockGit.statusMatrix.mockResolvedValue([]);

      const result = await mod.gitStatus({ repo: "my-repo" });
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

      const result = await mod.gitLog({ repo: "my-repo" });
      expect(result).toContain("abc1234567890");
      expect(result).toContain("Test User");
      expect(result).toContain("Initial commit");
    });

    it("handles no commits", async () => {
      mockGit.log.mockResolvedValue([]);

      const result = await mod.gitLog({ repo: "my-repo" });
      expect(result).toBe("No commits found.");
    });
  });

  describe("gitDiff", () => {
    it("reports no differences for clean tree", async () => {
      mockGit.statusMatrix.mockResolvedValue([["file.txt", 1, 1, 1]]);

      const result = await mod.gitDiff({ repo: "my-repo" });
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

      const result = await mod.gitDiff({ repo: "my-repo" });
      expect(result).toContain("src/app.js");
      expect(result).toContain("-line two");
      expect(result).toContain("+line TWO");
      expect(result).toContain("+line three");
    });

    it("shows full content for new files", async () => {
      mockGit.statusMatrix.mockResolvedValue([["new.txt", 0, 2, 0]]);
      mockPfs.readFile.mockResolvedValue(Buffer.from("hello world\n"));

      const result = await mod.gitDiff({ repo: "my-repo" });
      expect(result).toContain("new.txt");
      expect(result).toContain("+hello world");
    });

    it("shows removed content for deleted files", async () => {
      mockGit.statusMatrix.mockResolvedValue([["old.txt", 1, 0, 0]]);
      mockGit.resolveRef.mockResolvedValue("abc123");

      mockGit.readBlob = (jest.fn() as any).mockResolvedValue({
        blob: Buffer.from("goodbye\n"),
      });

      const result = await mod.gitDiff({ repo: "my-repo" });
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

      const result = await mod.gitDiff({ repo: "my-repo" });
      expect(result).toContain("binary.bin");
      expect(result).toContain("modified");
    });

    it("compares two refs", async () => {
      mockGit.resolveRef
        .mockResolvedValueOnce("aaa1111")
        .mockResolvedValueOnce("bbb2222");

      const result = await mod.gitDiff({
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

      const result = await mod.gitListBranches({ repo: "my-repo" });
      expect(result).toContain("* main");
      expect(result).toContain("  dev");
    });

    it("handles no branches", async () => {
      mockGit.listBranches.mockResolvedValue([]);

      const result = await mod.gitListBranches({ repo: "my-repo" });
      expect(result).toBe("No branches found.");
    });
  });

  describe("gitCurrentBranch", () => {
    it("returns current branch", async () => {
      mockGit.currentBranch.mockResolvedValue("main");

      const result = await mod.gitCurrentBranch({ repo: "my-repo" });
      expect(result).toBe("main");
    });

    it("handles detached HEAD", async () => {
      mockGit.currentBranch.mockResolvedValue(null);

      const result = await mod.gitCurrentBranch({ repo: "my-repo" });
      expect(result).toBe("(detached HEAD)");
    });
  });

  describe("gitCommit", () => {
    it("stages changes and commits", async () => {
      mockGit.statusMatrix.mockResolvedValue([
        ["file.txt", 1, 2, 1], // modified, unstaged
      ]);
      mockGit.commit.mockResolvedValue("abc1234567890");

      const result = await mod.gitCommit({
        repo: "my-repo",
        message: "test commit",
      });

      expect(mockGit.add).toHaveBeenCalledWith(
        expect.objectContaining({ filepath: "file.txt" }),
      );

      expect(mockGit.commit).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "test commit",
          author: expect.objectContaining({ name: "ShadowClaw" }),
        }),
      );
      expect(result).toContain("Committed abc1234");
    });

    it("handles removed files", async () => {
      mockGit.statusMatrix.mockResolvedValue([
        ["deleted.txt", 1, 0, 1], // deleted
      ]);

      mockGit.commit.mockResolvedValue("def5678901234");

      await mod.gitCommit({ repo: "my-repo", message: "remove file" });
      expect(mockGit.remove).toHaveBeenCalledWith(
        expect.objectContaining({ filepath: "deleted.txt" }),
      );
    });
  });

  describe("gitPush", () => {
    it("pushes with token auth", async () => {
      mockGit.currentBranch.mockResolvedValue("main");
      mockGit.push.mockResolvedValue({ ok: true });

      const result = await mod.gitPush({
        repo: "my-repo",
        token: "fake",
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
        mod.gitPush({ repo: "my-repo", token: "ghp_test" }),
      ).rejects.toThrow("No branch to push");
    });

    it("pushes to a different remote ref when remoteRef is set", async () => {
      mockGit.currentBranch.mockResolvedValue("feature-rebased");
      mockGit.push.mockResolvedValue({ ok: true });

      const result = await mod.gitPush({
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
    it("lists repos", async () => {
      mockPfs.readdir.mockResolvedValue(["repo-a", "repo-b"]);

      const result = await mod.gitListRepos();
      expect(result).toContain("repo-a");
      expect(result).toContain("repo-b");
    });

    it("handles no repos", async () => {
      mockPfs.readdir.mockRejectedValue(new Error("ENOENT"));

      const result = await mod.gitListRepos();
      expect(result).toBe("No repos cloned.");
    });
  });

  describe("getProxyUrl", () => {
    it("returns public CORS proxy when preference is public", () => {
      const url = mod.getProxyUrl("public");
      expect(url).toBe("https://www.cors-anywhere.com");
    });

    it("returns local proxy URL for local preference", () => {
      const url = mod.getProxyUrl("local");
      expect(url).toContain("git-proxy");
    });
  });

  describe("repoDir", () => {
    it("returns repo directory path", () => {
      expect(mod.repoDir("my-repo")).toBe("/git/my-repo");
      expect(mod.repoDir("another-repo")).toBe("/git/another-repo");
    });
  });

  describe("ensureDir", () => {
    it("creates directory if it does not exist", async () => {
      mockPfs.mkdir.mockResolvedValue(undefined);

      await mod.ensureDir(mockPfs, "/test-dir");

      expect(mockPfs.mkdir).toHaveBeenCalledWith("/test-dir");
    });

    it("does not throw if directory already exists", async () => {
      mockPfs.mkdir.mockRejectedValue(new Error("EEXIST"));

      await expect(mod.ensureDir(mockPfs, "/test-dir")).resolves.not.toThrow();
    });
  });

  describe("gitAdd", () => {
    it("adds a file to staging", async () => {
      const result = await mod.gitAdd({
        repo: "my-repo",
        filepath: "file.txt",
      });

      expect(result).toContain("file.txt");
      expect(result).toContain("my-repo");
      expect(mockGit.add).toHaveBeenCalledWith(
        expect.objectContaining({
          filepath: "file.txt",
        }),
      );
    });
  });

  describe("gitPull", () => {
    it("pulls changes from remote", async () => {
      mockGit.currentBranch.mockResolvedValue("main");
      mockGit.pull.mockResolvedValue(undefined);

      const result = await mod.gitPull({
        repo: "my-repo",
        token: "fake",
      });

      expect(result).toContain("Pulled latest changes");
      expect(mockGit.pull).toHaveBeenCalled();
    });

    it("throws on detached HEAD", async () => {
      mockGit.currentBranch.mockResolvedValue(null);

      await expect(
        mod.gitPull({ repo: "my-repo", token: "ghp_test" }),
      ).rejects.toThrow("No branch to pull");
    });

    it("uses custom branch", async () => {
      mockGit.currentBranch.mockResolvedValue("dev");
      mockGit.pull.mockResolvedValue(undefined);

      const result = await mod.gitPull({
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
        oid: "abc1234567890",
        alreadyMerged: false,
        fastForward: false,
      });

      const result = await mod.gitMerge({
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
        oid: "def5678901234",
        alreadyMerged: false,
        fastForward: true,
      });

      const result = await mod.gitMerge({
        repo: "my-repo",
        theirs: "feature/branch",
      });

      expect(result).toContain("Fast-forward merge");
    });

    it("reports already merged", async () => {
      mockGit.currentBranch.mockResolvedValue("main");
      mockGit.merge.mockResolvedValue({ alreadyMerged: true });

      const result = await mod.gitMerge({
        repo: "my-repo",
        theirs: "feature/branch",
      });

      expect(result).toContain("Already up to date");
    });

    it("throws on detached HEAD", async () => {
      mockGit.currentBranch.mockResolvedValue(null);

      await expect(
        mod.gitMerge({ repo: "my-repo", theirs: "feature" }),
      ).rejects.toThrow("Cannot merge");
    });

    it("passes abortOnConflict: false to git.merge", async () => {
      mockGit.currentBranch.mockResolvedValue("main");
      mockGit.merge.mockResolvedValue({
        oid: "abc1234567890",
        alreadyMerged: false,
        fastForward: false,
      });

      await mod.gitMerge({ repo: "my-repo", theirs: "feature/branch" });

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
        mod.gitMerge({ repo: "my-repo", theirs: "feature" }),
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

      const result = await mod.gitReset({
        repo: "my-repo",
        ref: "main",
      });

      expect(result).toContain("Reset feature to main");
      expect(mockGit.resolveRef).toHaveBeenCalledWith(
        expect.objectContaining({ ref: "main" }),
      );
      expect(mockPfs.writeFile).toHaveBeenCalledWith(
        "/git/my-repo/.git/refs/heads/feature",
        expect.stringContaining("abc1234567890abcdef1234567890abcdef123456"),
        "utf8",
      );
      expect(mockGit.checkout).toHaveBeenCalledWith(
        expect.objectContaining({ ref: "feature", force: true }),
      );
    });

    it("throws on detached HEAD", async () => {
      mockGit.currentBranch.mockResolvedValue(null);

      await expect(
        mod.gitReset({ repo: "my-repo", ref: "main" }),
      ).rejects.toThrow("Cannot reset");
    });
  });

  describe("rmdirRecursive", () => {
    it("removes a flat directory of files", async () => {
      mockPfs.readdir.mockResolvedValue(["a.txt", "b.txt"]);
      mockPfs.stat.mockResolvedValue({ isDirectory: () => false });
      mockPfs.unlink.mockResolvedValue(undefined);
      mockPfs.rmdir.mockResolvedValue(undefined);

      await mod.rmdirRecursive(mockPfs, "/git/my-repo");

      expect(mockPfs.unlink).toHaveBeenCalledWith("/git/my-repo/a.txt");
      expect(mockPfs.unlink).toHaveBeenCalledWith("/git/my-repo/b.txt");
      expect(mockPfs.rmdir).toHaveBeenCalledWith("/git/my-repo");
    });

    it("recurses into subdirectories", async () => {
      mockPfs.readdir
        .mockResolvedValueOnce(["sub"])
        .mockResolvedValueOnce(["file.txt"]);
      mockPfs.stat
        .mockResolvedValueOnce({ isDirectory: () => true })
        .mockResolvedValueOnce({ isDirectory: () => false });
      mockPfs.unlink.mockResolvedValue(undefined);
      mockPfs.rmdir.mockResolvedValue(undefined);

      await mod.rmdirRecursive(mockPfs, "/git/my-repo");

      expect(mockPfs.unlink).toHaveBeenCalledWith("/git/my-repo/sub/file.txt");
      expect(mockPfs.rmdir).toHaveBeenCalledWith("/git/my-repo/sub");
      expect(mockPfs.rmdir).toHaveBeenCalledWith("/git/my-repo");
    });

    it("handles empty directory", async () => {
      mockPfs.readdir.mockResolvedValue([]);
      mockPfs.rmdir.mockResolvedValue(undefined);

      await mod.rmdirRecursive(mockPfs, "/git/empty");

      expect(mockPfs.rmdir).toHaveBeenCalledWith("/git/empty");
      expect(mockPfs.unlink).not.toHaveBeenCalled();
    });
  });

  describe("gitDeleteRepo", () => {
    it("deletes a repo directory from LightningFS", async () => {
      mockPfs.readdir.mockResolvedValue([]);
      mockPfs.rmdir.mockResolvedValue(undefined);

      const result = await mod.gitDeleteRepo({ repo: "my-repo" });

      expect(result).toContain("Deleted");
      expect(result).toContain("my-repo");
    });

    it("throws if repo name is empty", async () => {
      await expect(mod.gitDeleteRepo({ repo: "" })).rejects.toThrow(
        "repo name is required",
      );
    });

    it("throws if repo name contains path traversal", async () => {
      await expect(mod.gitDeleteRepo({ repo: "../etc" })).rejects.toThrow(
        "Invalid repo name",
      );
    });

    it("returns message when repo does not exist", async () => {
      mockPfs.readdir.mockRejectedValue(
        Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
      );

      const result = await mod.gitDeleteRepo({ repo: "nonexistent" });
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

      const repo = await mod.gitClone({
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
        mod.gitClone({ url: "https://github.com/user/my-repo" }),
      ).rejects.toThrow("Failed to clone/fetch");
    });
  });
});
