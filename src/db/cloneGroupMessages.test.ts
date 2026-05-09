import { jest } from "@jest/globals";

jest.unstable_mockModule("../ulid.js", () => {
  let counter = 0;

  return { ulid: jest.fn(() => `CLONE${++counter}`) };
});

const { cloneGroupMessages } = await import("./cloneGroupMessages.js");

/**
 * Build a minimal fake IDB transaction + object store + index
 * that simulates a cursor walk over source messages.
 */
function createMockDb(sourceMessages: any[]) {
  const stored: any[] = [];
  let cursorIdx = 0;

  const cursor: any = {
    get value() {
      return sourceMessages[cursorIdx];
    },

    continue() {
      cursorIdx++;

      request.onsuccess();
    },
    get result() {
      return cursorIdx < sourceMessages.length ? cursor : null;
    },
  };

  const request: any = {
    get result() {
      return cursorIdx < sourceMessages.length ? cursor : null;
    },
    onsuccess: null,
    onerror: null,
  };

  const store: any = {
    put(msg: any) {
      stored.push(msg);
    },
    index() {
      return {
        openCursor(_groupId) {
          // simulate async

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

describe("cloneGroupMessages", () => {
  beforeEach(() => jest.clearAllMocks());

  it("clones messages with new IDs and target groupId", async () => {
    const msgs = [
      {
        id: "m1",
        groupId: "br:src",
        sender: "user",
        content: "hello",
        timestamp: 1000,
      },
      {
        id: "m2",
        groupId: "br:src",
        sender: "assistant",
        content: "hi",
        timestamp: 2000,
      },
    ];
    const { db, stored } = createMockDb(msgs);

    const count = await cloneGroupMessages(db as any, "br:src", "br:dst");

    expect(count).toBe(2);
    expect(stored).toHaveLength(2);

    expect(stored[0].groupId).toBe("br:dst");

    expect(stored[1].groupId).toBe("br:dst");
    // IDs should be new, not the originals

    expect(stored[0].id).not.toBe("m1");

    expect(stored[1].id).not.toBe("m2");
    // Content should be preserved

    expect(stored[0].content).toBe("hello");

    expect(stored[1].content).toBe("hi");
  });

  it("returns 0 when source group has no messages", async () => {
    const { db, stored } = createMockDb([]);

    const count = await cloneGroupMessages(db as any, "br:empty", "br:dst");

    expect(count).toBe(0);
    expect(stored).toHaveLength(0);
  });

  it("throws when transaction cannot be created", async () => {
    const db: any = { transaction: () => null };

    await expect(
      cloneGroupMessages(db as any, "br:src", "br:dst"),
    ).rejects.toThrow("failed to get transaction");
  });
});
