import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Task } from "../types.js";

describe("SQLite tasks dual-dispatch", () => {
  let tmpDir: string;
  let db: any;

  const baseTask = (): Task => ({
    id: "task-001",
    groupId: "br:main",
    enabled: true,
    prompt: "Do something useful",
    schedule: "0 * * * *",
    createdAt: Date.now(),
    lastRun: null,
    type: "prompt",
    name: "My Task",
  });

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), "sc-tasks-test-"));
    const { openSqliteDatabase, closeSqliteDatabase } =
      await import("./openSqliteDatabase.js");
    closeSqliteDatabase();
    db = openSqliteDatabase(path.join(tmpDir, "test.db"));
  });

  afterEach(async () => {
    const { closeSqliteDatabase } = await import("./openSqliteDatabase.js");
    closeSqliteDatabase();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("saveTask + getAllTasks round-trips a task", async () => {
    const { saveTask } = await import("../saveTask.js");
    const { getAllTasks } = await import("../getAllTasks.js");
    const task = baseTask();
    await saveTask(db, task);
    const all = await getAllTasks(db);
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe("task-001");
    expect(all[0].prompt).toBe("Do something useful");
    expect(all[0].enabled).toBe(true);
  });

  it("saveTask overwrites an existing task (upsert)", async () => {
    const { saveTask } = await import("../saveTask.js");
    const { getAllTasks } = await import("../getAllTasks.js");
    const task = baseTask();
    await saveTask(db, task);
    await saveTask(db, { ...task, prompt: "Updated prompt" });
    const all = await getAllTasks(db);
    expect(all).toHaveLength(1);
    expect(all[0].prompt).toBe("Updated prompt");
  });

  it("getTask returns the task by ID", async () => {
    const { saveTask } = await import("../saveTask.js");
    const { getTask } = await import("../getTask.js");
    await saveTask(db, baseTask());
    const task = await getTask(db, "task-001");
    expect(task).toBeDefined();
    expect(task?.id).toBe("task-001");
  });

  it("getTask returns undefined for unknown ID", async () => {
    const { getTask } = await import("../getTask.js");
    const task = await getTask(db, "does-not-exist");
    expect(task).toBeUndefined();
  });

  it("deleteTask removes a task", async () => {
    const { saveTask } = await import("../saveTask.js");
    const { deleteTask } = await import("../deleteTask.js");
    const { getAllTasks } = await import("../getAllTasks.js");
    await saveTask(db, baseTask());
    await deleteTask(db, "task-001");
    const all = await getAllTasks(db);
    expect(all).toHaveLength(0);
  });

  it("getEnabledTasks returns only enabled tasks", async () => {
    const { saveTask } = await import("../saveTask.js");
    const { getEnabledTasks } = await import("../getEnabledTasks.js");
    await saveTask(db, { ...baseTask(), id: "t1", enabled: true });
    await saveTask(db, { ...baseTask(), id: "t2", enabled: false });
    const enabled = await getEnabledTasks(db);
    expect(enabled.map((t) => t.id)).toEqual(["t1"]);
  });

  it("updateTaskLastRun sets the lastRun timestamp", async () => {
    const { saveTask } = await import("../saveTask.js");
    const { updateTaskLastRun } = await import("../updateTaskLastRun.js");
    const { getTask } = await import("../getTask.js");
    await saveTask(db, baseTask());
    const ts = Date.now();
    await updateTaskLastRun(db, "task-001", ts);
    const task = await getTask(db, "task-001");
    expect(task?.lastRun).toBe(ts);
  });

  it("updateTaskLastRun is a no-op for unknown task ID", async () => {
    const { updateTaskLastRun } = await import("../updateTaskLastRun.js");
    await expect(
      updateTaskLastRun(db, "ghost", 12345),
    ).resolves.toBeUndefined();
  });

  it("task.tools (array) round-trips through JSON serialization", async () => {
    const { saveTask } = await import("../saveTask.js");
    const { getTask } = await import("../getTask.js");
    const tools = [{ name: "bash", input: { command: "echo hi" } }];
    await saveTask(db, { ...baseTask(), tools, type: "tools" });
    const task = await getTask(db, "task-001");
    expect(task?.tools).toEqual(tools);
  });

  it("getAllTasks returns empty array when no tasks", async () => {
    const { getAllTasks } = await import("../getAllTasks.js");
    const all = await getAllTasks(db);
    expect(all).toEqual([]);
  });
});
