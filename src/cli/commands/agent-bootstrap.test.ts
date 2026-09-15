import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { jest } from "@jest/globals";
import { bootstrapHeadlessAgent } from "./agent-bootstrap.js";

describe("agent-bootstrap", () => {
  let tmpDir: string;
  let mockCore: any;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sc-agent-bootstrap-test-"));
    mockCore = {
      setHeadlessMode: jest.fn(),
      openSqliteDatabase: jest.fn().mockReturnValue({ close: jest.fn() }),
      setDB: jest.fn(),
      setStorageRootFromPath: jest.fn(),
      setPostHandler: jest.fn(),
      executeNativeAiTask: jest.fn(),
    };
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) {}
  });

  it("bootstraps headless agent with explicit workspace and databaseDir", async () => {
    const wsDir = path.join(tmpDir, "ws");
    const dbDir = path.join(tmpDir, "db");

    const result = await bootstrapHeadlessAgent({
      workspace: wsDir,
      databaseDir: dbDir,
      quiet: true,
      core: mockCore,
    } as any);

    expect(result.workspaceDir).toBe(path.resolve(wsDir));
    expect(result.dbPath).toBe(path.join(path.resolve(dbDir), "agent.db"));
    expect(result.core).toBe(mockCore);
    expect(mockCore.setHeadlessMode).toHaveBeenCalledWith(true);
    expect(mockCore.openSqliteDatabase).toHaveBeenCalledWith(result.dbPath);
    expect(mockCore.setDB).toHaveBeenCalledWith(result.db);
    expect(mockCore.setStorageRootFromPath).toHaveBeenCalledWith(
      result.workspaceDir,
    );
    expect(mockCore.setPostHandler).toHaveBeenCalled();
  });

  it("bootstraps with workspace and cacheDir fallback for dbDir", async () => {
    const wsDir = path.join(tmpDir, "ws");
    const cacheDir = path.join(tmpDir, "cache");

    const result = await bootstrapHeadlessAgent({
      workspace: wsDir,
      cacheDir,
      quiet: true,
      core: mockCore,
    } as any);

    expect(result.dbPath).toBe(
      path.join(path.resolve(cacheDir), "database", "agent.db"),
    );
  });

  it("wires up post handler routing correctly", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    let postHandler: ((msg: any) => void) | undefined;
    mockCore.setPostHandler.mockImplementation((fn: any) => {
      postHandler = fn;
    });

    await bootstrapHeadlessAgent({
      workspace: tmpDir,
      quiet: false,
      verbose: true,
      core: mockCore,
    } as any);

    expect(postHandler).toBeDefined();

    // response message
    postHandler!({ type: "response", payload: { text: "Hello agent" } });
    expect(logSpy).toHaveBeenCalledWith("Hello agent");

    // error message
    postHandler!({ type: "error", payload: { error: "Something failed" } });
    expect(errorSpy).toHaveBeenCalledWith("Error: Something failed");

    // tool activity message
    postHandler!({
      type: "tool-activity",
      payload: { tool: "read_file", status: "completed" },
    });
    expect(logSpy).toHaveBeenCalledWith("[Tool] read_file (completed)");

    // request-native-ai-task
    const mockTaskPromise = Promise.resolve({ result: 42 });
    mockCore.executeNativeAiTask.mockReturnValue(mockTaskPromise);

    const mockResolver = { resolve: jest.fn(), reject: jest.fn() };
    (globalThis as any).pendingNativeAiResolvers = { "task-1": mockResolver };

    postHandler!({
      type: "request-native-ai-task",
      payload: { id: "task-1", groupId: "g1", taskType: "test", input: "abc" },
    });

    await mockTaskPromise;
    expect(mockResolver.resolve).toHaveBeenCalledWith({ result: 42 });
    expect(
      (globalThis as any).pendingNativeAiResolvers["task-1"],
    ).toBeUndefined();

    logSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
