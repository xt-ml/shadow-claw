import { jest } from "@jest/globals";

import { getStorageEstimate } from "./getStorageEstimate.js";

describe("getStorageEstimate", () => {
  it("returns estimated usage and quota", async () => {
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: {
        estimate: (jest.fn() as any).mockResolvedValue({
          usage: 10,
          quota: 100,
        }),
      },
    });

    await expect(getStorageEstimate()).resolves.toEqual({
      usage: 10,
      quota: 100,
    });
  });

  it("returns zeros when API is unavailable", async () => {
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: undefined,
    });
    await expect(getStorageEstimate()).resolves.toEqual({ usage: 0, quota: 0 });
  });
});
