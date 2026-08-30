import { jest } from "@jest/globals";

import { executeGitTool } from "./git.js";

function makeDeps(overrides: Record<string, unknown> = {}) {
  return {
    getConfig: jest.fn(async () => undefined),
    getProxyUrl: jest.fn(() => "https://proxy.local"),
    resolveGitCredentials: jest.fn(async () => ({
      token: "tok",
      authorName: "Dev",
      authorEmail: "dev@example.com",
    })),
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
    gitFetch: jest.fn(async () => "fetched"),
    gitInit: jest.fn(async () => "initialized"),
    gitTag: jest.fn(async () => "tagged"),
    gitDeleteBranch: jest.fn(async () => "deleted branch"),
    gitRemote: jest.fn(async () => "remote info"),
    gitConfig: jest.fn(async () => "config val"),
    gitUnstage: jest.fn(async () => "unstaged"),
    gitShow: jest.fn(async () => "commit info"),
    gitReadFileAtRef: jest.fn(async () => "file content"),
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

  it("calls gitCommit directly and passes author info", async () => {
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
    expect(deps.gitCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        authorName: "Dev",
        authorEmail: "dev@example.com",
        message: "msg",
      }),
    );
  });

  it("returns missing-credentials message for git_push when credentials missing", async () => {
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

  it("calls git_push with valid credentials", async () => {
    const deps = makeDeps({
      gitPush: jest.fn(async () => "Pushed main successfully"),
    });

    const result = await executeGitTool(
      {} as any,
      "git_push",
      { repo: "demo", branch: "main" },
      "group-1",
      deps,
    );

    expect(result).toBe("Pushed main successfully");
    expect(deps.gitPush).toHaveBeenCalled();
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

  it("executes remaining git tool operations (add, branch, branches, checkout, config, etc.)", async () => {
    const deps = makeDeps();

    // git_add
    await executeGitTool(
      {} as any,
      "git_add",
      { repo: "demo", filepath: "file.txt" },
      "group-1",
      deps,
    );
    expect(deps.gitAdd).toHaveBeenCalled();

    // git_branch
    await executeGitTool(
      {} as any,
      "git_branch",
      { repo: "demo", name: "feat" },
      "group-1",
      deps,
    );
    expect(deps.gitBranch).toHaveBeenCalled();

    // git_branches
    await executeGitTool(
      {} as any,
      "git_branches",
      { repo: "demo" },
      "group-1",
      deps,
    );
    expect(deps.gitListBranches).toHaveBeenCalled();

    // git_checkout
    await executeGitTool(
      {} as any,
      "git_checkout",
      { repo: "demo", ref: "main" },
      "group-1",
      deps,
    );
    expect(deps.gitCheckout).toHaveBeenCalled();

    // git_config
    await executeGitTool(
      {} as any,
      "git_config",
      { repo: "demo", command: "get", key: "user.name" },
      "group-1",
      deps,
    );
    expect(deps.gitConfig).toHaveBeenCalled();

    // git_delete_branch
    await executeGitTool(
      {} as any,
      "git_delete_branch",
      { repo: "demo", name: "old" },
      "group-1",
      deps,
    );
    expect(deps.gitDeleteBranch).toHaveBeenCalled();

    // git_diff
    await executeGitTool(
      {} as any,
      "git_diff",
      { repo: "demo" },
      "group-1",
      deps,
    );
    expect(deps.gitDiff).toHaveBeenCalled();

    // git_fetch
    await executeGitTool(
      {} as any,
      "git_fetch",
      { repo: "demo" },
      "group-1",
      deps,
    );
    expect(deps.gitFetch).toHaveBeenCalled();

    // git_init
    await executeGitTool(
      {} as any,
      "git_init",
      { repo: "demo" },
      "group-1",
      deps,
    );
    expect(deps.gitInit).toHaveBeenCalled();

    // git_log
    await executeGitTool(
      {} as any,
      "git_log",
      { repo: "demo" },
      "group-1",
      deps,
    );
    expect(deps.gitLog).toHaveBeenCalled();

    // git_pull
    await executeGitTool(
      {} as any,
      "git_pull",
      { repo: "demo" },
      "group-1",
      deps,
    );
    expect(deps.gitPull).toHaveBeenCalled();

    // git_read_file_at_ref
    await executeGitTool(
      {} as any,
      "git_read_file_at_ref",
      { repo: "demo", ref: "main", filepath: "a.ts" },
      "group-1",
      deps,
    );
    expect(deps.gitReadFileAtRef).toHaveBeenCalled();

    // git_remote
    await executeGitTool(
      {} as any,
      "git_remote",
      { repo: "demo", command: "list" },
      "group-1",
      deps,
    );
    expect(deps.gitRemote).toHaveBeenCalled();

    // git_reset
    await executeGitTool(
      {} as any,
      "git_reset",
      { repo: "demo", ref: "HEAD~1" },
      "group-1",
      deps,
    );
    expect(deps.gitReset).toHaveBeenCalled();

    // git_show
    await executeGitTool(
      {} as any,
      "git_show",
      { repo: "demo", ref: "HEAD" },
      "group-1",
      deps,
    );
    expect(deps.gitShow).toHaveBeenCalled();

    // git_tag
    await executeGitTool(
      {} as any,
      "git_tag",
      { repo: "demo", tag: "v1.0" },
      "group-1",
      deps,
    );
    expect(deps.gitTag).toHaveBeenCalled();

    // git_unstage
    await executeGitTool(
      {} as any,
      "git_unstage",
      { repo: "demo", filepath: "a.ts" },
      "group-1",
      deps,
    );
    expect(deps.gitUnstage).toHaveBeenCalled();
  });
});
