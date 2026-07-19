// @ts-nocheck
import { jest } from "@jest/globals";
import {
  computeDelay,
  sleep,
  withRetry,
  isRetryableHttpError,
  isRetryableFetchError,
  RETRYABLE_STATUS_CODES,
} from "./withRetry.js";

// Helper: flush the microtask queue so async code reaches the next setTimeout
const flushMicrotasks = () =>
  new Promise((r) =>
    jest
      .requireActual("timers")
      .then(() => r())
      .catch(() => r()),
  );

// Simpler helper – just drain the microtask queue
const tick = () => new Promise((resolve) => resolve(undefined));

// ── computeDelay ───────────────────────────────────────────────────

describe("computeDelay", () => {
  it("returns baseDelayMs on first attempt with no jitter", () => {
    expect(computeDelay(0, 1000, 30000, 0)).toBe(1000);
  });

  it("doubles delay on each attempt", () => {
    expect(computeDelay(1, 1000, 30000, 0)).toBe(2000);
    expect(computeDelay(2, 1000, 30000, 0)).toBe(4000);
    expect(computeDelay(3, 1000, 30000, 0)).toBe(8000);
  });

  it("caps delay at maxDelayMs", () => {
    expect(computeDelay(10, 1000, 5000, 0)).toBe(5000);
  });

  it("applies jitter to reduce delay", () => {
    // With jitter = 1 and Math.random() mocked, delay should vary
    const results = new Set();
    for (let i = 0; i < 20; i++) {
      results.add(computeDelay(0, 1000, 30000, 1));
    }

    // With jitter, we should get varied results (at least sometimes)
    // Due to randomness, just check that values are within expected range
    for (const val of results) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1000);
    }
  });

  it("returns 0 when baseDelayMs is 0", () => {
    expect(computeDelay(0, 0, 30000, 0)).toBe(0);
  });

  it("never returns negative", () => {
    for (let i = 0; i < 50; i++) {
      expect(computeDelay(i, 100, 500, 1)).toBeGreaterThanOrEqual(0);
    }
  });
});

// ── sleep ──────────────────────────────────────────────────────────

describe("sleep", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("resolves after the given duration", async () => {
    const p = sleep(100);
    jest.advanceTimersByTime(100);
    await expect(p).resolves.toBeUndefined();
  });

  it("rejects immediately if signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(sleep(100, controller.signal)).rejects.toThrow();
  });

  it("rejects when signal is aborted during sleep", async () => {
    const controller = new AbortController();
    const p = sleep(10000, controller.signal);
    // Abort mid-sleep
    setTimeout(() => controller.abort(), 50);
    jest.advanceTimersByTime(50);
    await expect(p).rejects.toThrow();
  });
});

// ── withRetry ──────────────────────────────────────────────────────

