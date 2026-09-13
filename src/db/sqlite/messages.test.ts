import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { StoredMessage } from "../types.js";

describe("SQLite messages dual-dispatch", () => {
  let tmpDir: string;
  let db: any;

  const makeMsg = (overrides: Partial<StoredMessage> = {}): StoredMessage => ({
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    groupId: "br:main",
    timestamp: Date.now(),
    content: "Hello world",
    sender: "user",
    channel: "chat",
    isFromMe: true,
    isTrigger: false,
    ...overrides,
  });

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), "sc-msgs-test-"));
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

  it("saveMessage + getRecentMessages round-trips a message", async () => {
    const { saveMessage } = await import("../saveMessage.js");
    const { getRecentMessages } = await import("../getRecentMessages.js");
    const msg = makeMsg({ content: "Test message" });
    await saveMessage(db, msg);
    const msgs = await getRecentMessages(db, "br:main", 10);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe("Test message");
    expect(msgs[0].isFromMe).toBe(true);
  });

  it("getRecentMessages returns messages oldest-first", async () => {
    const { saveMessage } = await import("../saveMessage.js");
    const { getRecentMessages } = await import("../getRecentMessages.js");
    const base = Date.now();
    await saveMessage(
      db,
      makeMsg({ id: "m1", timestamp: base + 100, content: "first" }),
    );
    await saveMessage(
      db,
      makeMsg({ id: "m2", timestamp: base + 200, content: "second" }),
    );
    await saveMessage(
      db,
      makeMsg({ id: "m3", timestamp: base + 300, content: "third" }),
    );
    const msgs = await getRecentMessages(db, "br:main", 10);
    expect(msgs.map((m) => m.content)).toEqual(["first", "second", "third"]);
  });

  it("getRecentMessages respects the limit parameter", async () => {
    const { saveMessage } = await import("../saveMessage.js");
    const { getRecentMessages } = await import("../getRecentMessages.js");
    const base = Date.now();
    for (let i = 0; i < 5; i++) {
      await saveMessage(db, makeMsg({ id: `m${i}`, timestamp: base + i * 10 }));
    }
    const msgs = await getRecentMessages(db, "br:main", 3);
    // Should return the 3 most recent
    expect(msgs).toHaveLength(3);
  });

  it("getRecentMessages scopes to groupId", async () => {
    const { saveMessage } = await import("../saveMessage.js");
    const { getRecentMessages } = await import("../getRecentMessages.js");
    await saveMessage(
      db,
      makeMsg({ id: "a1", groupId: "group-a", content: "in A" }),
    );
    await saveMessage(
      db,
      makeMsg({ id: "b1", groupId: "group-b", content: "in B" }),
    );
    const msgsA = await getRecentMessages(db, "group-a", 10);
    expect(msgsA).toHaveLength(1);
    expect(msgsA[0].content).toBe("in A");
  });

  it("getRecentMessages returns empty array when no messages", async () => {
    const { getRecentMessages } = await import("../getRecentMessages.js");
    const msgs = await getRecentMessages(db, "br:main", 10);
    expect(msgs).toEqual([]);
  });

  it("clearGroupMessages removes all messages for a group", async () => {
    const { saveMessage } = await import("../saveMessage.js");
    const { clearGroupMessages } = await import("../clearGroupMessages.js");
    const { getRecentMessages } = await import("../getRecentMessages.js");
    await saveMessage(db, makeMsg({ id: "x1", groupId: "grp-x" }));
    await saveMessage(db, makeMsg({ id: "x2", groupId: "grp-x" }));
    await saveMessage(db, makeMsg({ id: "y1", groupId: "grp-y" }));
    await clearGroupMessages(db, "grp-x");
    expect(await getRecentMessages(db, "grp-x", 10)).toHaveLength(0);
    // Other group untouched
    expect(await getRecentMessages(db, "grp-y", 10)).toHaveLength(1);
  });

  it("getAllGroupIds returns distinct group IDs over SQLite", async () => {
    const { saveMessage } = await import("../saveMessage.js");
    const { getAllGroupIds } = await import("../getAllGroupIds.js");
    await saveMessage(db, makeMsg({ id: "g1", groupId: "group-alpha" }));
    await saveMessage(db, makeMsg({ id: "g2", groupId: "group-beta" }));
    await saveMessage(db, makeMsg({ id: "g3", groupId: "group-alpha" }));
    const ids = await getAllGroupIds(db);
    expect(ids).toEqual(["group-alpha", "group-beta"]);
  });

  it("getOrCreateSubscriberId creates and persists subscriber ID over SQLite", async () => {
    const { getOrCreateSubscriberId } =
      await import("../getOrCreateSubscriberId.js");
    const id1 = await getOrCreateSubscriberId(db);
    expect(typeof id1).toBe("string");
    expect(id1.length).toBeGreaterThan(0);
    const id2 = await getOrCreateSubscriberId(db);
    expect(id2).toBe(id1);
  });
});
