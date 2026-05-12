import { jest } from "@jest/globals";

import { executeGitTool } from "./git.js";

function makeDeps(overrides: Record<string, unknown> = {}) {
  return {
    getConfig: jest.fn(async () => undefined),
    getProxyUrl: jest.fn(() => "https://proxy.local"),
    resolveGitCredentials: jest.fn(async () => ({ token: "tok" })),
    gitClone: jest.fn(async () => "demo"),
    gitCheckout: jest.fn(async () => "checked out"),
    gitBranch: jest.fn(async () => "branched"),
    gitStatus: jest.fn(async () => "status"),
    gitAdd: jest.fn(async () => "added"),
    gitLog: jest.fn(async () => "log"),
    gitDiff: jest.fn(async () => "diff"),
    gitListBranches: jest.fn(async () => "branches"),
    gitListRepos: jest.fn(async () => "repos"),
    gitDeleteRepo: jest.fn(async () => "deleted"),
    gitCommit: jest.fn(async () => "commit"),
    gitPull: jest.fn(async () => "pulled"),
    gitPush: jest.fn(async () => "pushed"),
    gitMerge: jest.fn(async () => "merged"),
    gitReset: jest.fn(async () => "reset"),
    getRemoteUrl: jest.fn(async () => "https://example.com/repo.git"),
    syncLfsToOpfs: jest.fn(async () => undefined),
    syncOpfsToLfs: jest.fn(async () => undefined),
    readGroupFile: jest.fn(async () => ""),
    configKeys: {
      GIT_CORS_PROXY: "git-cors-proxy",
      GIT_PROXY_URL: "git-proxy-url",
      GIT_AUTHOR_NAME: "git-author-name",
      GIT_AUTHOR_EMAIL: "git-author-email",
    },
    ...overrides,
  } as any;
}

describe("worker/tools/git", () => {
  it("handles git_clone and syncs workspace mirror", async () => {
    const deps = makeDeps();

    const result = await executeGitTool(
      {} as any,
      "git_clone",
      { url: "https://example.com/repo.git", branch: "main" },
      "group-1",
      deps,
    );

    expect(deps.gitClone).toHaveBeenCalled();
    expect(deps.syncLfsToOpfs).toHaveBeenCalledWith(
      {} as any,
      "group-1",
      "demo",
      "repos/demo",
      false,
    );
    expect(result).toContain('Cloned https://example.com/repo.git as "demo"');
  });

  it("handles git_sync push and pull", async () => {
    const deps = makeDeps();

    const pushResult = await executeGitTool(
      {} as any,
      "git_sync",
      { repo: "demo", direction: "push", include_git: true },
      "group-1",
      deps,
    );
    const pullResult = await executeGitTool(
      {} as any,
      "git_sync",
      { repo: "demo", direction: "pull", include_git: true },
      "group-1",
      deps,
    );

    expect(pushResult).toContain("Synced workspace files");
    expect(pullResult).toContain("Synced git clone files");
  });

  it("continues git_status even if OPFS sync fails", async () => {
    const deps = makeDeps({
      syncOpfsToLfs: jest.fn(async () => {
        throw new Error("missing");
      }),
      gitStatus: jest.fn(async () => "M file.ts"),
    });

    const result = await executeGitTool(
      {} as any,
      "git_status",
      { repo: "demo" },
      "group-1",
      deps,
    );

    expect(result).toBe("M file.ts");
  });

  it("returns friendly error when git_commit sync fails", async () => {
    const deps = makeDeps({
      syncOpfsToLfs: jest.fn(async () => {
        throw new Error("boom");
      }),
    });

    const result = await executeGitTool(
      {} as any,
      "git_commit",
      { repo: "demo", message: "msg" },
      "group-1",
      deps,
    );

    expect(result).toContain("Error: Could not sync from OPFS");
  });

  it("returns missing-credentials message for git_push", async () => {
    const deps = makeDeps({
      resolveGitCredentials: jest.fn(async () => ({})),
    });

    const result = await executeGitTool(
      {} as any,
      "git_push",
      { repo: "demo", branch: "main" },
      "group-1",
      deps,
    );

    expect(result).toContain("No git credentials configured");
  });

  it("formats merge conflicts with inline regions", async () => {
    const deps = makeDeps({
      gitMerge: jest.fn(async () => {
        const err: any = new Error(
          "conflicts in the following files: src/app.ts",
        );
        err.data = { filepaths: ["src/app.ts"] };

        throw err;
      }),
      readGroupFile: jest.fn(async () =>
        [
          "<<<<<<< ours",
          "const a = 1;",
          "=======",
          "const a = 2;",
          ">>>>>>> theirs",
        ].join("\n"),
      ),
    });

    const result = await executeGitTool(
      {} as any,
      "git_merge",
      { repo: "demo", theirs: "main" },
      "group-1",
      deps,
    );

    expect(result).toContain("Automatic merge failed with conflicts");
    expect(result).toContain("src/app.ts");
    expect(result).toContain("Resolution steps:");
    expect(result).toContain("<<<<<<< ours");
  });
});
