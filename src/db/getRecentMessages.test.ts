import { jest } from "@jest/globals";

jest.unstable_mockModule("./db.js", () => ({
  getDb: jest.fn(),
}));

const { getRecentMessages } = await import("./getRecentMessages.js");
const { getDb } = await import("./db.js");

describe("getRecentMessages", () => {
  beforeEach(() => {
    (global as any).IDBKeyRange = {
      bound: jest.fn(() => "mock-range"),
    };
  });

  it("returns messages ordered oldest-first", async () => {
    const request: any = { result: null, onsuccess: null, onerror: null };
    const index: any = { openCursor: jest.fn(() => request) };
    const store: any = { index: jest.fn(() => index) };
    const tx: any = { objectStore: jest.fn(() => store) };

    (getDb as any).mockReturnValue({ transaction: jest.fn(() => tx) });

    const cursor2: any = {
      value: { id: "m1" },

      continue: jest.fn(() => {
        request.result = null;

        request.onsuccess();
      }),
    };

    const cursor1: any = {
      value: { id: "m2" },

      continue: jest.fn(() => {
        request.result = cursor2;

        request.onsuccess();
      }),
    };

    const promise = getRecentMessages("group-1", 10);
    await Promise.resolve(); // Allow getRecentMessages to attach handlers

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
    const request: any = {
      result: null,
      onsuccess: null,
      onerror: null,
      error: null,
    };
    const index: any = { openCursor: jest.fn(() => request) };
    const store: any = { index: jest.fn(() => index) };
    const tx: any = { objectStore: jest.fn(() => store) };

    (getDb as any).mockReturnValue({ transaction: jest.fn(() => tx) });

    const promise = getRecentMessages("group-1", 10);
    await Promise.resolve(); // Allow getRecentMessages to attach handlers

    request.error = new Error("cursor failed");

    request.onerror();

    await expect(promise).rejects.toThrow("cursor failed");
  });

  it("rejects when transaction cannot be created", async () => {
    (getDb as any).mockReturnValue(null);

    await expect(getRecentMessages("group-1", 10)).rejects.toThrow(
      "failed to get transaction",
    );
  });
});
