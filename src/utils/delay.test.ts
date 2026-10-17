import { jest } from "@jest/globals";
import { computeDelay, sleep, yieldToMain } from "./delay.js";

describe("computeDelay", () => {
  it("computes exponential delay without jitter", () => {
    expect(computeDelay(0, 1000, 15000, 0)).toBe(1000);
    expect(computeDelay(1, 1000, 15000, 0)).toBe(2000);
    expect(computeDelay(2, 1000, 15000, 0)).toBe(4000);
    expect(computeDelay(3, 1000, 15000, 0)).toBe(8000);
    expect(computeDelay(4, 1000, 15000, 0)).toBe(15000);
    expect(computeDelay(5, 1000, 15000, 0)).toBe(15000);
  });

  it("applies jitter factor within expected range", () => {
    const delay = computeDelay(2, 1000, 15000, 0.2);
    // 4000 * (1 - 0.2) = 3200 <= delay <= 4000
    expect(delay).toBeGreaterThanOrEqual(3200);
    expect(delay).toBeLessThanOrEqual(4000);
  });
});

describe("sleep", () => {
  it("resolves after the given duration", async () => {
    const start = Date.now();
    await sleep(20);
    expect(Date.now() - start).toBeGreaterThanOrEqual(15);
  });

  it("rejects immediately if signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(sleep(1000, controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
  });

  it("rejects when aborted while sleeping", async () => {
    const controller = new AbortController();
    const promise = sleep(1000, controller.signal);

    setTimeout(() => controller.abort(), 20);

    await expect(promise).rejects.toMatchObject({
      name: "AbortError",
    });
  });
});

describe("yieldToMain", () => {
  it("uses scheduler.yield when available", async () => {
    const origScheduler = (globalThis as any).scheduler;
    const yieldMock = jest.fn().mockResolvedValue(undefined);
    (globalThis as any).scheduler = { yield: yieldMock };

    try {
      await yieldToMain();
      expect(yieldMock).toHaveBeenCalledTimes(1);
    } finally {
      (globalThis as any).scheduler = origScheduler;
    }
  });

  it("falls back to setTimeout when scheduler.yield is unavailable", async () => {
    const origScheduler = (globalThis as any).scheduler;
    delete (globalThis as any).scheduler;
    const setTimeoutSpy = jest.spyOn(globalThis, "setTimeout");

    try {
      await yieldToMain();
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 0);
    } finally {
      (globalThis as any).scheduler = origScheduler;
      setTimeoutSpy.mockRestore();
    }
  });
});
