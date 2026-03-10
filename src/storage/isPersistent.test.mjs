import { jest } from "@jest/globals";

import { isPersistent } from "./isPersistent.mjs";

describe("isPersistent", () => {
  it("delegates to navigator.storage.persisted", async () => {
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: { persisted: jest.fn().mockResolvedValue(true) },
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
