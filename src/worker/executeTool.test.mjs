import { jest } from "@jest/globals";

describe("executeTool.mjs", () => {
  let executeTool;
  let mockBootVM;
  let mockExecuteInVM;
  let mockExecuteShell;
  let mockFormatShellOutput;
  let mockGetVMBootModePreference;
  let mockGetVMStatus;
  let mockIsVMReady;
  let mockListGroupFiles;
  let mockGetAllTasks;
  let mockPost;
  let mockReadGroupFile;
  let mockStripHtml;
  let mockUlid;
  let mockWriteGroupFile;
  let mockGetConfig;
  let mockGitAdd;
  let mockGitCheckout;
  let mockGitClone;
  let mockGitCommit;
  let mockGitDiff;
  let mockGitListBranches;
  let mockGitListRepos;
  let mockGitLog;
  let mockGitPull;
  let mockGitPush;
  let mockGitStatus;
  let mockGetProxyUrl;
  let mockDecryptValue;
  let mockSyncLfsToOpfs;
  let mockSyncOpfsToLfs;

  beforeEach(async () => {
    jest.resetModules();

    mockBootVM = jest.fn();
    mockExecuteInVM = jest.fn();
    mockExecuteShell = jest.fn();
    mockFormatShellOutput = jest.fn((shellResult) => shellResult.stdout || "");
    mockGetVMBootModePreference = jest.fn(() => "auto");
    mockGetVMStatus = jest.fn(() => ({
      ready: false,
      booting: false,
      bootAttempted: true,
      error: "WebVM unavailable",
    }));
    mockIsVMReady = jest.fn(() => true);
    mockListGroupFiles = jest.fn();
    mockGetAllTasks = jest.fn().mockResolvedValue([]);
    mockPost = jest.fn();
    mockReadGroupFile = jest.fn();
    mockStripHtml = jest.fn((html) => html.replace(/<[^>]*>/g, ""));
    mockUlid = jest.fn(() => "mock-ulid");
    mockWriteGroupFile = jest.fn();
    mockGetConfig = jest.fn();
    mockGitAdd = jest.fn();
    mockGitCheckout = jest.fn();
    mockGitClone = jest.fn();
    mockGitCommit = jest.fn();
    mockGitDiff = jest.fn();
    mockGitListBranches = jest.fn();
    mockGitListRepos = jest.fn();
    mockGitLog = jest.fn();
    mockGitPull = jest.fn();
    mockGitPush = jest.fn();
    mockGitStatus = jest.fn();
    mockGetProxyUrl = jest.fn(() => "https://proxy.local");
    mockDecryptValue = jest.fn();
    mockSyncLfsToOpfs = jest.fn();
    mockSyncOpfsToLfs = jest.fn();

    jest.unstable_mockModule("../config.mjs", () => ({
      BASH_DEFAULT_TIMEOUT_SEC: 120,
      BASH_MAX_TIMEOUT_SEC: 1800,
      FETCH_MAX_RESPONSE: 1000,
      OPFS_ROOT: "shadowclaw",
      CONFIG_KEYS: {
        GIT_TOKEN: "git-token",
        GIT_CORS_PROXY: "git-cors-proxy",
        GIT_AUTHOR_NAME: "git-author-name",
        GIT_AUTHOR_EMAIL: "git-author-email",
        VM_BASH_TIMEOUT_SEC: "vm-bash-timeout-sec",
      },
    }));

    jest.unstable_mockModule("../db/getConfig.mjs", () => ({
      getConfig: mockGetConfig,
    }));

    jest.unstable_mockModule("../db/getAllTasks.mjs", () => ({
      getAllTasks: mockGetAllTasks,
    }));

    jest.unstable_mockModule("../crypto.mjs", () => ({
      decryptValue: mockDecryptValue,
    }));

    jest.unstable_mockModule("../git/git.mjs", () => ({
      gitAdd: mockGitAdd,
      gitCheckout: mockGitCheckout,
      gitClone: mockGitClone,
      gitCommit: mockGitCommit,
      gitDiff: mockGitDiff,
      gitListBranches: mockGitListBranches,
      gitListRepos: mockGitListRepos,
      gitLog: mockGitLog,
      gitPull: mockGitPull,
      gitPush: mockGitPush,
      gitStatus: mockGitStatus,
      getProxyUrl: mockGetProxyUrl,
    }));

    jest.unstable_mockModule("../git/sync.mjs", () => ({
      syncLfsToOpfs: mockSyncLfsToOpfs,
      syncOpfsToLfs: mockSyncOpfsToLfs,
    }));

    jest.unstable_mockModule("../vm.mjs", () => ({
      bootVM: mockBootVM,
      executeInVM: mockExecuteInVM,
      getVMBootModePreference: mockGetVMBootModePreference,
      getVMStatus: mockGetVMStatus,
      isVMReady: mockIsVMReady,
    }));

    jest.unstable_mockModule("../shell/shell.mjs", () => ({
      executeShell: mockExecuteShell,
    }));

    jest.unstable_mockModule("../storage/listGroupFiles.mjs", () => ({
      listGroupFiles: mockListGroupFiles,
    }));

    jest.unstable_mockModule("../storage/readGroupFile.mjs", () => ({
      readGroupFile: mockReadGroupFile,
    }));

    jest.unstable_mockModule("../storage/writeGroupFile.mjs", () => ({
      writeGroupFile: mockWriteGroupFile,
    }));

    jest.unstable_mockModule("../ulid.mjs", () => ({
      ulid: mockUlid,
    }));

    jest.unstable_mockModule("./post.mjs", () => ({
      post: mockPost,
    }));

    jest.unstable_mockModule("./formatShellOutput.mjs", () => ({
      formatShellOutput: mockFormatShellOutput,
    }));

    jest.unstable_mockModule("./stripHtml.mjs", () => ({
      stripHtml: mockStripHtml,
    }));

    const module = await import("./executeTool.mjs");
    executeTool = module.executeTool;

    delete global.fetch;
  });

  it("should handle bash tool", async () => {
    mockExecuteInVM.mockResolvedValue("vm output");

    const result = await executeTool({}, "bash", { command: "ls" }, "group1");

    expect(mockExecuteInVM).toHaveBeenCalledWith("ls", 120, {
      db: {},
      groupId: "group1",
    });

    expect(result).toBe("vm output");
  });

  it("should clamp bash timeout to 1800 seconds", async () => {
    mockExecuteInVM.mockResolvedValue("vm output");

    await executeTool({}, "bash", { command: "ls", timeout: 999 }, "group1");

    expect(mockExecuteInVM).toHaveBeenCalledWith("ls", 999, {
      db: {},
      groupId: "group1",
    });
  });

  it("should cap bash timeout to 1800 seconds", async () => {
    mockExecuteInVM.mockResolvedValue("vm output");

    await executeTool({}, "bash", { command: "ls", timeout: 9_999 }, "group1");

    expect(mockExecuteInVM).toHaveBeenCalledWith("ls", 1800, {
      db: {},
      groupId: "group1",
    });
  });

  it("should use configured VM bash timeout when input timeout is omitted", async () => {
    mockGetConfig.mockResolvedValue("600");
    mockExecuteInVM.mockResolvedValue("vm output");

    await executeTool({}, "bash", { command: "ls" }, "group1");

    expect(mockExecuteInVM).toHaveBeenCalledWith("ls", 600, {
      db: {},
      groupId: "group1",
    });
  });

  it("should prefer explicit bash timeout over configured VM default", async () => {
    mockGetConfig.mockResolvedValue("600");
    mockExecuteInVM.mockResolvedValue("vm output");

    await executeTool({}, "bash", { command: "ls", timeout: 45 }, "group1");

    expect(mockExecuteInVM).toHaveBeenCalledWith("ls", 45, {
      db: {},
      groupId: "group1",
    });
  });

  it("should wait for VM boot when bash is called before ready", async () => {
    mockIsVMReady
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
      .mockReturnValue(true);

    mockGetVMStatus.mockReturnValue({
      ready: false,
      booting: true,
      bootAttempted: true,
      error: null,
    });

    mockExecuteInVM.mockResolvedValue("booted output");

    const result = await executeTool({}, "bash", { command: "wget" }, "group1");

    expect(mockBootVM).toHaveBeenCalledTimes(1);

    expect(mockExecuteInVM).toHaveBeenCalledWith("wget", 120, {
      db: {},
      groupId: "group1",
    });

    expect(result).toBe("booted output");
  });

  it("uses JS shell emulator when VM mode is disabled", async () => {
    mockGetVMBootModePreference.mockReturnValue("disabled");
    mockIsVMReady.mockReturnValue(false);
    mockExecuteShell.mockResolvedValue({
      stdout: "shell fallback output",
      stderr: "",
      exitCode: 0,
    });
    mockFormatShellOutput.mockReturnValue("shell fallback output");

    const result = await executeTool(
      {},
      "bash",
      { command: "wget", timeout: 1 },
      "group1",
    );

    expect(mockBootVM).not.toHaveBeenCalled();
    expect(mockExecuteInVM).not.toHaveBeenCalled();
    expect(mockExecuteShell).toHaveBeenCalledWith({}, "wget", "group1", {}, 1);
    expect(mockFormatShellOutput).toHaveBeenCalledWith({
      stdout: "shell fallback output",
      stderr: "",
      exitCode: 0,
    });
    expect(mockPost).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "show-toast" }),
    );
    expect(result).toBe("shell fallback output");
  });

  it("falls back to JS shell emulator with toast when WebVM is unavailable", async () => {
    mockIsVMReady.mockReturnValue(false);
    mockGetVMStatus.mockReturnValue({
      ready: false,
      booting: false,
      bootAttempted: true,
      error: "Assets missing",
    });
    mockExecuteShell.mockResolvedValue({
      stdout: "shell fallback output",
      stderr: "",
      exitCode: 0,
    });
    mockFormatShellOutput.mockReturnValue("shell fallback output");

    const result = await executeTool(
      {},
      "bash",
      { command: "wget", timeout: 1 },
      "group1",
    );

    expect(mockBootVM).toHaveBeenCalledTimes(1);

    expect(mockExecuteInVM).not.toHaveBeenCalled();
    expect(mockExecuteShell).toHaveBeenCalledWith({}, "wget", "group1", {}, 1);
    expect(mockPost).toHaveBeenCalledWith({
      type: "show-toast",
      payload: {
        message:
          "WebVM unavailable for this bash command. Reason: Assets missing Falling back to JavaScript Bash Emulator and retrying WebVM on the next command.",
        type: "warning",
        duration: 7000,
      },
    });
    expect(result).toBe("shell fallback output");
  });

  it("retries WebVM on a later bash command after fallback", async () => {
    mockIsVMReady.mockReturnValue(false);
    mockGetVMStatus.mockReturnValue({
      ready: false,
      booting: false,
      bootAttempted: true,
      error: "Assets missing",
    });
    mockExecuteShell.mockResolvedValue({
      stdout: "shell fallback output",
      stderr: "",
      exitCode: 0,
    });
    mockFormatShellOutput.mockReturnValue("shell fallback output");

    const first = await executeTool({}, "bash", { command: "date" }, "group1");
    expect(first).toBe("shell fallback output");

    mockIsVMReady.mockReturnValue(true);
    mockExecuteInVM.mockResolvedValue("vm output");

    const second = await executeTool({}, "bash", { command: "date" }, "group1");
    expect(second).toBe("vm output");
    expect(mockExecuteInVM).toHaveBeenCalledWith("date", 120, {
      db: {},
      groupId: "group1",
    });
  });

  it("should handle read_file tool", async () => {
    mockReadGroupFile.mockResolvedValue("file content");
    const result = await executeTool(
      {},
      "read_file",
      { path: "test.txt" },
      "group1",
    );

    expect(mockReadGroupFile).toHaveBeenCalledWith({}, "group1", "test.txt");

    expect(result).toBe("file content");
  });

  it("should post open_file event", async () => {
    const result = await executeTool(
      {},
      "open_file",
      { path: "src/app.mjs" },
      "group1",
    );

    expect(result).toBe("Opening file in viewer: src/app.mjs");

    expect(mockPost).toHaveBeenCalledWith({
      type: "open-file",
      payload: { groupId: "group1", path: "src/app.mjs" },
    });
  });

  it("should validate open_file path", async () => {
    const result = await executeTool({}, "open_file", {}, "group1");

    expect(result).toBe("Error: open_file requires a valid path string.");

    expect(mockPost).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "open-file" }),
    );
  });

  it("should handle write_file tool", async () => {
    const result = await executeTool(
      {},
      "write_file",
      { path: "test.txt", content: "hello" },
      "group1",
    );

    expect(mockWriteGroupFile).toHaveBeenCalledWith(
      {},
      "group1",
      "test.txt",
      "hello",
    );

    expect(result).toBe("Written 5 bytes to test.txt");
  });

  it("should handle list_files tool", async () => {
    mockListGroupFiles.mockResolvedValue(["file1", "file2"]);

    const result = await executeTool({}, "list_files", { path: "." }, "group1");

    expect(mockListGroupFiles).toHaveBeenCalledWith({}, "group1", ".");

    expect(result).toBe("file1\nfile2");
  });

  it("should handle list_files tool (empty)", async () => {
    mockListGroupFiles.mockResolvedValue([]);

    const result = await executeTool({}, "list_files", {}, "group1");

    expect(result).toBe("(empty directory)");
  });

  it("should handle fetch_url tool (GET)", async () => {
    const mockResponse = {
      ok: true,
      text: jest.fn().mockResolvedValue("<html>body</html>"),
      headers: { get: jest.fn().mockReturnValue("text/html") },
      status: 200,
      statusText: "OK",
    };

    global.fetch = jest.fn().mockResolvedValue(mockResponse);

    const result = await executeTool(
      {},
      "fetch_url",
      { url: "http://example.com" },
      "group1",
    );

    expect(global.fetch).toHaveBeenCalledWith("http://example.com", {
      method: "GET",
      headers: {},
      body: undefined,
    });

    expect(mockStripHtml).toHaveBeenCalledWith("<html>body</html>");

    expect(result).toContain("[HTTP 200 OK]");
  });

  it("should handle fetch_url tool (POST, error)", async () => {
    const mockResponse = {
      ok: false,
      text: jest.fn().mockResolvedValue("Error body"),
      headers: { get: jest.fn().mockReturnValue("text/plain") },
      status: 404,
      statusText: "Not Found",
    };

    global.fetch = jest.fn().mockResolvedValue(mockResponse);

    const result = await executeTool(
      {},
      "fetch_url",
      {
        url: "http://example.com",
        method: "POST",
        body: "data",
      },
      "group1",
    );

    expect(result).toContain("Error fetching URL");

    expect(result).toContain("Error body");
  });

  it("should handle fetch_url network error", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("connection reset"));

    const result = await executeTool(
      {},
      "fetch_url",
      { url: "http://example.com" },
      "group1",
    );

    expect(result).toContain(
      "Network Error: Failed to fetch http://example.com",
    );

    expect(result).toContain("connection reset");
  });

  it("should handle update_memory tool", async () => {
    const result = await executeTool(
      {},
      "update_memory",
      { content: "mem" },
      "group1",
    );

    expect(mockWriteGroupFile).toHaveBeenCalledWith(
      {},
      "group1",
      "MEMORY.md",
      "mem",
    );

    expect(result).toBe("Memory updated successfully.");
  });

  it("should handle create_task tool", async () => {
    const result = await executeTool(
      {},
      "create_task",
      { schedule: "*/5 * * * *", prompt: "ping" },
      "group1",
    );

    expect(mockUlid).toHaveBeenCalled();

    expect(mockPost).toHaveBeenCalledWith(
      expect.objectContaining({ type: "task-created" }),
    );

    expect(result).toContain("Task created successfully.");
  });

  it("should handle javascript tool", async () => {
    const result = await executeTool(
      {},
      "javascript",
      { code: "1+1" },
      "group1",
    );

    expect(result).toBe("2");
  });

  it("should handle javascript tool null and undefined results", async () => {
    await expect(
      executeTool({}, "javascript", { code: "undefined" }, "group1"),
    ).resolves.toBe("(no return value)");

    await expect(
      executeTool({}, "javascript", { code: "null" }, "group1"),
    ).resolves.toBe("null");
  });

  it("should handle javascript tool object stringify fallback", async () => {
    const result = await executeTool(
      {},
      "javascript",
      { code: "const x = {}; x.self = x; x;" },
      "group1",
    );

    expect(result).toBe("[object Object]");
  });

  it("should handle list_tasks tool", async () => {
    mockGetAllTasks.mockResolvedValue([
      { id: "1", groupId: "group1", schedule: "*", prompt: "p", enabled: true },
      {
        id: "2",
        groupId: "group2",
        schedule: "*",
        prompt: "q",
        enabled: false,
      },
    ]);

    const result = await executeTool({}, "list_tasks", {}, "group1");
    expect(result).toContain("[ID: 1] Schedule: *, Prompt: p, Enabled: true");
    expect(result).not.toContain("ID: 2");
  });

  it("should handle list_tasks tool with no tasks", async () => {
    mockGetAllTasks.mockResolvedValue([]);
    await expect(executeTool({}, "list_tasks", {}, "group1")).resolves.toBe(
      "No tasks found for this group.",
    );
  });

  it("should update an existing task", async () => {
    const task = {
      id: "t1",
      schedule: "* * * * *",
      prompt: "old",
      enabled: true,
    };
    mockGetAllTasks.mockResolvedValue([
      {
        ...task,
        groupId: "group1",
      },
    ]);

    const promise = executeTool(
      {},
      "update_task",
      { id: "t1", schedule: "*/5 * * * *", prompt: "new", enabled: 0 },
      "group1",
    );

    await expect(promise).resolves.toBe("Task t1 updated successfully.");

    expect(mockPost).toHaveBeenCalledWith({
      type: "update-task",
      payload: {
        task: {
          id: "t1",
          groupId: "group1",
          schedule: "*/5 * * * *",
          prompt: "new",
          enabled: false,
        },
      },
    });
  });

  it("should return an error when update_task target is missing", async () => {
    mockGetAllTasks.mockResolvedValue([{ id: "other", groupId: "group1" }]);
    const promise = executeTool({}, "update_task", { id: "missing" }, "group1");

    await expect(promise).resolves.toBe(
      "Error: Task with ID missing not found.",
    );
  });

  it("should enable a task", async () => {
    const task = { id: "t2", enabled: false };
    mockGetAllTasks.mockResolvedValue([{ ...task, groupId: "group1" }]);
    const promise = executeTool({}, "enable_task", { id: "t2" }, "group1");

    await expect(promise).resolves.toBe("Task t2 enabled successfully.");

    expect(mockPost).toHaveBeenCalledWith({
      type: "update-task",
      payload: { task: { id: "t2", groupId: "group1", enabled: true } },
    });
  });

  it("should disable a task", async () => {
    const task = { id: "t3", enabled: true };
    mockGetAllTasks.mockResolvedValue([{ ...task, groupId: "group1" }]);
    const promise = executeTool({}, "disable_task", { id: "t3" }, "group1");

    await expect(promise).resolves.toBe("Task t3 disabled successfully.");

    expect(mockPost).toHaveBeenCalledWith({
      type: "update-task",
      payload: { task: { id: "t3", groupId: "group1", enabled: false } },
    });
  });

  it("should post delete_task event", async () => {
    const result = await executeTool(
      {},
      "delete_task",
      { id: "task-5" },
      "group1",
    );

    expect(result).toBe("Task task-5 deleted successfully.");

    expect(mockPost).toHaveBeenCalledWith({
      type: "delete-task",
      payload: { id: "task-5" },
    });
  });

  it("should post clear_chat event", async () => {
    const result = await executeTool({}, "clear_chat", {}, "group1");

    expect(result).toBe(
      "Chat history cleared successfully. New session started.",
    );

    expect(mockPost).toHaveBeenCalledWith({
      type: "clear-chat",
      payload: { groupId: "group1" },
    });
  });

  it("should post show_toast event", async () => {
    const result = await executeTool(
      {},
      "show_toast",
      { message: "Saved", type: "success", duration: 2500 },
      "group1",
    );

    expect(result).toBe("Toast notification sent: Saved");

    expect(mockPost).toHaveBeenCalledWith({
      type: "show-toast",
      payload: {
        message: "Saved",
        type: "success",
        duration: 2500,
      },
    });
  });

  it("should return an error when git_push has no configured token", async () => {
    mockGetConfig.mockResolvedValue(null);

    const result = await executeTool(
      {},
      "git_push",
      { repo: "demo", branch: "main" },
      "group1",
    );

    expect(result).toContain("No git token configured");

    expect(mockGitPush).not.toHaveBeenCalled();
  });

  it("should clone a repo and sync it to workspace", async () => {
    mockGetConfig.mockImplementation(async (_db, key) =>
      key === "git-cors-proxy" ? "public" : null,
    );
    mockGitClone.mockResolvedValue("demo-repo");

    const result = await executeTool(
      {},
      "git_clone",
      { url: "https://github.com/x/y.git", branch: "main", include_git: true },
      "group1",
    );

    expect(mockGitClone).toHaveBeenCalledWith({
      url: "https://github.com/x/y.git",
      branch: "main",
      depth: undefined,
      corsProxy: "https://proxy.local",
    });

    expect(mockSyncLfsToOpfs).toHaveBeenCalledWith(
      {},
      "group1",
      "demo-repo",
      "repos/demo-repo",
      true,
    );

    expect(result).toContain(
      'Cloned https://github.com/x/y.git as "demo-repo"',
    );
  });

  it("should handle git_sync push and pull", async () => {
    await expect(
      executeTool(
        {},
        "git_sync",
        { repo: "demo", direction: "push", include_git: true },
        "group1",
      ),
    ).resolves.toContain("Synced workspace files in repos/demo");

    expect(mockSyncOpfsToLfs).toHaveBeenCalledWith(
      {},
      "group1",
      "repos/demo",
      "demo",
      true,
    );

    await expect(
      executeTool(
        {},
        "git_sync",
        { repo: "demo", direction: "pull" },
        "group1",
      ),
    ).resolves.toContain("Synced git clone files to workspace repos/demo");

    expect(mockSyncLfsToOpfs).toHaveBeenCalledWith(
      {},
      "group1",
      "demo",
      "repos/demo",
      false,
    );
  });

  it("should handle git_checkout", async () => {
    mockGitCheckout.mockResolvedValue("Checked out main");

    await expect(
      executeTool({}, "git_checkout", { repo: "demo", ref: "main" }, "group1"),
    ).resolves.toBe("Checked out main");

    expect(mockSyncLfsToOpfs).toHaveBeenCalledWith(
      {},
      "group1",
      "demo",
      "repos/demo",
    );
  });

  it("should handle git_status even when OPFS sync fails", async () => {
    mockSyncOpfsToLfs.mockRejectedValueOnce(new Error("missing dir"));
    mockGitStatus.mockResolvedValue("clean");

    await expect(
      executeTool({}, "git_status", { repo: "demo" }, "group1"),
    ).resolves.toBe("clean");

    expect(mockGitStatus).toHaveBeenCalledWith({ repo: "demo" });
  });

  it("should handle git_add", async () => {
    mockGitAdd.mockResolvedValue("added file.txt");

    await expect(
      executeTool(
        {},
        "git_add",
        { repo: "demo", filepath: "file.txt" },
        "group1",
      ),
    ).resolves.toBe("added file.txt");

    expect(mockGitAdd).toHaveBeenCalledWith({
      repo: "demo",
      filepath: "file.txt",
    });
  });

  it("should handle git_log", async () => {
    mockGitLog.mockResolvedValue("commit list");

    await expect(
      executeTool(
        {},
        "git_log",
        { repo: "demo", ref: "main", depth: 5 },
        "group1",
      ),
    ).resolves.toBe("commit list");

    expect(mockGitLog).toHaveBeenCalledWith({
      repo: "demo",
      ref: "main",
      depth: 5,
    });
  });

  it("should handle git_diff", async () => {
    mockGitDiff.mockResolvedValue("diff output");

    await expect(
      executeTool(
        {},
        "git_diff",
        { repo: "demo", ref1: "a", ref2: "b" },
        "group1",
      ),
    ).resolves.toBe("diff output");

    expect(mockGitDiff).toHaveBeenCalledWith({
      repo: "demo",
      ref1: "a",
      ref2: "b",
    });
  });

  it("should handle git_branches and git_list_repos", async () => {
    mockGitListBranches.mockResolvedValue("main\nfeature");
    mockGitListRepos.mockResolvedValue("demo");

    await expect(
      executeTool({}, "git_branches", { repo: "demo", remote: true }, "group1"),
    ).resolves.toBe("main\nfeature");

    expect(mockGitListBranches).toHaveBeenCalledWith({
      repo: "demo",
      remote: true,
    });

    await expect(executeTool({}, "git_list_repos", {}, "group1")).resolves.toBe(
      "demo",
    );

    expect(mockGitListRepos).toHaveBeenCalled();
  });

  it("should return sync error message for git_commit when workspace sync fails", async () => {
    mockSyncOpfsToLfs.mockRejectedValueOnce(new Error("sync failed"));

    const result = await executeTool(
      {},
      "git_commit",
      { repo: "demo", message: "msg" },
      "group1",
    );

    expect(result).toContain("Could not sync from OPFS");

    expect(mockGitCommit).not.toHaveBeenCalled();
  });

  it("should commit using stored author defaults", async () => {
    mockGetConfig.mockImplementation(async (_db, key) => {
      if (key === "git-author-name") return "Jane Dev";
      if (key === "git-author-email") return "jane@example.com";
      return null;
    });
    mockGitCommit.mockResolvedValue("committed");

    await expect(
      executeTool({}, "git_commit", { repo: "demo", message: "msg" }, "group1"),
    ).resolves.toBe("committed");

    expect(mockGitCommit).toHaveBeenCalledWith({
      repo: "demo",
      message: "msg",
      authorName: "Jane Dev",
      authorEmail: "jane@example.com",
    });
  });

  it("should pull using decrypted token and author defaults", async () => {
    mockGetConfig.mockImplementation(async (_db, key) => {
      if (key === "git-token") return "encrypted-token";
      if (key === "git-cors-proxy") return "public";
      if (key === "git-author-name") return "Jane Dev";
      if (key === "git-author-email") return "jane@example.com";
      return null;
    });
    mockDecryptValue.mockResolvedValue("plaintext-token");
    mockGitPull.mockResolvedValue("pulled");

    await expect(
      executeTool({}, "git_pull", { repo: "demo", branch: "main" }, "group1"),
    ).resolves.toBe("pulled");

    expect(mockGitPull).toHaveBeenCalledWith({
      repo: "demo",
      branch: "main",
      authorName: "Jane Dev",
      authorEmail: "jane@example.com",
      token: "plaintext-token",
      corsProxy: "https://proxy.local",
    });
  });

  it("should push using decrypted token and proxy", async () => {
    mockGetConfig.mockImplementation(async (_db, key) => {
      if (key === "git-token") return "encrypted-token";
      if (key === "git-cors-proxy") return "public";
      return null;
    });
    mockDecryptValue.mockResolvedValue("plaintext-token");
    mockGitPush.mockResolvedValue("pushed");

    await expect(
      executeTool(
        {},
        "git_push",
        { repo: "demo", branch: "main", force: true },
        "group1",
      ),
    ).resolves.toBe("pushed");

    expect(mockGitPush).toHaveBeenCalledWith({
      repo: "demo",
      branch: "main",
      force: true,
      token: "plaintext-token",
      corsProxy: "https://proxy.local",
    });
  });

  it("should handle unknown tool", async () => {
    const result = await executeTool({}, "unknown", {}, "group1");

    expect(result).toBe("Unknown tool: unknown");
  });

  it("should handle tool error", async () => {
    mockReadGroupFile.mockRejectedValue(new Error("fail"));

    const result = await executeTool({}, "read_file", { path: "x" }, "group1");

    expect(result).toContain("Tool error (read_file): fail");
  });
});
