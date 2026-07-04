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
    readGroupFile: jest.fn(async () => ""),
    getGroupDir: jest.fn(async () => ({}) as any),
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
  it("handles git_clone", async () => {
    const deps = makeDeps();

    const result = await executeGitTool(
      {} as any,
      "git_clone",
      { url: "https://example.com/repo.git", branch: "main" },
      "group-1",
      deps,
    );

    expect(deps.gitClone).toHaveBeenCalled();
    expect(result).toContain('Cloned https://example.com/repo.git as "demo"');
  });

  it("handles git_clone with a custom name", async () => {
    const deps = makeDeps();

    const result = await executeGitTool(
      {} as any,
      "git_clone",
      {
        url: "https://example.com/repo.git",
        branch: "main",
        name: "custom-repo",
      },
      "group-1",
      deps,
    );

    expect(deps.gitClone).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://example.com/repo.git",
        name: "custom-repo",
      }),
    );
    expect(result).toContain('Cloned https://example.com/repo.git as "demo"');
  });

  it("passes groupRoot to git_list_repos and git_delete_repo", async () => {
    const fakeGroupRoot = { name: "workspace-root" } as any;
    const deps = makeDeps({
      getGroupDir: jest.fn(async () => fakeGroupRoot),
      gitListRepos: jest.fn(async () => "repo-a"),
      gitDeleteRepo: jest.fn(async () => "deleted"),
    });

    await executeGitTool({} as any, "git_list_repos", {}, "group-1", deps);
    expect(deps.gitListRepos).toHaveBeenCalledWith({
      groupRoot: fakeGroupRoot,
    });

    await executeGitTool(
      {} as any,
      "git_delete_repo",
      { repo: "demo" },
      "group-1",
      deps,
    );
    expect(deps.gitDeleteRepo).toHaveBeenCalledWith({
      repo: "demo",
      groupRoot: fakeGroupRoot,
    });
  });

  it("returns unknown-tool message for git_sync", async () => {
    const deps = makeDeps();

    const result = await executeGitTool(
      {} as any,
      "git_sync",
      { repo: "demo", direction: "push" },
      "group-1",
      deps,
    );

    expect(result).toContain("Unknown tool: git_sync");
  });

  it("calls gitStatus directly", async () => {
    const deps = makeDeps({
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

  it("calls gitCommit directly", async () => {
    const deps = makeDeps({
      gitCommit: jest.fn(async () => "Committed abc1234: msg"),
    });

    const result = await executeGitTool(
      {} as any,
      "git_commit",
      { repo: "demo", message: "msg" },
      "group-1",
      deps,
    );

    expect(result).toContain("Committed");
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
