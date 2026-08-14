import { delayWithAbort } from "./delayWithAbort.js";

describe("delayWithAbort", () => {
  it("resolves after the specified delay", async () => {
    const start = Date.now();
    await delayWithAbort(20);
    expect(Date.now() - start).toBeGreaterThanOrEqual(15);
  });

  it("rejects immediately with AbortError if signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(delayWithAbort(1000, controller.signal)).rejects.toThrow(
      "Aborted",
    );
  });

  it("rejects with AbortError when signal is aborted during the delay", async () => {
    const controller = new AbortController();
    const promise = delayWithAbort(1000, controller.signal);

    setTimeout(() => {
      controller.abort();
    }, 10);

    await expect(promise).rejects.toThrow("Aborted");
  });
});
