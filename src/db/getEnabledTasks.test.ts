import { jest } from "@jest/globals";

jest.unstable_mockModule("./db.js", () => ({
  getDb: jest.fn(),
}));

const { getEnabledTasks } = await import("./getEnabledTasks.js");
const { getDb } = await import("./db.js");

describe("getEnabledTasks", () => {
  it("reads enabled tasks and normalizes enabled flag", async () => {
    const request: any = {};
    const index: any = { getAll: jest.fn(() => request) };
    const store: any = { index: jest.fn(() => index) };

    (getDb as any).mockResolvedValue({
      transaction: jest.fn(() => ({ objectStore: jest.fn(() => store) })),
    });

    const pending = getEnabledTasks();
    await Promise.resolve(); // Allow executor to reach request.onsuccess

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
    (getDb as any).mockReturnValue({
      transaction: jest.fn(() => null),
    });

    await expect(getEnabledTasks()).rejects.toThrow(
      "failed to get transaction",
    );
  });

  it("throws error if transaction is undefined", async () => {
    (getDb as any).mockReturnValue(null);

    await expect(getEnabledTasks()).rejects.toThrow(
      "failed to get transaction",
    );
  });

  it("rejects if request fails", async () => {
    const request: any = {};
    const index: any = { getAll: jest.fn(() => request) };
    const store: any = { index: jest.fn(() => index) };

    (getDb as any).mockReturnValue({
      transaction: jest.fn(() => ({ objectStore: jest.fn(() => store) })),
    });

    const pending = getEnabledTasks();
    await Promise.resolve(); // Allow executor to reach await getDb()

    request.error = new Error("Get all failed");

    request.onerror();

    await expect(pending).rejects.toThrow("Get all failed");
  });
});