describe("withRetry", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns the result on first success", async () => {
    const fn = (jest.fn() as any).mockResolvedValue("ok");
    const p = withRetry(fn, { maxRetries: 3 });
    const result = await p;
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and succeeds", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue("ok");

    const p = withRetry(fn, {
      maxRetries: 3,
      baseDelayMs: 100,
      jitterFactor: 0,
    });

    // Flush microtasks so the first call rejects and code reaches sleep()
    await tick();
    await tick();
    jest.advanceTimersByTime(100);

    const result = await p;
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("exhausts all retries and throws the last error", async () => {
    const fn = (jest.fn() as any).mockRejectedValue(new Error("always fails"));
    const p = withRetry(fn, {
      maxRetries: 2,
      baseDelayMs: 100,
      jitterFactor: 0,
    });

    // Retry 1: flush microtasks, then advance timer for 100ms delay
    await tick();
    await tick();
    jest.advanceTimersByTime(100);

    // Retry 2: flush microtasks, then advance timer for 200ms delay
    await tick();
    await tick();
    jest.advanceTimersByTime(200);

    await expect(p).rejects.toThrow("always fails");
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it("does not retry when shouldRetry returns false", async () => {
    const fn = (jest.fn() as any).mockRejectedValue(new Error("non-retryable"));
    const p = withRetry(fn, {
      maxRetries: 3,
      shouldRetry: () => false,
    });
    await expect(p).rejects.toThrow("non-retryable");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("calls onRetry callback before each retry", async () => {
    const onRetry = jest.fn();
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error("fail1"))
      .mockRejectedValueOnce(new Error("fail2"))
      .mockResolvedValue("ok");

    const p = withRetry(fn, {
      maxRetries: 3,
      baseDelayMs: 100,
      jitterFactor: 0,
      onRetry,
    });

    // Retry 1
    await tick();
    await tick();
    jest.advanceTimersByTime(100);

    // Retry 2
    await tick();
    await tick();
    jest.advanceTimersByTime(200);

    const result = await p;

    expect(result).toBe("ok");
    expect(onRetry).toHaveBeenCalledTimes(2);
    // First retry: attempt=1, maxRetries=3, delayMs=100, error
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, 3, 100, expect.any(Error));
    // Second retry: attempt=2, maxRetries=3, delayMs=200, error
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, 3, 200, expect.any(Error));
  });

  it("immediately throws AbortError without retrying", async () => {
    const abortError = new DOMException("Aborted", "AbortError");
    const fn = (jest.fn() as any).mockRejectedValue(abortError);
    const p = withRetry(fn, { maxRetries: 3 });
    await expect(p).rejects.toThrow("Aborted");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throws if signal is already aborted before first call", async () => {
    const controller = new AbortController();
    controller.abort();
    const fn = (jest.fn() as any).mockResolvedValue("ok");
    const p = withRetry(fn, { signal: controller.signal });
    await expect(p).rejects.toThrow();
    expect(fn).not.toHaveBeenCalled();
  });

  it("respects abort signal during retry sleep", async () => {
    const controller = new AbortController();
    const fn = (jest.fn() as any).mockRejectedValue(new Error("fail"));

    const p = withRetry(fn, {
      maxRetries: 5,
      baseDelayMs: 5000,
      jitterFactor: 0,
      signal: controller.signal,
    });

    // After first failure, abort during the sleep
    await tick();
    await tick();
    controller.abort();
    jest.advanceTimersByTime(1);

    await expect(p).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("works with maxRetries = 0 (no retries)", async () => {
    const fn = (jest.fn() as any).mockRejectedValue(new Error("once"));
    const p = withRetry(fn, { maxRetries: 0 });
    await expect(p).rejects.toThrow("once");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("handles non-Error throws", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce("string error")
      .mockResolvedValue("ok");

    const p = withRetry(fn, {
      maxRetries: 1,
      baseDelayMs: 50,
      jitterFactor: 0,
    });

    // Flush microtasks so the first rejection is caught and sleep() is entered
    await tick();
    await tick();
    jest.advanceTimersByTime(50);

    const result = await p;
    expect(result).toBe("ok");
  });
});

// ── isRetryableHttpError ───────────────────────────────────────────

describe("isRetryableHttpError", () => {
  it("returns true for TypeError (network error)", () => {
    expect(isRetryableHttpError(new TypeError("Failed to fetch"))).toBe(true);
  });

  it("returns true for errors with retryable status codes", () => {
    for (const status of RETRYABLE_STATUS_CODES) {
      expect(isRetryableHttpError({ status })).toBe(true);
    }
  });

  it("returns false for non-retryable status codes", () => {
    expect(isRetryableHttpError({ status: 400 })).toBe(false);
    expect(isRetryableHttpError({ status: 401 })).toBe(false);
    expect(isRetryableHttpError({ status: 403 })).toBe(false);
    expect(isRetryableHttpError({ status: 404 })).toBe(false);
    expect(isRetryableHttpError({ status: 422 })).toBe(false);
  });

  it("detects retryable status codes in error messages", () => {
    expect(isRetryableHttpError(new Error("API error 429: rate limited"))).toBe(
      true,
    );
    expect(
      isRetryableHttpError(new Error("HTTP 503 Service Unavailable")),
    ).toBe(true);
    expect(isRetryableHttpError(new Error("API error 502: Bad Gateway"))).toBe(
      true,
    );
  });

  it("returns false for non-retryable status codes in messages", () => {
    expect(isRetryableHttpError(new Error("API error 400: Bad Request"))).toBe(
      false,
    );
    expect(isRetryableHttpError(new Error("API error 401: Unauthorized"))).toBe(
      false,
    );
  });

  it("detects network-related error messages", () => {
    expect(isRetryableHttpError(new Error("network error"))).toBe(true);
    expect(isRetryableHttpError(new Error("ECONNRESET"))).toBe(true);
    expect(isRetryableHttpError(new Error("ECONNREFUSED"))).toBe(true);
    expect(isRetryableHttpError(new Error("ETIMEDOUT"))).toBe(true);
    expect(isRetryableHttpError(new Error("fetch failed"))).toBe(true);
    expect(
      isRetryableHttpError(
        new Error("getaddrinfo EAI_AGAIN cdnjs.cloudflare.com"),
      ),
    ).toBe(true);
    expect(isRetryableHttpError(new Error("EAI_NONAME"))).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isRetryableHttpError(new Error("Invalid JSON"))).toBe(false);
    expect(isRetryableHttpError(new Error("Missing parameter"))).toBe(false);
    expect(isRetryableHttpError(null)).toBe(false);
    expect(isRetryableHttpError(undefined)).toBe(false);
    expect(isRetryableHttpError(42)).toBe(false);
  });
});

// ── isRetryableFetchError ──────────────────────────────────────────

describe("isRetryableFetchError", () => {
  it("returns true for TypeError (network error)", () => {
    expect(isRetryableFetchError(new TypeError("Failed to fetch"))).toBe(true);
  });

  it("returns true for response objects with retryable status", () => {
    expect(isRetryableFetchError({ status: 429 })).toBe(true);
    expect(isRetryableFetchError({ status: 503 })).toBe(true);
  });

  it("returns false for response objects with non-retryable status", () => {
    expect(isRetryableFetchError({ status: 400 })).toBe(false);
    expect(isRetryableFetchError({ status: 404 })).toBe(false);
  });

  it("detects network errors in message", () => {
    expect(isRetryableFetchError(new Error("ECONNREFUSED"))).toBe(true);
    expect(isRetryableFetchError(new Error("network timeout"))).toBe(true);
    expect(isRetryableFetchError(new Error("getaddrinfo EAI_AGAIN"))).toBe(
      true,
    );
  });

  it("returns false for non-network errors", () => {
    expect(isRetryableFetchError(new Error("parse error"))).toBe(false);
    expect(isRetryableFetchError("string")).toBe(false);
    expect(isRetryableFetchError(null)).toBe(false);
  });
});

// ── RETRYABLE_STATUS_CODES ────────────────────────────────────────

describe("RETRYABLE_STATUS_CODES", () => {
  it("includes the expected status codes", () => {
    expect(RETRYABLE_STATUS_CODES.has(408)).toBe(true);
    expect(RETRYABLE_STATUS_CODES.has(429)).toBe(true);
    expect(RETRYABLE_STATUS_CODES.has(500)).toBe(true);
    expect(RETRYABLE_STATUS_CODES.has(502)).toBe(true);
    expect(RETRYABLE_STATUS_CODES.has(503)).toBe(true);
    expect(RETRYABLE_STATUS_CODES.has(504)).toBe(true);
  });

  it("does not include non-retryable codes", () => {
    expect(RETRYABLE_STATUS_CODES.has(200)).toBe(false);
    expect(RETRYABLE_STATUS_CODES.has(400)).toBe(false);
    expect(RETRYABLE_STATUS_CODES.has(401)).toBe(false);
    expect(RETRYABLE_STATUS_CODES.has(403)).toBe(false);
    expect(RETRYABLE_STATUS_CODES.has(404)).toBe(false);
  });
});
