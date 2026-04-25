import { jest } from "@jest/globals";

import { requestPersistentStorage } from "./requestPersistentStorage.js";

describe("requestPersistentStorage", () => {
  it("delegates to storage.persist", async () => {
    Object.defineProperty(navigator, "storage", {
      configurable: true,

      value: { persist: (jest.fn() as any).mockResolvedValue(true) },
    });
    await expect(requestPersistentStorage()).resolves.toBe(true);
  });
});
