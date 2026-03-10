import { jest } from "@jest/globals";

jest.unstable_mockModule("./db.mjs", () => ({
  getDb: jest.fn(),
}));

const { txPromise, txPromiseAll } = await import("./txPromise.mjs");
const { getDb } = await import("./db.mjs");

describe("txPromise", () => {
  it("resolves request result", async () => {
    const request = {};
    const store = {};
    const db = {
      transaction: jest.fn(() => ({
        objectStore: jest.fn(() => store),
      })),
    };

    const pending = txPromise(db, "s", "readonly", () => request);
    request.result = 42;
    request.onsuccess();

    await expect(pending).resolves.toBe(42);
  });

  it("throws when transaction is unavailable", async () => {
    const db = { transaction: jest.fn(() => null) };
    await expect(txPromise(db, "x", "readonly", () => ({}))).rejects.toThrow(
      "failed to get transaction",
    );
  });
});

describe("txPromiseAll", () => {
  it("resolves all results in order", async () => {
    const req1 = {};
    const req2 = {};
    const store = {};

    getDb.mockReturnValue({
      transaction: jest.fn(() => ({
        objectStore: jest.fn(() => store),
      })),
    });

    const pending = txPromiseAll("s", "readonly", () => [req1, req2]);
    req2.result = "b";
    req1.result = "a";
    req2.onsuccess();
    req1.onsuccess();

    await expect(pending).resolves.toEqual(["a", "b"]);
  });

  it("resolves empty array when no requests", async () => {
    getDb.mockReturnValue({
      transaction: jest.fn(() => ({ objectStore: jest.fn(() => ({})) })),
    });

    await expect(txPromiseAll("s", "readonly", () => [])).resolves.toEqual([]);
  });
});
