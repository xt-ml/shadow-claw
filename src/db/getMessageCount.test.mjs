import { jest } from "@jest/globals";

import { getMessageCount } from "./getMessageCount.mjs";

describe("getMessageCount", () => {
  it("counts messages for a group", async () => {
    const request = {};
    const index = { count: jest.fn(() => request) };
    const store = { index: jest.fn(() => index) };

    globalThis.getDb = () => ({
      transaction: () => ({ objectStore: () => store }),
    });

    const pending = getMessageCount("g1");
    request.result = 7;
    request.onsuccess();

    await expect(pending).resolves.toBe(7);
  });
});
