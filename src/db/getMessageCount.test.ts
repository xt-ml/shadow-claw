import { jest } from "@jest/globals";

const openDatabase = jest.fn();

jest.unstable_mockModule("./openDatabase.js", () => ({
  openDatabase,
}));

const { getMessageCount } = await import("./getMessageCount.js");

describe("getMessageCount", () => {
  it("counts messages for a group", async () => {
    const request: any = {};
    const index: any = { count: jest.fn(() => request) };
    const store: any = { index: jest.fn(() => index) };
    const db: any = {
      transaction: jest.fn(() => ({
        objectStore: jest.fn(() => store),
      })),
    };

    (openDatabase as any).mockResolvedValue(db);

    const pending = getMessageCount("g1");

    // Wait for the internal await openDatabase() to finish
    await new Promise((resolve) => setTimeout(resolve, 0));

    request.result = 7;

    request.onsuccess();

    await expect(pending).resolves.toBe(7);

    expect(openDatabase).toHaveBeenCalled();
    expect(db.transaction).toHaveBeenCalledWith("messages", "readonly");
  });
});
