import { jest } from "@jest/globals";

const openDatabase = jest.fn();

jest.unstable_mockModule("./openDatabase.js", () => ({
  openDatabase,
}));

const { getAllGroupIds } = await import("./getAllGroupIds.js");

describe("getAllGroupIds", () => {
  it("collects unique group ids from key cursor", async () => {
    const request: any = {};
    const c1: any = {
      key: "a",

      continue: jest.fn(() => {
        request.result = c2;

        request.onsuccess();
      }),
    };
    const c2: any = {
      key: "b",

      continue: jest.fn(() => {
        request.result = null;

        request.onsuccess();
      }),
    };

    const db: any = {
      transaction: jest.fn(() => ({
        objectStore: jest.fn(() => ({
          index: jest.fn(() => ({
            openKeyCursor: jest.fn(() => request),
          })),
        })),
      })),
    };

    (openDatabase as any).mockResolvedValue(db);

    const pending = getAllGroupIds();

    // Wait for the internal await openDatabase() to finish
    await new Promise((resolve) => setTimeout(resolve, 0));

    request.result = c1;

    request.onsuccess();

    await expect(pending).resolves.toEqual(["a", "b"]);
    expect(openDatabase).toHaveBeenCalled();
  });
});
