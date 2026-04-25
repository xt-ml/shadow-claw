import { jest } from "@jest/globals";

jest.unstable_mockModule("../ulid.js", () => {
  let counter = 0;

  return { ulid: jest.fn(() => `TASKCLONE${++counter}`) };
});

const { cloneGroupTasks } = await import("./cloneGroupTasks.js");

/**
 * Build a minimal fake IDB transaction + object store + index
 * that simulates a cursor walk over source tasks.
 */
function createMockDb(sourceTasks) {
  const stored: any[] = [];
  let cursorIdx = 0;

  const cursor: any = {
    get value() {
      return sourceTasks[cursorIdx];
    },

    continue() {
      cursorIdx++;

      request.onsuccess();
    },
    get result() {
      return cursorIdx < sourceTasks.length ? cursor : null;
    },
  };

  const request: any = {
    get result() {
      return cursorIdx < sourceTasks.length ? cursor : null;
    },
    onsuccess: null,
    onerror: null,
  };

  const store: any = {
    put(task) {
      stored.push(task);
    },
    index() {
      return {
        openCursor(groupId) {
          setTimeout(() => request.onsuccess?.(), 0);

          return request;
        },
      };
    },
  };

  const db: any = {
    transaction() {
      return { objectStore: () => store };
    },
  };

  return { db, stored };
}

describe("cloneGroupTasks", () => {
  beforeEach(() => jest.clearAllMocks());

  it("clones tasks with new IDs and target groupId", async () => {
    const tasks = [
      {
        id: "t1",
        groupId: "br:src",
        schedule: "0 9 * * *",
        prompt: "daily standup",
        isScript: false,
        enabled: 1,
        lastRun: null,
        createdAt: 1000,
      },
      {
        id: "t2",
        groupId: "br:src",
        schedule: "*/5 * * * *",
        prompt: "check status",
        isScript: true,
        enabled: 0,
        lastRun: 500,
        createdAt: 2000,
      },
    ];
    const { db, stored } = createMockDb(tasks);

    const count = await cloneGroupTasks(db as any, "br:src", "br:dst");

    expect(count).toBe(2);
    expect(stored).toHaveLength(2);

    expect(stored[0].groupId).toBe("br:dst");

    expect(stored[1].groupId).toBe("br:dst");
    // IDs should be new, not the originals

    expect(stored[0].id).not.toBe("t1");

    expect(stored[1].id).not.toBe("t2");
    // Content should be preserved

    expect(stored[0].prompt).toBe("daily standup");

    expect(stored[1].prompt).toBe("check status");

    expect(stored[0].schedule).toBe("0 9 * * *");

    expect(stored[1].enabled).toBe(0);
  });

  it("returns 0 when source group has no tasks", async () => {
    const { db, stored } = createMockDb([]);

    const count = await cloneGroupTasks(db as any, "br:empty", "br:dst");

    expect(count).toBe(0);
    expect(stored).toHaveLength(0);
  });

  it("throws when transaction cannot be created", async () => {
    const db: any = { transaction: () => null };

    await expect(
      cloneGroupTasks(db as any, "br:src", "br:dst"),
    ).rejects.toThrow("failed to get transaction");
  });
});
