import { jest } from "@jest/globals";

jest.unstable_mockModule("./getSession.js", () => ({
  getSession: jest.fn(),
}));

describe("exportChatData", () => {
  let exportChatData;
  let getSession;

  beforeEach(async () => {
    const getSessionModule = await import("./getSession.js");
    getSession = getSessionModule.getSession;

    const exportModule = await import("./exportChatData.js");
    exportChatData = exportModule.exportChatData;
  });

  it("should export messages and session", async () => {
    const mockRequest: any = {};
    const mockIndex: any = { getAll: jest.fn().mockReturnValue(mockRequest) };
    const mockStore: any = { index: jest.fn().mockReturnValue(mockIndex) };
    const mockTx: any = { objectStore: jest.fn().mockReturnValue(mockStore) };
    const mockDb: any = { transaction: jest.fn().mockReturnValue(mockTx) };

    const mockMessages = [{ id: 1, content: "test" }];
    const mockSession: any = { id: "sess1" };

    (getSession as any).mockResolvedValue(mockSession);

    const promise = exportChatData(mockDb, "group1");

    mockRequest.result = mockMessages;

    mockRequest.onsuccess();

    const result = await promise;

    expect(result).toEqual({
      messages: mockMessages,
      session: mockSession,
    });

    expect(mockDb.transaction).toHaveBeenCalledWith("messages", "readonly");
  });

  it("should return null on transaction error", async () => {
    const mockDb: any = {
      transaction: jest.fn().mockImplementation(() => {
        throw new Error("Trans fail");
      }),
    };

    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const result = await exportChatData(mockDb, "group1");

    expect(result).toBeNull();

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("should return null when db transaction is null", async () => {
    const mockDb: any = {
      transaction: jest.fn().mockReturnValue(null),
    };

    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const result = await exportChatData(mockDb, "group1");

    expect(result).toBeNull();

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("should return null when request fails", async () => {
    const mockRequest: any = {};
    const mockIndex: any = { getAll: jest.fn().mockReturnValue(mockRequest) };
    const mockStore: any = { index: jest.fn().mockReturnValue(mockIndex) };
    const mockTx: any = { objectStore: jest.fn().mockReturnValue(mockStore) };
    const mockDb: any = { transaction: jest.fn().mockReturnValue(mockTx) };

    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const promise = exportChatData(mockDb, "group1");

    mockRequest.error = new Error("getAll failed");

    mockRequest.onerror();

    const result = await promise;

    expect(result).toBeNull();

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
