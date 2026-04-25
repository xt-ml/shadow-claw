import { jest } from "@jest/globals";

jest.unstable_mockModule("./db.js", () => ({
  getDb: jest.fn(),
}));

const { txPromise, txPromiseAll } = await import("./txPromise.js");
const { getDb } = await import("./db.js");

describe("txPromise", () => {
  it("resolves request result", async () => {
    const request: any = {};
    const store: any = {};
    const db: any = {
      transaction: jest.fn(() => ({
        objectStore: jest.fn(() => store),
      })),
    };

    const pending = txPromise(db, "s", "readonly", () => request);

    request.result = 42;

    request.onsuccess?.();

    await expect(pending).resolves.toBe(42);
  });

  it("throws when transaction is unavailable", async () => {
    const db: any = { transaction: jest.fn(() => null) };

    await expect(
      txPromise(db, "x", "readonly", () => ({}) as any),
    ).rejects.toThrow("failed to get transaction");
  });
});

describe("txPromiseAll", () => {
  it("resolves all results in order", async () => {
    const req1: any = {};
    const req2: any = {};
    const store: any = {};

    (getDb as any).mockReturnValue({
      transaction: jest.fn(() => ({
        objectStore: jest.fn(() => store),
      })),
    });

    const pending = txPromiseAll("s", "readonly", () => [req1, req2]);
    await Promise.resolve(); // Allow executor to reach await getDb()

    req2.result = "b";

    req1.result = "a";
    (req2 as any).onsuccess();
    (req1 as any).onsuccess();

    await expect(pending).resolves.toEqual(["a", "b"]);
  });

  it("resolves empty array when no requests", async () => {
    (getDb as any).mockReturnValue({
      transaction: jest.fn(() => ({ objectStore: jest.fn(() => ({}) as any) })),
    });

    await expect(txPromiseAll("s", "readonly", () => [])).resolves.toEqual([]);
  });
});
