import { jest } from "@jest/globals";

jest.unstable_mockModule("./db.mjs", () => ({
  getDb: jest.fn(),
}));

const { getRecentMessages } = await import("./getRecentMessages.mjs");
const { getDb } = await import("./db.mjs");

describe("getRecentMessages", () => {
  beforeEach(() => {
    global.IDBKeyRange = {
      bound: jest.fn(() => "mock-range"),
    };
  });

  it("returns messages ordered oldest-first", async () => {
    const request = { result: null, onsuccess: null, onerror: null };
    const index = { openCursor: jest.fn(() => request) };
    const store = { index: jest.fn(() => index) };
    const tx = { objectStore: jest.fn(() => store) };
    getDb.mockReturnValue({ transaction: jest.fn(() => tx) });

    const cursor2 = {
      value: { id: "m1" },
      continue: jest.fn(() => {
        request.result = null;
        request.onsuccess();
      }),
    };

    const cursor1 = {
      value: { id: "m2" },
      continue: jest.fn(() => {
        request.result = cursor2;
        request.onsuccess();
      }),
    };

    const promise = getRecentMessages("group-1", 10);
    request.result = cursor1;
    request.onsuccess();

    await expect(promise).resolves.toEqual([{ id: "m1" }, { id: "m2" }]);

    expect(global.IDBKeyRange.bound).toHaveBeenCalledWith(
      ["group-1", 0],
      ["group-1", Infinity],
    );

    expect(index.openCursor).toHaveBeenCalledWith("mock-range", "prev");
  });

  it("rejects when cursor request errors", async () => {
    const request = {
      result: null,
      onsuccess: null,
      onerror: null,
      error: null,
    };
    const index = { openCursor: jest.fn(() => request) };
    const store = { index: jest.fn(() => index) };
    const tx = { objectStore: jest.fn(() => store) };
    getDb.mockReturnValue({ transaction: jest.fn(() => tx) });

    const promise = getRecentMessages("group-1", 10);
    request.error = new Error("cursor failed");
    request.onerror();

    await expect(promise).rejects.toThrow("cursor failed");
  });

  it("rejects when transaction cannot be created", async () => {
    getDb.mockReturnValue(null);

    await expect(getRecentMessages("group-1", 10)).rejects.toThrow(
      "failed to get transaction",
    );
  });
});
