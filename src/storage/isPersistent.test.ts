import { jest } from "@jest/globals";

import { isPersistent } from "./isPersistent.js";

describe("isPersistent", () => {
  it("delegates to navigator.storage.persisted", async () => {
    Object.defineProperty(navigator, "storage", {
      configurable: true,

      value: { persisted: (jest.fn() as any).mockResolvedValue(true) },
    });
    await expect(isPersistent()).resolves.toBe(true);
  });

  it("returns false without API", async () => {
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: undefined,
    });
    await expect(isPersistent()).resolves.toBe(false);
  });
});
