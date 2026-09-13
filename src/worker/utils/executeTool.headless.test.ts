import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * TDD tests for the browser-only tool gate in executeTool.ts.
 *
 * In headless mode, tools that require a browser surface (DOM, canvas,
 * custom elements, Web Share) must return a clear error string rather than
 * silently failing or throwing.
 */
describe("executeTool browser-only tool gate in headless mode", () => {
  let tmpDir: string;
  let db: any;

  const BROWSER_ONLY_TOOLS = [
    "ask_user",
    "attach_file_to_chat",
    "clear_chat",
    "create_room",
    "invite_to_room",
    "leave_room",
    "list_components",
    "list_room_members",
    "open_file",
    "render_component",
    "send_file",
    "show_toast",
    "send_notification",
    "spawn_subagent",
  ];

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), "sc-exectool-test-"));
    const { setHeadlessMode } = await import("../../config/headless.js");
    setHeadlessMode(true);

    const { openSqliteDatabase, closeSqliteDatabase } =
      await import("../../db/sqlite/openSqliteDatabase.js");
    closeSqliteDatabase();
    db = openSqliteDatabase(path.join(tmpDir, "test.db"));

    const { setStorageRootFromPath } =
      await import("../../storage/node-fs-handle.js");
    setStorageRootFromPath(tmpDir);
    await import("../tools/bash/native-bash-executor.js");
  });

  afterEach(async () => {
    const { setHeadlessMode } = await import("../../config/headless.js");
    setHeadlessMode(false);
    const { closeSqliteDatabase } =
      await import("../../db/sqlite/openSqliteDatabase.js");
    closeSqliteDatabase();
    const { invalidateStorageRoot } = await import("../../storage/storage.js");
    invalidateStorageRoot();
    await rm(tmpDir, { recursive: true, force: true });
  });

  for (const toolName of BROWSER_ONLY_TOOLS) {
    it(`returns headless-unavailable error for browser-only tool: ${toolName}`, async () => {
      const { executeTool } = await import("../../worker/utils/executeTool.js");
      const result = await executeTool(db, toolName, {}, "br:main");
      expect(typeof result).toBe("string");
      expect(result as string).toMatch(/headless/i);
      expect(result as string).toMatch(/browser/i);
    });
  }
});

describe("executeTool headless-safe tools work with SQLite + NodeFs", () => {
  let tmpDir: string;
  let db: any;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), "sc-exectool-safe-test-"));
    const { setHeadlessMode } = await import("../../config/headless.js");
    setHeadlessMode(true);

    const { openSqliteDatabase, closeSqliteDatabase } =
      await import("../../db/sqlite/openSqliteDatabase.js");
    closeSqliteDatabase();
    db = openSqliteDatabase(path.join(tmpDir, "test.db"));

    const { setStorageRootFromPath } =
      await import("../../storage/node-fs-handle.js");
    setStorageRootFromPath(tmpDir);
    await import("../tools/bash/native-bash-executor.js");
  });

  afterEach(async () => {
    const { setHeadlessMode } = await import("../../config/headless.js");
    setHeadlessMode(false);
    const { closeSqliteDatabase } =
      await import("../../db/sqlite/openSqliteDatabase.js");
    closeSqliteDatabase();
    const { invalidateStorageRoot } = await import("../../storage/storage.js");
    invalidateStorageRoot();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("get_current_time returns a timestamp string", async () => {
    const { executeTool } = await import("../../worker/utils/executeTool.js");
    const result = await executeTool(db, "get_current_time", {}, "br:main");
    expect(typeof result).toBe("string");
    // Should contain a year
    expect(result as string).toMatch(/202\d/);
  });

  it("list_tasks returns empty task list when no tasks saved", async () => {
    const { executeTool } = await import("../../worker/utils/executeTool.js");
    const result = await executeTool(db, "list_tasks", {}, "br:main");
    expect(typeof result).toBe("string");
    expect(result as string).toMatch(/no tasks/i);
  });

  it("write_file + read_file round-trip through NodeFs", async () => {
    const { executeTool } = await import("../../worker/utils/executeTool.js");
    await executeTool(
      db,
      "write_file",
      { path: "hello.txt", content: "hi there" },
      "br:main",
    );
    const result = await executeTool(
      db,
      "read_file",
      { path: "hello.txt" },
      "br:main",
    );
    expect(result as string).toContain("hi there");
  });

  it("list_files returns files written via write_file", async () => {
    const { executeTool } = await import("../../worker/utils/executeTool.js");
    await executeTool(
      db,
      "write_file",
      { path: "a.txt", content: "aaa" },
      "br:main",
    );
    await executeTool(
      db,
      "write_file",
      { path: "b.txt", content: "bbb" },
      "br:main",
    );
    const result = await executeTool(
      db,
      "list_files",
      { path: "." },
      "br:main",
    );
    expect(result as string).toContain("a.txt");
    expect(result as string).toContain("b.txt");
  });

  describe("Built-in AI tools in headless mode", () => {
    it("executes rewrite_text with active provider or returns error if key missing", async () => {
      const { executeTool } = await import("./executeTool.js");

      // Without API key for external provider, returns a clean error string instead of hanging
      const res = await executeTool(
        db,
        "rewrite_text",
        { text: "hello world", tone: "more-casual" },
        "server:main",
        {
          invokeContext: {
            provider: "openrouter",
            model: "openrouter/free",
            apiKey: "",
          } as any,
        },
      );
      expect(typeof res).toBe("string");
      expect(res).toMatch(/Error rewriting text:.*requires an API key/i);
    });

    it("executes rewrite_text successfully when provider responds", async () => {
      const { executeTool } = await import("./executeTool.js");
      const { setNativeAiTaskHandler } =
        await import("../tools/builtin-ai/builtin-ai.js");

      setNativeAiTaskHandler(async (_taskType, input) => {
        return `Rewritten: ${input.text} (${input.tone})`;
      });

      const res = await executeTool(
        db,
        "rewrite_text",
        { text: "how are you doing", tone: "happier" },
        "server:main",
      );

      expect(res).toBe("Rewritten: how are you doing (happier)");
      setNativeAiTaskHandler(null);
    });
  });
});
