import { jest } from "@jest/globals";

jest.unstable_mockModule("./clearGroupMessages.mjs", () => ({
  clearGroupMessages: jest.fn().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("./saveMessage.mjs", () => ({
  saveMessage: jest.fn(),
}));

jest.unstable_mockModule("./saveSession.mjs", () => ({
  saveSession: jest.fn(),
}));

const { importChatData } = await import("./importChatData.mjs");
const { clearGroupMessages } = await import("./clearGroupMessages.mjs");
const { saveMessage } = await import("./saveMessage.mjs");
const { saveSession } = await import("./saveSession.mjs");

describe("importChatData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("clears old data and imports messages/session", async () => {
    const deleteReq = {};
    const db = {
      transaction: jest.fn(() => ({
        objectStore: jest.fn(() => ({
          delete: jest.fn(() => deleteReq),
        })),
      })),
    };

    const data = {
      messages: [
        { id: "m1", content: "hi" },
        { id: "m2", content: "yo" },
      ],
      session: { messages: [], updatedAt: 1 },
    };

    const pending = importChatData(db, "g1", data);
    await Promise.resolve();
    deleteReq.onsuccess();
    await pending;

    expect(clearGroupMessages).toHaveBeenCalledWith(db, "g1");
    expect(saveMessage).toHaveBeenCalledTimes(2);
    expect(saveSession).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ groupId: "g1" }),
    );
  });

  it("throws error if transaction is null", async () => {
    const db = {
      transaction: jest.fn(() => null),
    };

    const data = { messages: [], session: null };

    await expect(importChatData(db, "g1", data)).rejects.toThrow(
      "cannot get existing session for this group from transaction",
    );
  });

  it("handles data without messages array", async () => {
    const deleteReq = {};
    const db = {
      transaction: jest.fn(() => ({
        objectStore: jest.fn(() => ({
          delete: jest.fn(() => deleteReq),
        })),
      })),
    };

    const data = {
      messages: null,
      session: { messages: [] },
    };

    const pending = importChatData(db, "g1", data);
    await Promise.resolve();
    deleteReq.onsuccess();
    await pending;

    expect(saveMessage).not.toHaveBeenCalled();
    expect(saveSession).toHaveBeenCalled();
  });

  it("handles data without session", async () => {
    const deleteReq = {};
    const db = {
      transaction: jest.fn(() => ({
        objectStore: jest.fn(() => ({
          delete: jest.fn(() => deleteReq),
        })),
      })),
    };

    const data = {
      messages: [{ id: "m1" }],
      session: null,
    };

    const pending = importChatData(db, "g1", data);
    await Promise.resolve();
    deleteReq.onsuccess();
    await pending;

    expect(saveMessage).toHaveBeenCalled();
    expect(saveSession).not.toHaveBeenCalled();
  });

  it("rethrows errors after logging", async () => {
    clearGroupMessages.mockRejectedValueOnce(new Error("Clear failed"));

    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(importChatData({}, "g1", {})).rejects.toThrow("Clear failed");

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
