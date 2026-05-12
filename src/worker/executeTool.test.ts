// @ts-nocheck
import { jest } from "@jest/globals";

let executeTool: any;
let resolveMcpReauth: any;

describe("executeTool.js", () => {
  let mockBootVM;
  let mockExecuteInVM;
  let mockExecuteShell;
  let mockFormatShellOutput;
  let mockGetVMBootModePreference;
  let mockGetVMStatus;
  let mockIsVMReady;
  let mockListGroupFiles;
  let mockGroupFileExists;
  let mockGetAllTasks;
  let mockPost;
  let mockReadGroupFile;
  let mockReadGroupFileBytes;
  let mockSandboxedEval;
  let mockStripHtml;
  let mockUlid;
  let mockWriteGroupFile;
  let mockWriteGroupFileBytes;
  let mockGetConfig;
  let mockGitAdd;
  let mockGitBranch;
  let mockGitCheckout;
  let mockGitClone;
  let mockGitCommit;
  let mockGitDeleteRepo;
  let mockGitDiff;
  let mockGitListBranches;
  let mockGitListRepos;
  let mockGitLog;
  let mockGitMerge;
  let mockGitPull;
  let mockGitPush;
  let mockGitReset;
  let mockGitStatus;
  let mockGetProxyUrl;
  let mockGetRemoteUrl;
  let mockDecryptValue;
  let mockEncryptValue;
  let mockResolveGitCredentials;
  let mockResolveServiceCredentials;
  let mockSyncLfsToOpfs;
  let mockSyncOpfsToLfs;
  let mockListRemoteMcpTools;
  let mockCallRemoteMcpTool;

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
    mockGroupFileExists = jest.fn(() => true);
    mockGetAllTasks = (jest.fn() as any).mockResolvedValue([]);
    mockPost = jest.fn();
    mockReadGroupFile = jest.fn();
    mockReadGroupFileBytes = jest.fn();
    mockSandboxedEval = jest.fn();
    mockStripHtml = jest.fn((html) => html.replace(/<[^>]*>/g, ""));
    mockUlid = jest.fn(() => "mock-ulid");
    mockWriteGroupFile = jest.fn();
    mockWriteGroupFileBytes = jest.fn();
    mockGetConfig = jest.fn();
    mockGitAdd = jest.fn();
    mockGitBranch = jest.fn();
    mockGitCheckout = jest.fn();
    mockGitClone = jest.fn();
    mockGitCommit = jest.fn();
    mockGitDeleteRepo = jest.fn();
    mockGitDiff = jest.fn();
    mockGitListBranches = jest.fn();
    mockGitListRepos = jest.fn();
    mockGitLog = jest.fn();
    mockGitMerge = jest.fn();
    mockGitPull = jest.fn();
    mockGitPush = jest.fn();
    mockGitReset = jest.fn();
    mockGitStatus = jest.fn();
    mockGetProxyUrl = jest.fn(() => "https://proxy.local");
    mockGetRemoteUrl = (jest.fn() as any).mockResolvedValue(undefined);
    mockDecryptValue = jest.fn();
    mockEncryptValue = jest.fn(async (value) => `enc:${value}`);
    mockResolveGitCredentials = (jest.fn() as any).mockResolvedValue({
      token: undefined,
      username: undefined,
      password: undefined,
      authorName: undefined,
      authorEmail: undefined,
    });
    mockResolveServiceCredentials = (jest.fn() as any).mockResolvedValue(
      undefined,
    );
    mockSyncLfsToOpfs = jest.fn();
    mockSyncOpfsToLfs = jest.fn();
    mockListRemoteMcpTools = jest.fn();
    mockCallRemoteMcpTool = jest.fn();

    jest.unstable_mockModule("../config.js", () => ({
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
        TOOL_PROFILES: "tool_profiles",
      },
      DEFAULT_DEV_HOST: "localhost",
      DEFAULT_DEV_PORT: 8888,
    }));

    jest.unstable_mockModule("../db/getConfig.js", () => ({
      getConfig: mockGetConfig,
    }));

    jest.unstable_mockModule("../db/getAllTasks.js", () => ({
      getAllTasks: mockGetAllTasks,
    }));

    jest.unstable_mockModule("../crypto.js", () => ({
      decryptValue: mockDecryptValue,
      encryptValue: mockEncryptValue,
    }));

    jest.unstable_mockModule("../git/git.js", () => ({
      gitAdd: mockGitAdd,
      gitCheckout: mockGitCheckout,
      gitClone: mockGitClone,
      gitCommit: mockGitCommit,
      gitDiff: mockGitDiff,
      gitListBranches: mockGitListBranches,
      gitListRepos: mockGitListRepos,
      gitLog: mockGitLog,
      gitMerge: mockGitMerge,
      gitPull: mockGitPull,
      gitPush: mockGitPush,
      gitReset: mockGitReset,
      gitStatus: mockGitStatus,
      gitBranch: mockGitBranch,
      gitDeleteRepo: mockGitDeleteRepo,
      getProxyUrl: mockGetProxyUrl,
      getRemoteUrl: mockGetRemoteUrl,
    }));

    jest.unstable_mockModule("../git/sync.js", () => ({
      syncLfsToOpfs: mockSyncLfsToOpfs,
      syncOpfsToLfs: mockSyncOpfsToLfs,
    }));

    jest.unstable_mockModule("../accounts/service-accounts.js", () => ({
      resolveServiceCredentials: mockResolveServiceCredentials,
    }));

    jest.unstable_mockModule("../git/credentials.js", () => ({
      resolveGitCredentials: mockResolveGitCredentials,
      buildAuthHeaders: jest.fn((creds) => {
        if (creds.token) {
          return { Authorization: `token ${creds.token}` };
        }

        return {};
      }),
    }));

    jest.unstable_mockModule("../remote-mcp-client.js", () => ({
      listRemoteMcpTools: mockListRemoteMcpTools,
      callRemoteMcpTool: mockCallRemoteMcpTool,
      McpReauthRequiredError: class McpReauthRequiredError extends Error {
        connectionId: string;
        constructor(connectionId: string) {
          super("OAuth reconnect required for remote MCP connection");
          this.name = "McpReauthRequiredError";
          this.connectionId = connectionId;
        }
      },
    }));

    jest.unstable_mockModule("../vm.js", () => ({
      bootVM: mockBootVM,
      executeInVM: mockExecuteInVM,
      getVMBootModePreference: mockGetVMBootModePreference,
      getVMStatus: mockGetVMStatus,
      isVMReady: mockIsVMReady,
    }));

    jest.unstable_mockModule("../shell/shell.js", () => ({
      executeShell: mockExecuteShell,
    }));

    jest.unstable_mockModule("../storage/listGroupFiles.js", () => ({
      listGroupFiles: mockListGroupFiles,
    }));
    jest.unstable_mockModule("../storage/groupFileExists.js", () => ({
      groupFileExists: mockGroupFileExists,
    }));

    jest.unstable_mockModule("../storage/readGroupFile.js", () => ({
      readGroupFile: mockReadGroupFile,
    }));

    jest.unstable_mockModule("../storage/readGroupFileBytes.js", () => ({
      readGroupFileBytes: mockReadGroupFileBytes,
    }));

    jest.unstable_mockModule("../storage/writeGroupFile.js", () => ({
      writeGroupFile: mockWriteGroupFile,
    }));

    jest.unstable_mockModule("../storage/writeGroupFileBytes.js", () => ({
      writeGroupFileBytes: mockWriteGroupFileBytes,
    }));

    jest.unstable_mockModule("../ulid.js", () => ({
      ulid: mockUlid,
    }));

    jest.unstable_mockModule("./post.js", () => ({
      post: mockPost,
    }));

    jest.unstable_mockModule("./formatShellOutput.js", () => ({
      formatShellOutput: mockFormatShellOutput,
    }));

    jest.unstable_mockModule("./sandboxedEval.js", () => ({
      sandboxedEval: mockSandboxedEval,
    }));

    jest.unstable_mockModule("./stripHtml.js", () => ({
      stripHtml: mockStripHtml,
    }));

    // Mock withRetry to pass through the function call without actual retries.
    // This keeps executeTool tests focused; retry logic is tested in withRetry.test.mjs.
    jest.unstable_mockModule("./withRetry.js", () => ({
      withRetry: jest.fn(async (fn) => fn()),
      isRetryableFetchError: jest.fn(() => false),
      isRetryableHttpError: jest.fn(() => false),
      RETRYABLE_STATUS_CODES: new Set([408, 429, 500, 502, 503, 504]),
    }));

    delete (global as any).fetch;

    const module = await import("./executeTool.js");
    executeTool = module.executeTool;
    resolveMcpReauth = module.resolveMcpReauth;
  });

  it("should handle bash tool", async () => {
    (mockExecuteInVM as any).mockResolvedValue("vm output");

    const result = await executeTool(
      {} as any,
      "bash",
      { command: "ls" },
      "group1",
    );

    expect(mockExecuteInVM).toHaveBeenCalledWith("ls", 120, {
      db: {},
      groupId: "group1",
    });

    expect(result).toBe("vm output");
  });

  it("should clamp bash timeout to 1800 seconds", async () => {
    (mockExecuteInVM as any).mockResolvedValue("vm output");

    await executeTool(
      {} as any,
      "bash",
      { command: "ls", timeout: 999 },
      "group1",
    );

    expect(mockExecuteInVM).toHaveBeenCalledWith("ls", 999, {
      db: {},
      groupId: "group1",
    });
  });

  it("should cap bash timeout to 1800 seconds", async () => {
    (mockExecuteInVM as any).mockResolvedValue("vm output");

    await executeTool(
      {} as any,
      "bash",
      { command: "ls", timeout: 9_999 },
      "group1",
    );

    expect(mockExecuteInVM).toHaveBeenCalledWith("ls", 1800, {
      db: {},
      groupId: "group1",
    });
  });

  it("should use configured VM bash timeout when input timeout is omitted", async () => {
    (mockGetConfig as any).mockResolvedValue("600");
    (mockExecuteInVM as any).mockResolvedValue("vm output");

    await executeTool({} as any, "bash", { command: "ls" }, "group1");

    expect(mockExecuteInVM).toHaveBeenCalledWith("ls", 600, {
      db: {},
      groupId: "group1",
    });
  });

  it("should prefer explicit bash timeout over configured VM default", async () => {
    (mockGetConfig as any).mockResolvedValue("600");
    (mockExecuteInVM as any).mockResolvedValue("vm output");

    await executeTool(
      {} as any,
      "bash",
      { command: "ls", timeout: 45 },
      "group1",
    );

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

    (mockGetVMStatus as any).mockReturnValue({
      ready: false,
      booting: true,
      bootAttempted: true,
      error: null,
    });

    (mockExecuteInVM as any).mockResolvedValue("booted output");

    const result = await executeTool(
      {} as any,
      "bash",
      { command: "wget" },
      "group1",
    );

    expect(mockBootVM).toHaveBeenCalledTimes(1);

    expect(mockExecuteInVM).toHaveBeenCalledWith("wget", 120, {
      db: {},
      groupId: "group1",
    });

    expect(result).toBe("booted output");
  });

  it("uses JS shell emulator when VM mode is disabled", async () => {
    (mockGetVMBootModePreference as any).mockReturnValue("disabled");
    (mockIsVMReady as any).mockReturnValue(false);
    (mockExecuteShell as any).mockResolvedValue({
      stdout: "shell fallback output",
      stderr: "",
      exitCode: 0,
    });
    (mockFormatShellOutput as any).mockReturnValue("shell fallback output");

    const result = await executeTool(
      {},
      "bash",
      { command: "wget", timeout: 1 },
      "group1",
    );

    expect(mockBootVM).not.toHaveBeenCalled();
    expect(mockExecuteInVM).not.toHaveBeenCalled();
    expect(mockExecuteShell).toHaveBeenCalledWith(
      {} as any,
      "wget",
      "group1",
      {},
      1,
    );
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
    (mockIsVMReady as any).mockReturnValue(false);
    (mockGetVMStatus as any).mockReturnValue({
      ready: false,
      booting: false,
      bootAttempted: true,
      error: "Assets missing",
    });
    (mockExecuteShell as any).mockResolvedValue({
      stdout: "shell fallback output",
      stderr: "",
      exitCode: 0,
    });
    (mockFormatShellOutput as any).mockReturnValue("shell fallback output");

    const result = await executeTool(
      {},
      "bash",
      { command: "wget", timeout: 1 },
      "group1",
    );

    expect(mockBootVM).toHaveBeenCalledTimes(1);

    expect(mockExecuteInVM).not.toHaveBeenCalled();
    expect(mockExecuteShell).toHaveBeenCalledWith(
      {} as any,
      "wget",
      "group1",
      {},
      1,
    );
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
    (mockIsVMReady as any).mockReturnValue(false);
    (mockGetVMStatus as any).mockReturnValue({
      ready: false,
      booting: false,
      bootAttempted: true,
      error: "Assets missing",
    });
    (mockExecuteShell as any).mockResolvedValue({
      stdout: "shell fallback output",
      stderr: "",
      exitCode: 0,
    });
    (mockFormatShellOutput as any).mockReturnValue("shell fallback output");

    const first = await executeTool(
      {} as any,
      "bash",
      { command: "date" },
      "group1",
    );
    expect(first).toBe("shell fallback output");

    (mockIsVMReady as any).mockReturnValue(true);
    (mockExecuteInVM as any).mockResolvedValue("vm output");

    const second = await executeTool(
      {} as any,
      "bash",
      { command: "date" },
      "group1",
    );
    expect(second).toBe("vm output");
    expect(mockExecuteInVM).toHaveBeenCalledWith("date", 120, {
      db: {},
      groupId: "group1",
    });
  });

  it("should handle read_file tool", async () => {
    (mockReadGroupFile as any).mockResolvedValue("file content");
    const result = await executeTool(
      {},
      "read_file",
      { path: "test.txt" },
      "group1",
    );

    expect(mockReadGroupFile).toHaveBeenCalledWith(
      {} as any,
      "group1",
      "test.txt",
    );

    expect(result).toBe("file content");
  });

  it("should handle read_file with multiple paths", async () => {
    mockReadGroupFile
      .mockResolvedValueOnce("content of file A")
      .mockResolvedValueOnce("content of file B")
      .mockResolvedValueOnce("content of file C");

    const result = await executeTool(
      {},
      "read_file",
      { paths: ["a.js", "b.js", "c.js"] },
      "group1",
    );

    expect(mockReadGroupFile).toHaveBeenCalledTimes(3);
    expect(mockReadGroupFile).toHaveBeenCalledWith({} as any, "group1", "a.js");
    expect(mockReadGroupFile).toHaveBeenCalledWith({} as any, "group1", "b.js");
    expect(mockReadGroupFile).toHaveBeenCalledWith({} as any, "group1", "c.js");

    expect(result).toContain("--- a.js ---");
    expect(result).toContain("content of file A");
    expect(result).toContain("--- b.js ---");
    expect(result).toContain("content of file B");
    expect(result).toContain("--- c.js ---");
    expect(result).toContain("content of file C");
  });

  it("should handle read_file with paths where some files fail", async () => {
    mockReadGroupFile
      .mockResolvedValueOnce("content of good file")
      .mockRejectedValueOnce(new Error("File not found: missing.js"));

    const result = await executeTool(
      {},
      "read_file",
      { paths: ["good.js", "missing.js"] },
      "group1",
    );

    expect(result).toContain("--- good.js ---");
    expect(result).toContain("content of good file");
    expect(result).toContain("--- missing.js ---");
    expect(result).toContain("Error reading missing.js");
  });

  it("should handle read_file with paths preferring paths over path", async () => {
    (mockReadGroupFile as any).mockResolvedValue("multi content");

    const result = await executeTool(
      {},
      "read_file",
      { path: "ignored.js", paths: ["used.js"] },
      "group1",
    );

    expect(mockReadGroupFile).toHaveBeenCalledWith(
      {} as any,
      "group1",
      "used.js",
    );
    expect(mockReadGroupFile).not.toHaveBeenCalledWith(
      {},
      "group1",
      "ignored.js",
    );
  });

  it("should post open_file event", async () => {
    const result = await executeTool(
      {},
      "open_file",
      { path: "src/app.js" },
      "group1",
    );

    expect(result).toBe("Opening file in viewer: src/app.js");

    expect(mockPost).toHaveBeenCalledWith({
      type: "open-file",
      payload: { groupId: "group1", path: "src/app.js" },
    });
  });

  it("should validate open_file path", async () => {
    const result = await executeTool({} as any, "open_file", {}, "group1");

    expect(result).toBe("Error: open_file requires a valid path string.");

    expect(mockPost).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "open-file" }),
    );
  });

  it("should fail open_file if the file does not exist", async () => {
    mockGroupFileExists.mockResolvedValue(false);

    const result = await executeTool(
      {} as any,
      "open_file",
      { path: "missing.html" },
      "group1",
    );

    expect(result).toBe("Error: file not found: missing.html");
    expect(mockPost).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "open-file" }),
    );
  });

  it("should prepare image markdown via attach_file_to_chat", async () => {
    (mockReadGroupFile as any).mockResolvedValue("binary-content-placeholder");

    const result = await executeTool(
      {},
      "attach_file_to_chat",
      { path: "/assets/key-images/TheLamb-NT-Jesus.png", alt: "The Lamb" },
      "group1",
    );

    expect(mockReadGroupFile).toHaveBeenCalledWith(
      {} as any,
      "group1",
      "assets/key-images/TheLamb-NT-Jesus.png",
    );
    expect(result).toContain(
      "![The Lamb](assets/key-images/TheLamb-NT-Jesus.png)",
    );
    expect(mockPost).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "intermediate-response" }),
    );
  });

  it("should validate attach_file_to_chat path", async () => {
    const result = await executeTool(
      {} as any,
      "attach_file_to_chat",
      {},
      "group1",
    );

    expect(result).toBe(
      "Error: attach_file_to_chat requires a valid path string.",
    );
  });

  it("should reject traversal in attach_file_to_chat path", async () => {
    const result = await executeTool(
      {} as any,
      "attach_file_to_chat",
      { path: "../secret.png" },
      "group1",
    );

    expect(result).toBe(
      "Error: attach_file_to_chat path cannot contain '..' segments.",
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
    (mockListGroupFiles as any).mockResolvedValue(["file1", "file2"]);

    const result = await executeTool(
      {} as any,
      "list_files",
      { path: "." },
      "group1",
    );

    expect(mockListGroupFiles).toHaveBeenCalledWith({} as any, "group1", ".");

    expect(result).toBe("file1\nfile2");
  });

  it("should handle list_files tool (empty)", async () => {
    (mockListGroupFiles as any).mockResolvedValue([]);

    const result = await executeTool({} as any, "list_files", {}, "group1");

    expect(result).toBe("(empty directory)");
  });

  it("should handle fetch_url tool (GET)", async () => {
    const mockResponse: any = {
      ok: true,
      text: (jest.fn() as any).mockResolvedValue("<html>body</html>"),
      headers: { get: jest.fn().mockReturnValue("text/html") },
      status: 200,
      statusText: "OK",
    };

    (global as any).fetch = (jest.fn() as any).mockResolvedValue(mockResponse);

    const result = await executeTool(
      {},
      "fetch_url",
      { url: "http://example.com" },
      "group1",
    );

    expect((global as any).fetch).toHaveBeenCalledWith("http://example.com", {
      method: "GET",
      headers: {},
      body: undefined,
    });

    expect(mockStripHtml).toHaveBeenCalledWith("<html>body</html>");

    expect(result).toContain("[HTTP 200 OK]");
  });

  it("should include headers in fetch_url when include_headers is true", async () => {
    const mockResponse: any = {
      ok: true,
      text: (jest.fn() as any).mockResolvedValue("body"),
      headers: new Map([
        ["content-type", "text/plain"],
        ["x-custom-header", "custom-value"],
      ]),
      status: 200,
      statusText: "OK",
    };

    (global as any).fetch = (jest.fn() as any).mockResolvedValue(mockResponse);

    const result = await executeTool(
      {},
      "fetch_url",
      {
        url: "http://example.com",
        headers: { "X-Request": "req-value" },
        include_headers: true,
      },
      "group1",
    );

    expect(result).toContain("--- Request Headers ---");
    expect(result).toContain("X-Request: req-value");
    expect(result).toContain("--- Response Headers ---");
    expect(result).toContain("content-type: text/plain");
    expect(result).toContain("x-custom-header: custom-value");
    expect(result).toContain("body");
  });

  it("should handle fetch_url tool (POST, error)", async () => {
    const mockResponse: any = {
      ok: false,
      text: (jest.fn() as any).mockResolvedValue("Error body"),
      headers: { get: jest.fn().mockReturnValue("text/plain") },
      status: 404,
      statusText: "Not Found",
    };

    (global as any).fetch = (jest.fn() as any).mockResolvedValue(mockResponse);

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

  it("should hint to use git auth on 401 from git host", async () => {
    const mockResponse: any = {
      ok: false,
      text: (jest.fn() as any).mockResolvedValue("Must authenticate"),
      headers: { get: jest.fn().mockReturnValue("application/json") },
      status: 401,
      statusText: "Unauthorized",
    };

    (global as any).fetch = (jest.fn() as any).mockResolvedValue(mockResponse);

    const result = await executeTool(
      {},
      "fetch_url",
      { url: "https://github.com/api/v3/repos/owner/repo" },
      "group1",
    );

    expect(result).toContain("use_git_auth: true");
    expect(result).toContain("401");
  });

  it("should not hint git auth on 401 from non-git host", async () => {
    const mockResponse: any = {
      ok: false,
      text: (jest.fn() as any).mockResolvedValue("Unauthorized"),
      headers: { get: jest.fn().mockReturnValue("text/plain") },
      status: 401,
      statusText: "Unauthorized",
    };

    (global as any).fetch = (jest.fn() as any).mockResolvedValue(mockResponse);

    const result = await executeTool(
      {},
      "fetch_url",
      { url: "https://api.example.com/data" },
      "group1",
    );

    expect(result).not.toContain("use_git_auth");
  });

  it("should inject Figma header when use_account_auth is true", async () => {
    (mockResolveServiceCredentials as any).mockResolvedValue({
      token: "figma-pat-123",
      service: "Figma",
      hostPattern: "api.figma.com",
      headerName: "X-Figma-Token",
      headerValue: "figma-pat-123",
    });

    const mockResponse: any = {
      ok: true,
      text: (jest.fn() as any).mockResolvedValue('{"data":{}}'),
      headers: { get: jest.fn().mockReturnValue("application/json") },
      status: 200,
      statusText: "OK",
    };

    let capturedOptions: any;
    (global as any).fetch = jest.fn((url: string, opts: any) => {
      capturedOptions = opts;

      return Promise.resolve(mockResponse);
    });

    await executeTool(
      {},
      "fetch_url",
      { url: "https://api.figma.com/v1/files/abc", use_account_auth: true },
      "group1",
    );

    expect(capturedOptions.headers["X-Figma-Token"]).toBe("figma-pat-123");
  });

  it("should pass account selection options to service credentials resolver", async () => {
    (mockResolveServiceCredentials as any).mockResolvedValue({
      token: "oauth-token",
      service: "Example",
      hostPattern: "api.example.com",
      headerName: "Authorization",
      headerValue: "Bearer oauth-token",
    });

    const mockResponse: any = {
      ok: true,
      text: (jest.fn() as any).mockResolvedValue('{"ok":true}'),
      headers: { get: jest.fn().mockReturnValue("application/json") },
      status: 200,
      statusText: "OK",
    };
    (global as any).fetch = (jest.fn() as any).mockResolvedValue(mockResponse);

    await executeTool(
      {},
      "fetch_url",
      {
        url: "https://api.example.com/v1/me",
        use_account_auth: true,
        account_id: "svc-oauth",
        auth_mode: "oauth",
      },
      "group1",
    );

    expect(mockResolveServiceCredentials).toHaveBeenCalledWith(
      {},
      "https://api.example.com/v1/me",
      {
        accountId: "svc-oauth",
        authMode: "oauth",
      },
    );
  });

  it("should force-refresh OAuth service credentials and retry once on 401", async () => {
    (mockResolveServiceCredentials as any)
      .mockResolvedValueOnce({
        token: "stale-oauth-token",
        service: "GitHub",
        hostPattern: "api.github.com",
        headerName: "Authorization",
        headerValue: "Bearer stale-oauth-token",
        accountId: "svc-oauth",
        authMode: "oauth",
      })
      .mockResolvedValueOnce({
        token: "fresh-oauth-token",
        service: "GitHub",
        hostPattern: "api.github.com",
        headerName: "Authorization",
        headerValue: "Bearer fresh-oauth-token",
        accountId: "svc-oauth",
        authMode: "oauth",
      });

    const first401: any = {
      ok: false,
      text: (jest.fn() as any).mockResolvedValue("Unauthorized"),
      headers: { get: jest.fn().mockReturnValue("application/json") },
      status: 401,
      statusText: "Unauthorized",
    };

    const second200: any = {
      ok: true,
      text: (jest.fn() as any).mockResolvedValue('{"ok":true}'),
      headers: { get: jest.fn().mockReturnValue("application/json") },
      status: 200,
      statusText: "OK",
    };

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(first401)
      .mockResolvedValueOnce(second200);

    (global as any).fetch = fetchMock;

    const result = await executeTool(
      {},
      "fetch_url",
      {
        url: "https://api.github.com/user",
        use_account_auth: true,
        account_id: "svc-oauth",
        auth_mode: "oauth",
      },
      "group1",
    );

    expect(mockResolveServiceCredentials).toHaveBeenNthCalledWith(
      1,
      {},
      "https://api.github.com/user",
      {
        accountId: "svc-oauth",
        authMode: "oauth",
      },
    );

    expect(mockResolveServiceCredentials).toHaveBeenNthCalledWith(
      2,
      {},
      "https://api.github.com/user",
      {
        accountId: "svc-oauth",
        authMode: "oauth",
        forceRefresh: true,
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toContain('"ok":true');
  });

  it("should force-refresh OAuth service credentials and retry once on 403", async () => {
    (mockResolveServiceCredentials as any)
      .mockResolvedValueOnce({
        token: "stale-oauth-token",
        service: "Figma",
        hostPattern: "api.figma.com",
        headerName: "Authorization",
        headerValue: "Bearer stale-oauth-token",
        accountId: "svc-oauth",
        authMode: "oauth",
      })
      .mockResolvedValueOnce({
        token: "fresh-oauth-token",
        service: "Figma",
        hostPattern: "api.figma.com",
        headerName: "Authorization",
        headerValue: "Bearer fresh-oauth-token",
        accountId: "svc-oauth",
        authMode: "oauth",
      });

    const first403: any = {
      ok: false,
      text: (jest.fn() as any).mockResolvedValue("Invalid token"),
      headers: { get: jest.fn().mockReturnValue("application/json") },
      status: 403,
      statusText: "Forbidden",
    };

    const second200: any = {
      ok: true,
      text: (jest.fn() as any).mockResolvedValue('{"ok":true}'),
      headers: { get: jest.fn().mockReturnValue("application/json") },
      status: 200,
      statusText: "OK",
    };

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(first403)
      .mockResolvedValueOnce(second200);

    (global as any).fetch = fetchMock;

    const result = await executeTool(
      {},
      "fetch_url",
      {
        url: "https://api.figma.com/v1/me",
        use_account_auth: true,
        account_id: "svc-oauth",
        auth_mode: "oauth",
      },
      "group1",
    );

    expect(mockResolveServiceCredentials).toHaveBeenNthCalledWith(
      1,
      {},
      "https://api.figma.com/v1/me",
      {
        accountId: "svc-oauth",
        authMode: "oauth",
      },
    );

    expect(mockResolveServiceCredentials).toHaveBeenNthCalledWith(
      2,
      {},
      "https://api.figma.com/v1/me",
      {
        accountId: "svc-oauth",
        authMode: "oauth",
        forceRefresh: true,
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toContain('"ok":true');
  });

  it("should return reconnect-required guidance when OAuth account is flagged for reauth", async () => {
    (mockResolveServiceCredentials as any).mockResolvedValue({
      token: "",
      service: "GitHub",
      hostPattern: "api.github.com",
      headerName: "Authorization",
      headerValue: "",
      accountId: "svc-oauth",
      authMode: "oauth",
      reauthRequired: true,
    });

    const fetchMock = jest.fn();
    (global as any).fetch = fetchMock;

    const result = await executeTool(
      {},
      "fetch_url",
      {
        url: "https://api.github.com/user",
        use_account_auth: true,
        account_id: "svc-oauth",
        auth_mode: "oauth",
      },
      "group1",
    );

    expect(result).toContain("OAuth account reconnect required");
    expect(result).toContain("Connect OAuth");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should pass account selection options to git credentials resolver", async () => {
    (mockResolveGitCredentials as any).mockResolvedValue({
      token: "git-token",
      provider: "github",
    });

    const mockResponse: any = {
      ok: true,
      text: (jest.fn() as any).mockResolvedValue('{"ok":true}'),
      headers: { get: jest.fn().mockReturnValue("application/json") },
      status: 200,
      statusText: "OK",
    };
    (global as any).fetch = (jest.fn() as any).mockResolvedValue(mockResponse);

    await executeTool(
      {},
      "fetch_url",
      {
        url: "https://github.com/org/repo",
        use_git_auth: true,
        git_account_id: "git-oauth",
        auth_mode: "oauth",
      },
      "group1",
    );

    expect(mockResolveGitCredentials).toHaveBeenCalledWith(
      {},
      "https://github.com/org/repo",
      {
        accountId: "git-oauth",
        authMode: "oauth",
      },
    );
  });

  it("should return reconnect-required guidance for Git OAuth accounts flagged for reauth", async () => {
    (mockResolveGitCredentials as any).mockResolvedValue({
      token: undefined,
      provider: "github",
      hostPattern: "github.com",
      authMode: "oauth",
      reauthRequired: true,
    });

    const fetchMock = jest.fn();
    (global as any).fetch = fetchMock;

    const result = await executeTool(
      {},
      "fetch_url",
      {
        url: "https://github.com/org/repo",
        use_git_auth: true,
        git_account_id: "git-oauth",
        auth_mode: "oauth",
      },
      "group1",
    );

    expect(result).toContain("OAuth Git account reconnect required");
    expect(result).toContain("Settings -> Git");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should retry once with refreshed Git OAuth credentials after 401", async () => {
    (mockResolveGitCredentials as any)
      .mockResolvedValueOnce({
        token: "stale-token",
        provider: "github",
        hostPattern: "github.com",
        accountId: "git-oauth",
        authMode: "oauth",
      })
      .mockResolvedValueOnce({
        token: "fresh-token",
        provider: "github",
        hostPattern: "github.com",
        accountId: "git-oauth",
        authMode: "oauth",
      });

    const first401: any = {
      ok: false,
      text: (jest.fn() as any).mockResolvedValue("Unauthorized"),
      headers: { get: jest.fn().mockReturnValue("application/json") },
      status: 401,
      statusText: "Unauthorized",
    };
    const second200: any = {
      ok: true,
      text: (jest.fn() as any).mockResolvedValue('{"ok":true}'),
      headers: { get: jest.fn().mockReturnValue("application/json") },
      status: 200,
      statusText: "OK",
    };

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(first401)
      .mockResolvedValueOnce(second200);
    (global as any).fetch = fetchMock;

    const result = await executeTool(
      {},
      "fetch_url",
      {
        url: "https://github.com/org/repo",
        use_git_auth: true,
        git_account_id: "git-oauth",
        auth_mode: "oauth",
      },
      "group1",
    );

    expect(mockResolveGitCredentials).toHaveBeenNthCalledWith(
      1,
      {},
      "https://github.com/org/repo",
      {
        accountId: "git-oauth",
        authMode: "oauth",
      },
    );
    expect(mockResolveGitCredentials).toHaveBeenNthCalledWith(
      2,
      {},
      "https://github.com/org/repo",
      {
        accountId: "git-oauth",
        authMode: "oauth",
        forceRefresh: true,
      },
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toContain('"ok":true');
  });

  it("should hint use_account_auth on 401 from non-git host with saved account", async () => {
    (mockResolveServiceCredentials as any).mockResolvedValue({
      token: "figma-pat",
      service: "Figma",
      hostPattern: "api.figma.com",
      headerName: "X-Figma-Token",
      headerValue: "figma-pat",
    });

    const mockResponse: any = {
      ok: false,
      text: (jest.fn() as any).mockResolvedValue("Unauthorized"),
      headers: { get: jest.fn().mockReturnValue("text/plain") },
      status: 401,
      statusText: "Unauthorized",
    };

    (global as any).fetch = (jest.fn() as any).mockResolvedValue(mockResponse);

    const result = await executeTool(
      {},
      "fetch_url",
      { url: "https://api.figma.com/v1/files/abc" },
      "group1",
    );

    expect(result).toContain("use_account_auth: true");
    expect(result).toContain("Figma");
  });

  it("should not hint git auth when use_git_auth already true", async () => {
    const mockResponse: any = {
      ok: false,
      text: (jest.fn() as any).mockResolvedValue("Bad credentials"),
      headers: { get: jest.fn().mockReturnValue("application/json") },
      status: 401,
      statusText: "Unauthorized",
    };

    (global as any).fetch = (jest.fn() as any).mockResolvedValue(mockResponse);

    const result = await executeTool(
      {},
      "fetch_url",
      { url: "https://github.com/api/repos", use_git_auth: true },
      "group1",
    );

    expect(result).not.toContain("use_git_auth: true");
    expect(result).toContain("401");
  });

  it("should handle fetch_url network error", async () => {
    (global as any).fetch = jest
      .fn()
      .mockRejectedValue(new Error("connection reset"));

    const result = await executeTool(
      {},
      "fetch_url",
      { url: "http://example.com" },
      "group1",
    );

    expect(result).toContain("Network Error");

    expect(result).toContain("connection reset");
  });

  it("should truncate fetch_url response with indicator when body exceeds FETCH_MAX_RESPONSE", async () => {
    const longBody = "x".repeat(1500);
    const mockResponse: any = {
      ok: true,
      text: (jest.fn() as any).mockResolvedValue(longBody),
      headers: { get: jest.fn().mockReturnValue("text/plain") },
      status: 200,
      statusText: "OK",
    };

    (global as any).fetch = (jest.fn() as any).mockResolvedValue(mockResponse);

    const result = await executeTool(
      {},
      "fetch_url",
      { url: "http://example.com" },
      "group1",
    );

    expect(result).toContain("[HTTP 200 OK]");
    expect(result).toContain("--- Response truncated");
    expect(result).toContain("1,000");
    expect(result).toContain("1,500");
  });

  it("should NOT add truncation indicator when fetch_url response fits within FETCH_MAX_RESPONSE", async () => {
    const shortBody = "hello world";
    const mockResponse: any = {
      ok: true,
      text: (jest.fn() as any).mockResolvedValue(shortBody),
      headers: { get: jest.fn().mockReturnValue("text/plain") },
      status: 200,
      statusText: "OK",
    };

    (global as any).fetch = (jest.fn() as any).mockResolvedValue(mockResponse);

    const result = await executeTool(
      {},
      "fetch_url",
      { url: "http://example.com" },
      "group1",
    );

    expect(result).toContain("[HTTP 200 OK]");
    expect(result).toContain("hello world");
    expect(result).not.toContain("truncated");
  });

  it("should handle fetch_url with retryable 503 error via withRetry", async () => {
    // When withRetry is mocked to pass-through, the 503 will be thrown as HttpError
    // by the inner function. The catch block in fetch_url handles it.
    const mockResponse: any = {
      ok: false,
      text: (jest.fn() as any).mockResolvedValue("Service Unavailable"),
      headers: { get: jest.fn().mockReturnValue("text/plain") },
      status: 503,
      statusText: "Service Unavailable",
    };

    (global as any).fetch = (jest.fn() as any).mockResolvedValue(mockResponse);

    const result = await executeTool(
      {},
      "fetch_url",
      { url: "http://example.com" },
      "group1",
    );

    // Since withRetry is mocked to pass-through (no retries), the HttpError
    // is thrown and caught by the outer catch, returning an error message.
    expect(result).toContain("503");
    expect(result).toContain("after retries");
  });

  it("should detect login page in HTTP 200 response and hint auth required", async () => {
    const loginPageHtml =
      "<html><body>Sign in via LDAP Login Trouble? Check the FAQ! Username Password</body></html>";
    const mockResponse: any = {
      ok: true,
      text: (jest.fn() as any).mockResolvedValue(loginPageHtml),
      headers: { get: jest.fn().mockReturnValue("text/html") },
      status: 200,
      statusText: "OK",
    };

    (global as any).fetch = (jest.fn() as any).mockResolvedValue(mockResponse);

    const result = await executeTool(
      {},
      "fetch_url",
      { url: "https://github.com/api/v1/repos/owner/repo/issues" },
      "group1",
    );

    expect(result).toContain("login");
    expect(result).toContain("use_git_auth");
  });

  it("should not flag login-page hint when use_git_auth is already true", async () => {
    const loginPageHtml = "<html><body>Sign in Username Password</body></html>";
    const mockResponse: any = {
      ok: true,
      text: (jest.fn() as any).mockResolvedValue(loginPageHtml),
      headers: { get: jest.fn().mockReturnValue("text/html") },
      status: 200,
      statusText: "OK",
    };

    (global as any).fetch = (jest.fn() as any).mockResolvedValue(mockResponse);
    (mockResolveGitCredentials as any).mockResolvedValue({
      token: "test-token",
      provider: "generic",
    });

    const result = await executeTool(
      {},
      "fetch_url",
      {
        url: "https://github.com/api/v1/repos/owner/repo",
        use_git_auth: true,
      },
      "group1",
    );

    // Should NOT contain the "retry with use_git_auth" hint since it's already on
    expect(result).not.toContain("Retry with use_git_auth");
  });

  it("should not flag login-page hint for non-git host", async () => {
    const loginPageHtml = "<html><body>Sign in Username Password</body></html>";
    const mockResponse: any = {
      ok: true,
      text: (jest.fn() as any).mockResolvedValue(loginPageHtml),
      headers: { get: jest.fn().mockReturnValue("text/html") },
      status: 200,
      statusText: "OK",
    };

    (global as any).fetch = (jest.fn() as any).mockResolvedValue(mockResponse);

    const result = await executeTool(
      {},
      "fetch_url",
      { url: "https://myapp.example.com/login" },
      "group1",
    );

    // Non-git hosts should not get the git auth hint
    expect(result).not.toContain("use_git_auth");
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

  it("should handle javascript tool via sandboxedEval", async () => {
    (mockSandboxedEval as any).mockResolvedValue({ ok: true, value: 2 });

    const result = await executeTool(
      {},
      "javascript",
      { code: "1+1" },
      "group1",
    );

    expect(mockSandboxedEval).toHaveBeenCalledWith("1+1");
    expect(result).toBe("2");
  });

  it("should handle javascript tool null and undefined results via sandboxedEval", async () => {
    (mockSandboxedEval as any).mockResolvedValue({
      ok: true,
      value: "__UNDEFINED__",
    });

    const result = await executeTool(
      {},
      "javascript",
      { code: "undefined" },
      "group1",
    );

    expect(result).toContain("(no return value)");
    expect(result).toContain("Hint:");
    expect(mockSandboxedEval).toHaveBeenCalledWith("undefined");

    (mockSandboxedEval as any).mockResolvedValue({ ok: true, value: null });

    await expect(
      executeTool({} as any, "javascript", { code: "null" }, "group1"),
    ).resolves.toBe("null");

    expect(mockSandboxedEval).toHaveBeenCalledWith("null");
  });

  it("should handle javascript tool errors via sandboxedEval", async () => {
    (mockSandboxedEval as any).mockResolvedValue({
      ok: false,
      error: "x is not defined",
    });

    const result = await executeTool(
      {} as any,
      "javascript",
      { code: "x" },
      "group1",
    );

    expect(mockSandboxedEval).toHaveBeenCalledWith("x");
    expect(result).toBe("JavaScript error: x is not defined");
  });

  it("should handle list_tasks tool", async () => {
    (mockGetAllTasks as any).mockResolvedValue([
      { id: "1", groupId: "group1", schedule: "*", prompt: "p", enabled: true },
      {
        id: "2",
        groupId: "group2",
        schedule: "*",
        prompt: "q",
        enabled: false,
      },
    ]);

    const result = await executeTool({} as any, "list_tasks", {}, "group1");
    expect(result).toContain("[ID: 1] Schedule: *, Prompt: p, Enabled: true");
    expect(result).not.toContain("ID: 2");
  });

  it("should handle list_tasks tool with no tasks", async () => {
    (mockGetAllTasks as any).mockResolvedValue([]);
    await expect(
      executeTool({} as any, "list_tasks", {}, "group1"),
    ).resolves.toBe("No tasks found for this group.");
  });

  it("should update an existing task", async () => {
    const task: any = {
      id: "t1",
      schedule: "* * * * *",
      prompt: "old",
      enabled: true,
    };
    (mockGetAllTasks as any).mockResolvedValue([
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
    (mockGetAllTasks as any).mockResolvedValue([
      { id: "other", groupId: "group1" },
    ]);
    const promise = executeTool(
      {} as any,
      "update_task",
      { id: "missing" },
      "group1",
    );

    await expect(promise).resolves.toBe(
      "Error: Task with ID missing not found.",
    );
  });

  it("should enable a task", async () => {
    const task: any = { id: "t2", enabled: false };
    (mockGetAllTasks as any).mockResolvedValue([
      { ...task, groupId: "group1" },
    ]);
    const promise = executeTool(
      {} as any,
      "enable_task",
      { id: "t2" },
      "group1",
    );

    await expect(promise).resolves.toBe("Task t2 enabled successfully.");

    expect(mockPost).toHaveBeenCalledWith({
      type: "update-task",
      payload: { task: { id: "t2", groupId: "group1", enabled: true } },
    });
  });

  it("should disable a task", async () => {
    const task: any = { id: "t3", enabled: true };
    (mockGetAllTasks as any).mockResolvedValue([
      { ...task, groupId: "group1" },
    ]);
    const promise = executeTool(
      {} as any,
      "disable_task",
      { id: "t3" },
      "group1",
    );

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
      payload: { id: "task-5", groupId: "group1" },
    });
  });

  it("should return error when delete_task id is missing", async () => {
    const result = await executeTool({} as any, "delete_task", {}, "group1");

    expect(result).toMatch(/error/i);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("should post clear_chat event", async () => {
    const result = await executeTool({} as any, "clear_chat", {}, "group1");

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

  it("should post send_notification event with title and body", async () => {
    const result = await executeTool(
      {},
      "send_notification",
      { title: "Alert", body: "Task completed" },
      "group1",
    );

    expect(result).toBe("Push notification sent: Task completed");

    expect(mockPost).toHaveBeenCalledWith({
      type: "send-notification",
      payload: {
        title: "Alert",
        body: "Task completed",
        groupId: "group1",
      },
    });
  });

  it("should post send_notification event with default title", async () => {
    const result = await executeTool(
      {},
      "send_notification",
      { body: "Something happened" },
      "group1",
    );

    expect(result).toBe("Push notification sent: Something happened");

    expect(mockPost).toHaveBeenCalledWith({
      type: "send-notification",
      payload: {
        title: "ShadowClaw",
        body: "Something happened",
        groupId: "group1",
      },
    });
  });

  it("should list tools from remote MCP connection", async () => {
    (mockListRemoteMcpTools as any).mockResolvedValue([
      { name: "read_file", description: "Read files" },
      { name: "search" },
    ]);

    const result = await executeTool(
      {},
      "remote_mcp_list_tools",
      { connection_id: "conn-1" },
      "group1",
    );

    expect(mockListRemoteMcpTools).toHaveBeenCalledWith({}, "conn-1");
    expect(result).toContain("- read_file: Read files");
    expect(result).toContain("- search");
  });

  it("should call tool on remote MCP connection", async () => {
    (mockCallRemoteMcpTool as any).mockResolvedValue({
      content: [{ type: "text", text: "ok" }],
      isError: false,
    });

    const result = await executeTool(
      {},
      "remote_mcp_call_tool",
      {
        connection_id: "conn-1",
        tool_name: "read_file",
        arguments: { path: "README.md" },
      },
      "group1",
    );

    expect(mockCallRemoteMcpTool).toHaveBeenCalledWith(
      {},
      "conn-1",
      "read_file",
      { path: "README.md" },
    );
    expect(result).toContain('"isError": false');
  });

  it("should validate required inputs for remote MCP tools", async () => {
    await expect(
      executeTool({} as any, "remote_mcp_list_tools", {}, "group1"),
    ).resolves.toContain("requires connection_id");

    await expect(
      executeTool(
        {} as any,
        "remote_mcp_call_tool",
        { connection_id: "conn-1" },
        "group1",
      ),
    ).resolves.toContain("requires tool_name");
  });

  it("should post mcp-reauth-required when remote_mcp_list_tools throws McpReauthRequiredError", async () => {
    const { McpReauthRequiredError } = await import("../remote-mcp-client.js");
    (mockListRemoteMcpTools as any).mockRejectedValue(
      new McpReauthRequiredError("conn-oauth"),
    );

    // Simulate main thread responding with failed reconnect
    setTimeout(() => resolveMcpReauth("conn-oauth", false), 10);

    const result = await executeTool(
      {} as any,
      "remote_mcp_list_tools",
      { connection_id: "conn-oauth" },
      "group1",
    );

    expect(result).toContain("OAuth reconnect required");
    expect(mockPost).toHaveBeenCalledWith({
      type: "mcp-reauth-required",
      payload: { connectionId: "conn-oauth", groupId: "group1" },
    });
  });

  it("should post mcp-reauth-required when remote_mcp_call_tool throws McpReauthRequiredError", async () => {
    const { McpReauthRequiredError } = await import("../remote-mcp-client.js");
    (mockCallRemoteMcpTool as any).mockRejectedValue(
      new McpReauthRequiredError("conn-oauth-2"),
    );

    // Simulate main thread responding with failed reconnect
    setTimeout(() => resolveMcpReauth("conn-oauth-2", false), 10);

    const result = await executeTool(
      {} as any,
      "remote_mcp_call_tool",
      { connection_id: "conn-oauth-2", tool_name: "echo", arguments: {} },
      "group1",
    );

    expect(result).toContain("OAuth reconnect required");
    expect(mockPost).toHaveBeenCalledWith({
      type: "mcp-reauth-required",
      payload: { connectionId: "conn-oauth-2", groupId: "group1" },
    });
  });

  it("should retry remote_mcp_list_tools after successful reauth", async () => {
    const { McpReauthRequiredError } = await import("../remote-mcp-client.js");
    let callCount = 0;
    (mockListRemoteMcpTools as any).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new McpReauthRequiredError("conn-retry"));
      }

      return Promise.resolve([{ name: "tool1", description: "desc" }]);
    });

    // Simulate main thread responding with successful reconnect
    setTimeout(() => resolveMcpReauth("conn-retry", true), 10);

    const result = await executeTool(
      {} as any,
      "remote_mcp_list_tools",
      { connection_id: "conn-retry" },
      "group1",
    );

    expect(result).toContain("tool1");
    expect(callCount).toBe(2);
  });

  it("should deduplicate concurrent reauth requests for the same connectionId", async () => {
    const { McpReauthRequiredError } = await import("../remote-mcp-client.js");
    (mockListRemoteMcpTools as any).mockRejectedValue(
      new McpReauthRequiredError("conn-dedup"),
    );
    (mockCallRemoteMcpTool as any).mockRejectedValue(
      new McpReauthRequiredError("conn-dedup"),
    );

    // Simulate main thread responding with failed reconnect after a delay
    setTimeout(() => resolveMcpReauth("conn-dedup", false), 20);

    // Fire two concurrent tool calls that both trigger reauth for the same connection
    const [result1, result2] = await Promise.all([
      executeTool(
        {} as any,
        "remote_mcp_list_tools",
        { connection_id: "conn-dedup" },
        "group1",
      ),
      executeTool(
        {} as any,
        "remote_mcp_call_tool",
        { connection_id: "conn-dedup", tool_name: "echo", arguments: {} },
        "group1",
      ),
    ]);

    expect(result1).toContain("OAuth reconnect required");
    expect(result2).toContain("OAuth reconnect required");

    // Only ONE mcp-reauth-required message should have been posted
    const reauthMessages = (mockPost as any).mock.calls.filter(
      (call: any) => call[0]?.type === "mcp-reauth-required",
    );
    expect(reauthMessages).toHaveLength(1);
  });

  it("should return an error when git_push has no configured token", async () => {
    (mockGetConfig as any).mockResolvedValue(null);
    (mockResolveGitCredentials as any).mockResolvedValue({
      token: undefined,
      username: undefined,
      password: undefined,
      authorName: undefined,
      authorEmail: undefined,
    });

    const result = await executeTool(
      {},
      "git_push",
      { repo: "demo", branch: "main" },
      "group1",
    );

    expect(result).toContain("No git credentials configured");

    expect(mockGitPush).not.toHaveBeenCalled();
  });

  it("should clone a repo and sync it to workspace", async () => {
    (mockGetConfig as any).mockImplementation(async (_db, key) =>
      key === "git-cors-proxy" ? "public" : null,
    );
    (mockGitClone as any).mockResolvedValue("demo-repo");

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
    (mockGitCheckout as any).mockResolvedValue("Checked out main");

    await expect(
      executeTool(
        {} as any,
        "git_checkout",
        { repo: "demo", ref: "main" },
        "group1",
      ),
    ).resolves.toBe("Checked out main");

    expect(mockSyncLfsToOpfs).toHaveBeenCalledWith(
      {},
      "group1",
      "demo",
      "repos/demo",
    );
  });

  it("should handle git_status even when OPFS sync fails", async () => {
    (mockSyncOpfsToLfs as any).mockRejectedValueOnce(new Error("missing dir"));
    (mockGitStatus as any).mockResolvedValue("clean");

    await expect(
      executeTool({} as any, "git_status", { repo: "demo" }, "group1"),
    ).resolves.toBe("clean");

    expect(mockGitStatus).toHaveBeenCalledWith({ repo: "demo" });
  });

  it("should handle git_add", async () => {
    (mockGitAdd as any).mockResolvedValue("added file.txt");

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
    (mockGitLog as any).mockResolvedValue("commit list");

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
    (mockGitDiff as any).mockResolvedValue("diff output");

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
    (mockGitListBranches as any).mockResolvedValue("main\nfeature");
    (mockGitListRepos as any).mockResolvedValue("demo");

    await expect(
      executeTool(
        {} as any,
        "git_branches",
        { repo: "demo", remote: true },
        "group1",
      ),
    ).resolves.toBe("main\nfeature");

    expect(mockGitListBranches).toHaveBeenCalledWith({
      repo: "demo",
      remote: true,
    });

    await expect(
      executeTool({} as any, "git_list_repos", {}, "group1"),
    ).resolves.toBe("demo");

    expect(mockGitListRepos).toHaveBeenCalled();
  });

  it("should return sync error message for git_commit when workspace sync fails", async () => {
    (mockSyncOpfsToLfs as any).mockRejectedValueOnce(new Error("sync failed"));

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
    (mockGetConfig as any).mockImplementation(async (_db, key) => {
      if (key === "git-author-name") {
        return "Jane Dev";
      }

      if (key === "git-author-email") {
        return "jane@example.com";
      }

      return null;
    });
    (mockResolveGitCredentials as any).mockResolvedValue({
      token: undefined,
      username: undefined,
      password: undefined,
      authorName: undefined,
      authorEmail: undefined,
    });
    (mockGitCommit as any).mockResolvedValue("committed");

    await expect(
      executeTool(
        {} as any,
        "git_commit",
        { repo: "demo", message: "msg" },
        "group1",
      ),
    ).resolves.toBe("committed");

    expect(mockGitCommit).toHaveBeenCalledWith({
      repo: "demo",
      message: "msg",
      authorName: "Jane Dev",
      authorEmail: "jane@example.com",
    });
  });

  it("should pull using decrypted token and author defaults", async () => {
    (mockGetConfig as any).mockImplementation(async (_db, key) => {
      if (key === "git-cors-proxy") {
        return "public";
      }

      if (key === "git-author-name") {
        return "Jane Dev";
      }

      if (key === "git-author-email") {
        return "jane@example.com";
      }

      return null;
    });
    (mockResolveGitCredentials as any).mockResolvedValue({
      token: "plaintext-token",
      username: undefined,
      password: undefined,
      authorName: undefined,
      authorEmail: undefined,
    });
    (mockGitPull as any).mockResolvedValue("pulled");

    await expect(
      executeTool(
        {} as any,
        "git_pull",
        { repo: "demo", branch: "main" },
        "group1",
      ),
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
    (mockGetConfig as any).mockImplementation(async (_db, key) => {
      if (key === "git-cors-proxy") {
        return "public";
      }

      return null;
    });
    (mockResolveGitCredentials as any).mockResolvedValue({
      token: "plaintext-token",
      username: undefined,
      password: undefined,
      authorName: undefined,
      authorEmail: undefined,
    });
    (mockGitPush as any).mockResolvedValue("pushed");

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

  // ── patch_file ────────────────────────────────────────────────────

  it("should replace old_string with new_string in a file", async () => {
    (mockReadGroupFile as any).mockResolvedValue(
      "line 1\nline 2\nline 3\nline 4\n",
    );

    const result = await executeTool(
      {},
      "patch_file",
      {
        path: "test.txt",
        old_string: "line 2\nline 3",
        new_string: "line B\nline C",
      },
      "group1",
    );

    expect(mockWriteGroupFile).toHaveBeenCalledWith(
      {},
      "group1",
      "test.txt",
      "line 1\nline B\nline C\nline 4\n",
    );

    expect(result).toContain("Patched test.txt");
  });

  it("should fail when old_string is not found", async () => {
    (mockReadGroupFile as any).mockResolvedValue("line 1\nline 2\n");

    const result = await executeTool(
      {},
      "patch_file",
      { path: "test.txt", old_string: "not found", new_string: "x" },
      "group1",
    );

    expect(result).toContain("old_string not found");
    expect(mockWriteGroupFile).not.toHaveBeenCalled();
  });

  it("should fail when old_string matches multiple times", async () => {
    (mockReadGroupFile as any).mockResolvedValue("abc abc abc");

    const result = await executeTool(
      {},
      "patch_file",
      { path: "test.txt", old_string: "abc", new_string: "xyz" },
      "group1",
    );

    expect(result).toContain("multiple");
    expect(mockWriteGroupFile).not.toHaveBeenCalled();
  });

  it("should support deleting text via empty new_string", async () => {
    (mockReadGroupFile as any).mockResolvedValue(
      "keep this\nremove me\nkeep this too\n",
    );

    const result = await executeTool(
      {},
      "patch_file",
      { path: "test.txt", old_string: "remove me\n", new_string: "" },
      "group1",
    );

    expect(mockWriteGroupFile).toHaveBeenCalledWith(
      {},
      "group1",
      "test.txt",
      "keep this\nkeep this too\n",
    );

    expect(result).toContain("Patched test.txt");
  });

  // ── git_merge conflict sync ───────────────────────────────────────

  it("should still sync files after git_merge conflict error", async () => {
    (mockGitMerge as any).mockRejectedValue(
      new Error(
        "Automatic merge failed with one or more merge conflicts in the following files: a.js,b.js",
      ),
    );

    (mockReadGroupFile as any).mockResolvedValue("no markers here");

    const result = await executeTool(
      {},
      "git_merge",
      { repo: "demo", theirs: "main" },
      "group1",
    );

    // Should still sync so the agent can read conflicted files
    expect(mockSyncLfsToOpfs).toHaveBeenCalledWith(
      {},
      "group1",
      "demo",
      "repos/demo",
    );

    expect(result).toContain("conflicts");
    expect(result).toContain("a.js");
  });

  it("should include inline conflict regions in git_merge error response", async () => {
    const conflictErr = new Error(
      "Automatic merge failed with one or more merge conflicts in the following files: src/app.js",
    );
    conflictErr.data = { filepaths: ["src/app.js"] };
    (mockGitMerge as any).mockRejectedValue(conflictErr);

    const conflictedContent = [
      "const a = 1;",
      "<<<<<<< feature/retry-logic",
      "const b = 2;",
      "=======",
      "const b = 3;",
      ">>>>>>> main",
      "const c = 4;",
    ].join("\n");

    (mockReadGroupFile as any).mockResolvedValue(conflictedContent);

    const result = await executeTool(
      {},
      "git_merge",
      { repo: "demo", theirs: "main" },
      "group1",
    );

    expect(result).toContain("conflicts in 1 file(s)");
    expect(result).toContain("src/app.js");
    expect(result).toContain("feature/retry-logic");
    expect(result).toContain("const b = 2;");
    expect(result).toContain("const b = 3;");
    expect(result).toContain("Resolution steps");
    expect(result).toContain("write_file");
  });

  it("should use error.data.filepaths when available for conflict paths", async () => {
    const conflictErr = new Error("MergeConflictError");
    conflictErr.data = { filepaths: ["x.js", "y.js"] };
    (mockGitMerge as any).mockRejectedValue(conflictErr);

    (mockReadGroupFile as any).mockResolvedValue("no conflict markers");

    const result = await executeTool(
      {},
      "git_merge",
      { repo: "demo", theirs: "main" },
      "group1",
    );

    expect(result).toContain("conflicts in 2 file(s)");
    expect(result).toContain("x.js");
    expect(result).toContain("y.js");
    expect(mockReadGroupFile).toHaveBeenCalledWith(
      {},
      "group1",
      "repos/demo/x.js",
    );
    expect(mockReadGroupFile).toHaveBeenCalledWith(
      {},
      "group1",
      "repos/demo/y.js",
    );
  });

  it("should handle successful git_merge", async () => {
    (mockGitMerge as any).mockResolvedValue(
      "Merged main into feature (abc1234).",
    );

    const result = await executeTool(
      {},
      "git_merge",
      { repo: "demo", theirs: "main" },
      "group1",
    );

    expect(mockSyncLfsToOpfs).toHaveBeenCalled();
    expect(result).toBe("Merged main into feature (abc1234).");
  });

  it("should handle manage_tools tool", async () => {
    const result = await executeTool(
      {},
      "manage_tools",
      { action: "activate_profile", profile_id: "git-ops" },
      "group1",
    );

    expect(result).toBe(
      "Tool management request sent: activate_profile git-ops",
    );

    expect(mockPost).toHaveBeenCalledWith({
      type: "manage-tools",
      payload: {
        action: "activate_profile",
        profileId: "git-ops",
        toolNames: undefined,
        groupId: "group1",
      },
    });
  });

  it("should handle manage_email read_messages action", async () => {
    (mockGetConfig as any).mockResolvedValue([]);

    const connection = {
      id: "conn-1",
      label: "Mail",
      pluginId: "imap",
      enabled: true,
      config: {
        host: "imap.example.com",
        port: 993,
        secure: true,
        mailboxPath: "INBOX",
      },
      credentialRef: {
        serviceType: "http_api",
        authType: "basic_userpass",
        username: "user@example.com",
        encryptedSecret: "enc:secret",
      },
      createdAt: 1,
      updatedAt: 1,
    };

    (mockGetConfig as any).mockResolvedValueOnce([connection]);
    (mockDecryptValue as any).mockResolvedValueOnce("secret");

    const mockResponse: any = {
      ok: true,
      json: (jest.fn() as any).mockResolvedValue({ messages: [{ id: 1 }] }),
      status: 200,
      statusText: "OK",
    };

    const fetchMock = jest.fn().mockResolvedValue(mockResponse);
    (global as any).fetch = fetchMock;

    const result = await executeTool(
      {},
      "manage_email",
      { action: "read_messages", connection_id: "conn-1", limit: 10 },
      "group1",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/integrations/email/read",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result).toContain('"messages"');
  });

  it("should infer the single enabled IMAP connection for manage_email read_messages", async () => {
    const connection = {
      id: "conn-2",
      label: "Mail",
      pluginId: "imap",
      enabled: true,
      config: {
        host: "imap.example.com",
        port: 993,
        secure: true,
        mailboxPath: "INBOX",
      },
      credentialRef: {
        serviceType: "http_api",
        authType: "basic_userpass",
        username: "user@example.com",
        encryptedSecret: "enc:secret",
      },
      createdAt: 1,
      updatedAt: 1,
    };

    (mockGetConfig as any).mockResolvedValueOnce([connection]);
    (mockDecryptValue as any).mockResolvedValueOnce("secret");

    const mockResponse: any = {
      ok: true,
      json: (jest.fn() as any).mockResolvedValue({ messages: [{ id: 1 }] }),
      status: 200,
      statusText: "OK",
    };

    const fetchMock = jest.fn().mockResolvedValue(mockResponse);
    (global as any).fetch = fetchMock;

    const result = await executeTool(
      {},
      "manage_email",
      { action: "read_messages", limit: 10 },
      "group1",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/integrations/email/read",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result).toContain('"messages"');
  });

  it("should handle manage_email mark_as_read action", async () => {
    const connection = {
      id: "conn-3",
      label: "Mail",
      pluginId: "imap",
      enabled: true,
      config: {
        host: "imap.example.com",
        port: 993,
        secure: true,
        mailboxPath: "INBOX",
      },
      credentialRef: {
        serviceType: "http_api",
        authType: "basic_userpass",
        username: "user@example.com",
        encryptedSecret: "enc:secret",
      },
      createdAt: 1,
      updatedAt: 1,
    };

    (mockGetConfig as any).mockResolvedValueOnce([connection]);
    (mockDecryptValue as any).mockResolvedValueOnce("secret");

    const mockResponse: any = {
      ok: true,
      json: (jest.fn() as any).mockResolvedValue({
        action: "mark_as_read",
        count: 2,
      }),
      status: 200,
      statusText: "OK",
    };

    const fetchMock = jest.fn().mockResolvedValue(mockResponse);
    (global as any).fetch = fetchMock;

    const result = await executeTool(
      {},
      "manage_email",
      {
        action: "mark_as_read",
        connection_id: "conn-3",
        message_uids: [123, 124],
      },
      "group1",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/integrations/email/modify",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result).toContain('"mark_as_read"');
  });

  it("should send attachments via manage_email send_message", async () => {
    const connection = {
      id: "conn-attach",
      label: "Mail",
      pluginId: "imap",
      enabled: true,
      config: {
        host: "imap.example.com",
        smtpHost: "smtp.example.com",
        smtpPort: 587,
        smtpSecure: false,
      },
      credentialRef: {
        serviceType: "http_api",
        authType: "basic_userpass",
        username: "user@example.com",
        encryptedSecret: "enc:secret",
      },
      createdAt: 1,
      updatedAt: 1,
    };

    (mockGetConfig as any).mockResolvedValueOnce([connection]);
    (mockDecryptValue as any).mockResolvedValueOnce("secret");
    (mockReadGroupFileBytes as any).mockResolvedValueOnce(
      new Uint8Array([1, 2, 3, 4]),
    );

    const mockResponse: any = {
      ok: true,
      json: (jest.fn() as any).mockResolvedValue({ messageId: "mid-1" }),
      status: 200,
      statusText: "OK",
    };
    const fetchMock = jest.fn().mockResolvedValue(mockResponse);
    (global as any).fetch = fetchMock;

    const result = await executeTool(
      {},
      "manage_email",
      {
        action: "send_message",
        connection_id: "conn-attach",
        to: ["a@example.com"],
        subject: "Hello",
        body: "Body",
        attachments: ["repos/demo/file.png"],
      },
      "group1",
    );

    expect(mockReadGroupFileBytes).toHaveBeenCalledWith(
      {},
      "group1",
      "repos/demo/file.png",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/integrations/email/send",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(result).toContain("messageId");
  });

  it("should handle list_tool_profiles tool (pre-parsed array)", async () => {
    (mockGetConfig as any).mockResolvedValue([
      { id: "p1", name: "Profile 1", enabledToolNames: ["bash"] },
    ]);

    const result = await executeTool({}, "list_tool_profiles", {}, "group1");

    expect(mockGetConfig).toHaveBeenCalledWith({}, "tool_profiles");
    expect(result).toContain("Nano Optimized");
    expect(result).toContain("Profile 1");
    expect(result).toContain("bash");
  });

  it("should handle list_tool_profiles tool (JSON string)", async () => {
    (mockGetConfig as any).mockResolvedValue(
      JSON.stringify([
        { id: "p2", name: "Profile 2", enabledToolNames: ["read_file"] },
      ]),
    );

    const result = await executeTool({}, "list_tool_profiles", {}, "group1");

    expect(result).toContain("Profile 2");
    expect(result).toContain("read_file");
  });

  it("should handle unknown tool", async () => {
    const result = await executeTool({} as any, "unknown", {}, "group1");

    expect(result).toBe("Unknown tool: unknown");
  });

  it("should handle tool error", async () => {
    (mockReadGroupFile as any).mockRejectedValue(new Error("fail"));

    const result = await executeTool(
      {} as any,
      "read_file",
      { path: "x" },
      "group1",
    );

    expect(result).toContain("Tool error (read_file): fail");
  });

  describe("scheduled-task tool guard", () => {
    const BLOCKED_TOOLS = [
      "create_task",
      "update_task",
      "delete_task",
      "enable_task",
      "disable_task",
      "send_notification",
    ];

    for (const tool of BLOCKED_TOOLS) {
      it(`blocks ${tool} when isScheduledTask is true`, async () => {
        (mockGetAllTasks as any).mockResolvedValue([
          {
            id: "t1",
            groupId: "group1",
            schedule: "* * * * *",
            prompt: "x",
            enabled: true,
          },
        ]);

        const result = await executeTool(
          {},
          tool,
          { schedule: "0 9 * * *", prompt: "p", id: "t1", body: "b" },
          "group1",
          { isScheduledTask: true },
        );

        expect(result).toMatch(/blocked|not allowed|unavailable/i);
        expect(mockPost).not.toHaveBeenCalled();
      });
    }

    it("allows create_task when isScheduledTask is false", async () => {
      const result = await executeTool(
        {},
        "create_task",
        { schedule: "0 9 * * *", prompt: "ping" },
        "group1",
        { isScheduledTask: false },
      );

      expect(result).toContain("Task created successfully.");
      expect(mockPost).toHaveBeenCalled();
    });

    it("allows create_task when options not provided", async () => {
      const result = await executeTool(
        {},
        "create_task",
        { schedule: "0 9 * * *", prompt: "ping" },
        "group1",
      );

      expect(result).toContain("Task created successfully.");
      expect(mockPost).toHaveBeenCalled();
    });
  });
});
