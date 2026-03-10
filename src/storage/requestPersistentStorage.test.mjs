import { jest } from "@jest/globals";

import { requestPersistentStorage } from "./requestPersistentStorage.mjs";

describe("requestPersistentStorage", () => {
  it("delegates to storage.persist", async () => {
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: { persist: jest.fn().mockResolvedValue(true) },
    });
    await expect(requestPersistentStorage()).resolves.toBe(true);
  });
});
