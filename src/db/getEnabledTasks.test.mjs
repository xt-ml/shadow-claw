import { jest } from "@jest/globals";

jest.unstable_mockModule("./db.mjs", () => ({
  getDb: jest.fn(),
}));

const { getEnabledTasks } = await import("./getEnabledTasks.mjs");
const { getDb } = await import("./db.mjs");

describe("getEnabledTasks", () => {
  it("reads enabled tasks and normalizes enabled flag", async () => {
    const request = {};
    const index = { getAll: jest.fn(() => request) };
    const store = { index: jest.fn(() => index) };

    getDb.mockReturnValue({
      transaction: jest.fn(() => ({ objectStore: jest.fn(() => store) })),
    });

    const pending = getEnabledTasks();
    request.result = [
      { id: "1", enabled: 1 },
      { id: "2", enabled: 1 },
    ];
    request.onsuccess();

    await expect(pending).resolves.toEqual([
      { id: "1", enabled: true },
      { id: "2", enabled: true },
    ]);
  });

  it("throws error if transaction is null", async () => {
    getDb.mockReturnValue({
      transaction: jest.fn(() => null),
    });

    await expect(getEnabledTasks()).rejects.toThrow(
      "failed to get transaction",
    );
  });

  it("throws error if transaction is undefined", async () => {
    getDb.mockReturnValue(null);

    await expect(getEnabledTasks()).rejects.toThrow(
      "failed to get transaction",
    );
  });

  it("rejects if request fails", async () => {
    const request = {};
    const index = { getAll: jest.fn(() => request) };
    const store = { index: jest.fn(() => index) };

    getDb.mockReturnValue({
      transaction: jest.fn(() => ({ objectStore: jest.fn(() => store) })),
    });

    const pending = getEnabledTasks();
    request.error = new Error("Get all failed");
    request.onerror();

    await expect(pending).rejects.toThrow("Get all failed");
  });
});
