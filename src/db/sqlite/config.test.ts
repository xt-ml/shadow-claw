import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Tests for dual-dispatch SQLite branches in src/db/getConfig.ts,
 * setConfig.ts, deleteConfig.ts, and getAllConfig.ts.
 *
 * Each test opens a fresh SQLite DB and exercises the same public API that
 * the IDB-backed browser implementation uses, verifying the SQLite path
 * returns identical results.
 */
describe("SQLite config dual-dispatch", () => {
  let tmpDir: string;
  let db: any;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), "sc-config-test-"));
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

  it("getConfig returns undefined for a missing key", async () => {
    const { getConfig } = await import("../getConfig.js");
    const result = await getConfig(db, "nonexistent");
    expect(result).toBeUndefined();
  });

  it("setConfig + getConfig round-trips a string value", async () => {
    const { getConfig } = await import("../getConfig.js");
    const { setConfig } = await import("../setConfig.js");
    await setConfig(db, "my_key", "hello world");
    const result = await getConfig(db, "my_key");
    expect(result).toBe("hello world");
  });

  it("setConfig overwrites an existing key", async () => {
    const { getConfig } = await import("../getConfig.js");
    const { setConfig } = await import("../setConfig.js");
    await setConfig(db, "color", "red");
    await setConfig(db, "color", "blue");
    expect(await getConfig(db, "color")).toBe("blue");
  });

  it("deleteConfig removes a key so getConfig returns undefined", async () => {
    const { getConfig } = await import("../getConfig.js");
    const { setConfig } = await import("../setConfig.js");
    const { deleteConfig } = await import("../deleteConfig.js");
    await setConfig(db, "temp", "value");
    await deleteConfig(db, "temp");
    expect(await getConfig(db, "temp")).toBeUndefined();
  });

  it("deleteConfig is a no-op for a missing key", async () => {
    const { deleteConfig } = await import("../deleteConfig.js");
    await expect(deleteConfig(db, "ghost_key")).resolves.toBeUndefined();
  });

  it("getAllConfig returns all stored key-value pairs", async () => {
    const { setConfig } = await import("../setConfig.js");
    const { getAllConfig } = await import("../getAllConfig.js");
    await setConfig(db, "a", "1");
    await setConfig(db, "b", "2");
    const all = await getAllConfig(db);
    expect(all).toHaveLength(2);
    const keys = all.map((e: any) => e.key).sort();
    expect(keys).toEqual(["a", "b"]);
  });

  it("getAllConfig returns empty array when no config stored", async () => {
    const { getAllConfig } = await import("../getAllConfig.js");
    const all = await getAllConfig(db);
    expect(all).toEqual([]);
  });
});
