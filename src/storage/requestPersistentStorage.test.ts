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

  it("returns false without API", async () => {
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: undefined,
    });
    await expect(requestPersistentStorage()).resolves.toBe(false);
  });

  it("returns false when persist() throws an error", async () => {
    const spy = jest.spyOn(console, "warn").mockImplementation(() => {});
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: {
        persist: (jest.fn() as any).mockRejectedValue(new Error("Restricted")),
      },
    });
    await expect(requestPersistentStorage()).resolves.toBe(false);
    spy.mockRestore();
  });
});
