import { jest } from "@jest/globals";

import { getAllGroupIds } from "./getAllGroupIds.mjs";

describe("getAllGroupIds", () => {
  it("collects unique group ids from key cursor", async () => {
    const request = {};
    const c1 = {
      key: "a",
      continue: jest.fn(() => {
        request.result = c2;
        request.onsuccess();
      }),
    };
    const c2 = {
      key: "b",
      continue: jest.fn(() => {
        request.result = null;
        request.onsuccess();
      }),
    };

    globalThis.getDb = () => ({
      transaction: () => ({
        objectStore: () => ({
          index: () => ({ openKeyCursor: () => request }),
        }),
      }),
    });

    const pending = getAllGroupIds();
    request.result = c1;
    request.onsuccess();

    await expect(pending).resolves.toEqual(["a", "b"]);
  });
});
