import { afterEach, describe, expect, it, jest } from "@jest/globals";

import {
  CHUNK_LOAD_ERROR_EVENT,
  ensureComponentLoaded,
} from "./load-component.js";

describe("ensureComponentLoaded", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("evicts failed loads from the cache so subsequent calls retry and dispatches chunk-load-error", async () => {
    const chunkError = new TypeError(
      "Failed to fetch dynamically imported module",
    );
    const loader = jest
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(chunkError)
      .mockResolvedValueOnce({ default: class {} });

    const events: CustomEvent[] = [];
    const listener = (event: Event) => {
      events.push(event as CustomEvent);
    };
    globalThis.addEventListener(CHUNK_LOAD_ERROR_EVENT, listener);

    try {
      await expect(
        ensureComponentLoaded("retry-test-panel", {
          "retry-test-panel": loader,
        }),
      ).rejects.toThrow(chunkError);

      expect(events).toHaveLength(1);
      expect(events[0].detail).toEqual({
        name: "retry-test-panel",
        error: chunkError,
      });

      await expect(
        ensureComponentLoaded("retry-test-panel", {
          "retry-test-panel": loader,
        }),
      ).resolves.toBeUndefined();

      expect(loader).toHaveBeenCalledTimes(2);
    } finally {
      globalThis.removeEventListener(CHUNK_LOAD_ERROR_EVENT, listener);
    }
  });

  it("memoizes successful loads so the loader is only invoked once", async () => {
    const loader = jest
      .fn<() => Promise<unknown>>()
      .mockResolvedValue({ default: class {} });

    await ensureComponentLoaded("memo-test-panel", {
      "memo-test-panel": loader,
    });
    await ensureComponentLoaded("memo-test-panel", {
      "memo-test-panel": loader,
    });

    expect(loader).toHaveBeenCalledTimes(1);
  });
});
