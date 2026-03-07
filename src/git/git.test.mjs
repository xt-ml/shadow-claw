import { jest } from "@jest/globals";

describe("git.mjs", () => {
  let mod;
  let mockGit;
  let mockLightningFS;
  let mockPfs;

  beforeEach(async () => {
    jest.resetModules();

    mockPfs = {
      mkdir: jest.fn(),
      readdir: jest.fn(),
      readFile: jest.fn(),
    };

    mockLightningFS = jest.fn(() => ({
      promises: mockPfs,
    }));

    mockGit = {
      clone: jest.fn(),
      fetch: jest.fn(),
      checkout: jest.fn(),
      statusMatrix: jest.fn(),
      currentBranch: jest.fn(),
      log: jest.fn(),
      resolveRef: jest.fn(),
      listBranches: jest.fn(),
      add: jest.fn(),
      remove: jest.fn(),
      commit: jest.fn(),
      push: jest.fn(),
    };

    // Set UMD globals that git.mjs expects at runtime
    globalThis.LightningFS = mockLightningFS;
    globalThis.git = mockGit;
    globalThis.Buffer = globalThis.Buffer || {};

    mod = await import("./git.mjs");
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
      expect(result).toContain("abc1234");
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

    it("reports new files", async () => {
      mockGit.statusMatrix.mockResolvedValue([["new.txt", 0, 2, 0]]);

      const result = await mod.gitDiff({ repo: "my-repo" });
      expect(result).toContain("+++ new.txt (new file)");
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
        token: "ghp_test123",
      });

      expect(result).toContain("Pushed main to origin successfully");
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
});
