import { jest } from "@jest/globals";

jest.unstable_mockModule("./clearGroupMessages.js", () => ({
  clearGroupMessages: (jest.fn() as any).mockResolvedValue(undefined),
}));

jest.unstable_mockModule("./saveMessage.js", () => ({
  saveMessage: jest.fn(),
}));

jest.unstable_mockModule("./saveSession.js", () => ({
  saveSession: jest.fn(),
}));

const { importChatData } = await import("./importChatData.js");
const { clearGroupMessages } = await import("./clearGroupMessages.js");
const { saveMessage } = await import("./saveMessage.js");
const { saveSession } = await import("./saveSession.js");

describe("importChatData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("clears old data and imports messages/session", async () => {
    const deleteReq: any = {};
    const db: any = {
      transaction: jest.fn(() => ({
        objectStore: jest.fn(() => ({
          delete: jest.fn(() => deleteReq),
        })),
      })),
    };

    const data: any = {
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
    const db: any = {
      transaction: jest.fn(() => null),
    };

    const data: any = { messages: [], session: null };

    await expect(importChatData(db, "g1", data)).rejects.toThrow(
      "cannot get existing session for this group from transaction",
    );
  });

  it("handles data without messages array", async () => {
    const deleteReq: any = {};
    const db: any = {
      transaction: jest.fn(() => ({
        objectStore: jest.fn(() => ({
          delete: jest.fn(() => deleteReq),
        })),
      })),
    };

    const data: any = {
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
    const deleteReq: any = {};
    const db: any = {
      transaction: jest.fn(() => ({
        objectStore: jest.fn(() => ({
          delete: jest.fn(() => deleteReq),
        })),
      })),
    };

    const data: any = {
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
    (clearGroupMessages as any).mockRejectedValueOnce(
      new Error("Clear failed"),
    );

    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(importChatData({} as any, "g1", {} as any)).rejects.toThrow(
      "Clear failed",
    );

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
