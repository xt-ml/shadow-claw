import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

describe("isSqliteDatabase", () => {
  it("returns false for null", async () => {
    const { isSqliteDatabase } = await import("./types.js");
    expect(isSqliteDatabase(null)).toBe(false);
  });

  it("returns false for a plain object without brand", async () => {
    const { isSqliteDatabase } = await import("./types.js");
    expect(isSqliteDatabase({ db: {} })).toBe(false);
  });

  it("returns false for an IDBDatabase-shaped object", async () => {
    const { isSqliteDatabase } = await import("./types.js");
    const fakeIdb = { transaction: () => {}, objectStoreNames: {} };
    expect(isSqliteDatabase(fakeIdb)).toBe(false);
  });

  it("returns true for a wrapped SQLite database", async () => {
    const { isSqliteDatabase, wrapSqliteDatabase } = await import("./types.js");
    // Use a minimal duck-typed object to avoid needing a real DB
    const fakeRaw = {
      close: () => {},
      exec: () => {},
      prepare: () => {},
    } as any;
    const wrapped = wrapSqliteDatabase(fakeRaw);
    expect(isSqliteDatabase(wrapped)).toBe(true);
  });

  it("wrapped database exposes the raw db property", async () => {
    const { wrapSqliteDatabase } = await import("./types.js");
    const fakeRaw = {
      close: () => {},
      exec: () => {},
      prepare: () => {},
    } as any;
    const wrapped = wrapSqliteDatabase(fakeRaw);
    expect(wrapped.db).toBe(fakeRaw);
  });
});

describe("openSqliteDatabase", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), "sc-agent-test-"));
  });

  afterEach(async () => {
    // Close any open DB before removing temp dir
    try {
      const { closeSqliteDatabase } = await import("./openSqliteDatabase.js");
      closeSqliteDatabase();
    } catch {
      // ignore if module not yet imported
    }
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("opens a database and returns a ShadowClawSqliteDatabase", async () => {
    const { openSqliteDatabase } = await import("./openSqliteDatabase.js");
    const { isSqliteDatabase } = await import("./types.js");
    const dbPath = path.join(tmpDir, "agent.db");
    const db = openSqliteDatabase(dbPath);
    expect(isSqliteDatabase(db)).toBe(true);
  });

  it("creates the messages table", async () => {
    const { openSqliteDatabase } = await import("./openSqliteDatabase.js");
    const dbPath = path.join(tmpDir, "agent.db");
    const { db: raw } = openSqliteDatabase(dbPath);
    const result = raw
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='messages'",
      )
      .get();
    expect(result).toBeDefined();
    expect((result as any).name).toBe("messages");
  });

  it("creates the tasks table", async () => {
    const { openSqliteDatabase } = await import("./openSqliteDatabase.js");
    const dbPath = path.join(tmpDir, "agent.db");
    const { db: raw } = openSqliteDatabase(dbPath);
    const result = raw
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'",
      )
      .get();
    expect((result as any)?.name).toBe("tasks");
  });

  it("creates the config table", async () => {
    const { openSqliteDatabase } = await import("./openSqliteDatabase.js");
    const dbPath = path.join(tmpDir, "agent.db");
    const { db: raw } = openSqliteDatabase(dbPath);
    const result = raw
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='config'",
      )
      .get();
    expect((result as any)?.name).toBe("config");
  });

  it("creates the sessions table", async () => {
    const { openSqliteDatabase } = await import("./openSqliteDatabase.js");
    const dbPath = path.join(tmpDir, "agent.db");
    const { db: raw } = openSqliteDatabase(dbPath);
    const result = raw
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'",
      )
      .get();
    expect((result as any)?.name).toBe("sessions");
  });

  it("returns the same cached instance on repeated calls", async () => {
    const { openSqliteDatabase } = await import("./openSqliteDatabase.js");
    const dbPath = path.join(tmpDir, "agent.db");
    const db1 = openSqliteDatabase(dbPath);
    const db2 = openSqliteDatabase(dbPath);
    expect(db1).toBe(db2);
  });

  it("closeSqliteDatabase clears the cache so a new DB can be opened", async () => {
    const { openSqliteDatabase, closeSqliteDatabase } =
      await import("./openSqliteDatabase.js");
    const dbPath1 = path.join(tmpDir, "agent1.db");
    const dbPath2 = path.join(tmpDir, "agent2.db");
    const db1 = openSqliteDatabase(dbPath1);
    closeSqliteDatabase();
    const db2 = openSqliteDatabase(dbPath2);
    expect(db1).not.toBe(db2);
  });

  it("creates indexes for messages_by_group_time and tasks_by_group", async () => {
    const { openSqliteDatabase } = await import("./openSqliteDatabase.js");
    const dbPath = path.join(tmpDir, "agent.db");
    const { db: raw } = openSqliteDatabase(dbPath);
    const indexes = raw
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' ORDER BY name",
      )
      .all() as { name: string }[];
    const indexNames = indexes.map((r) => r.name);
    expect(indexNames).toContain("messages_by_group_time");
    expect(indexNames).toContain("tasks_by_group");
  });
});
