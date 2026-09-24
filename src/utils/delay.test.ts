import { computeDelay, sleep } from "./delay.js";

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
