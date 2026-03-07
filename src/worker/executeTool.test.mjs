import { jest } from "@jest/globals";

describe("executeTool.mjs", () => {
  let executeTool;
  let mockExecuteShell;
  let mockFormatShellOutput;
  let mockListGroupFiles;
  let mockPendingTasks;
  let mockPost;
  let mockReadGroupFile;
  let mockStripHtml;
  let mockUlid;
  let mockWriteGroupFile;

  beforeEach(async () => {
    jest.resetModules();

    mockExecuteShell = jest.fn();
    mockFormatShellOutput = jest.fn((res) => `formatted: ${res}`);
    mockListGroupFiles = jest.fn();
    mockPendingTasks = new Map();
    mockPost = jest.fn();
    mockReadGroupFile = jest.fn();
    mockStripHtml = jest.fn((html) => html.replace(/<[^>]*>/g, ""));
    mockUlid = jest.fn(() => "mock-ulid");
    mockWriteGroupFile = jest.fn();

    jest.unstable_mockModule("../config.mjs", () => ({
      FETCH_MAX_RESPONSE: 1000,
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

    jest.unstable_mockModule("./formatShellOutput.mjs", () => ({
      formatShellOutput: mockFormatShellOutput,
    }));

    jest.unstable_mockModule("./pendingTasks.mjs", () => ({
      pendingTasks: mockPendingTasks,
    }));

    jest.unstable_mockModule("./post.mjs", () => ({
      post: mockPost,
    }));

    jest.unstable_mockModule("./stripHtml.mjs", () => ({
      stripHtml: mockStripHtml,
    }));

    const module = await import("./executeTool.mjs");
    executeTool = module.executeTool;
  });

  it("should handle bash tool", async () => {
    mockExecuteShell.mockResolvedValue("shell output");

    const result = await executeTool({}, "bash", { command: "ls" }, "group1");
    expect(mockExecuteShell).toHaveBeenCalledWith({}, "ls", "group1", {}, 30);
    expect(result).toBe("formatted: shell output");
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

  it("should handle list_tasks tool", async () => {
    const tasks = [{ id: "1", schedule: "*", prompt: "p", enabled: true }];
    const promise = executeTool({}, "list_tasks", {}, "group1");

    expect(mockPost).toHaveBeenCalledWith({
      type: "task-list-request",
      payload: { groupId: "group1" },
    });

    // Simulate resolution of pending task
    const resolve = mockPendingTasks.get("group1");
    resolve(tasks);

    const result = await promise;
    expect(result).toContain("[ID: 1] Schedule: *, Prompt: p, Enabled: true");
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
