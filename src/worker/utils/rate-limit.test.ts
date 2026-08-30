import { jest } from "@jest/globals";

const mockPost = jest.fn() as any;

jest.unstable_mockModule("./post.js", () => ({
  post: mockPost,
}));

const { waitForRateLimitSlot, updateRateLimitFromHeaders } =
  await import("./rate-limit.js");

describe("rate-limit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("updateRateLimitFromHeaders", () => {
    it("does nothing when autoAdapt is false or headers is null", () => {
      const headers = { get: jest.fn() };
      updateRateLimitFromHeaders("p-disabled", headers as any, {
        callsPerMinute: 60,
        autoAdapt: false,
      });
      expect(headers.get).not.toHaveBeenCalled();

      updateRateLimitFromHeaders("p-null", null, {
        callsPerMinute: 60,
        autoAdapt: true,
      });
    });

    it("parses x-ratelimit headers and updates state", () => {
      const headersMap: Record<string, string> = {
        "x-ratelimit-limit": "100",
        "x-ratelimit-remaining": "50",
        "x-ratelimit-reset": "2", // delta seconds
      };
      const headers = {
        get: (name: string) => headersMap[name.toLowerCase()] ?? null,
      };

      updateRateLimitFromHeaders("p-1", headers as any, {
        callsPerMinute: 0,
        autoAdapt: true,
      });
    });

    it("parses retry-after numeric and HTTP date formats", () => {
      const headersNumeric = {
        get: (name: string) =>
          name.toLowerCase() === "retry-after" ? "5" : null,
      };
      updateRateLimitFromHeaders("p-retry-num", headersNumeric as any, {
        callsPerMinute: 0,
        autoAdapt: true,
      });

      const futureDate = new Date(Date.now() + 10000).toUTCString();
      const headersDate = {
        get: (name: string) =>
          name.toLowerCase() === "retry-after" ? futureDate : null,
      };
      updateRateLimitFromHeaders("p-retry-date", headersDate as any, {
        callsPerMinute: 0,
        autoAdapt: true,
      });

      const pastDate = new Date(Date.now() - 10000).toUTCString();
      const headersPastDate = {
        get: (name: string) =>
          name.toLowerCase() === "retry-after" ? pastDate : null,
      };
      updateRateLimitFromHeaders("p-retry-past", headersPastDate as any, {
        callsPerMinute: 0,
        autoAdapt: true,
      });
    });

    it("parses x-ratelimit-reset as 13-digit epoch ms and 10-digit epoch seconds", () => {
      const epochMs = Date.now() + 5000;
      const headersEpochMs = {
        get: (name: string) =>
          name.toLowerCase() === "x-ratelimit-reset" ? String(epochMs) : null,
      };
      updateRateLimitFromHeaders("p-epoch-ms", headersEpochMs as any, {
        callsPerMinute: 0,
        autoAdapt: true,
      });

      const epochSec = Math.floor(Date.now() / 1000) + 10;
      const headersEpochSec = {
        get: (name: string) =>
          name.toLowerCase() === "x-ratelimit-reset" ? String(epochSec) : null,
      };
      updateRateLimitFromHeaders("p-epoch-sec", headersEpochSec as any, {
        callsPerMinute: 0,
        autoAdapt: true,
      });
    });

    it("sets nextAllowedAt to remoteResetAt when remoteRemaining is 0", () => {
      const resetTime = Date.now() + 3000;
      const headersMap: Record<string, string> = {
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": String(resetTime),
      };
      const headers = {
        get: (name: string) => headersMap[name.toLowerCase()] ?? null,
      };

      updateRateLimitFromHeaders("p-exhausted", headers as any, {
        callsPerMinute: 0,
        autoAdapt: true,
      });
    });
  });

  describe("waitForRateLimitSlot", () => {
    it("allows immediate call when within callsPerMinute limit", async () => {
      await waitForRateLimitSlot("p-instant", "g1", {
        callsPerMinute: 10,
        autoAdapt: false,
      });
    });

    it("paces future calls when autoAdapt has remaining quota and reset window", async () => {
      const resetTime = Date.now() + 1000;
      const headersMap: Record<string, string> = {
        "x-ratelimit-limit": "100",
        "x-ratelimit-remaining": "10",
        "x-ratelimit-reset": String(resetTime),
      };
      const headers = {
        get: (name: string) => headersMap[name.toLowerCase()] ?? null,
      };

      updateRateLimitFromHeaders("p-pacing", headers as any, {
        callsPerMinute: 0,
        autoAdapt: true,
      });

      await waitForRateLimitSlot("p-pacing", "g1", {
        callsPerMinute: 0,
        autoAdapt: true,
      });
    });

    it("aborts when signal is already aborted", async () => {
      const controller = new AbortController();
      controller.abort();

      const headers = {
        get: (name: string) => (name === "retry-after" ? "10" : null),
      };
      updateRateLimitFromHeaders("p-abort-now", headers as any, {
        callsPerMinute: 0,
        autoAdapt: true,
      });

      await expect(
        waitForRateLimitSlot(
          "p-abort-now",
          "g1",
          {
            callsPerMinute: 0,
            autoAdapt: true,
          },
          controller.signal,
        ),
      ).rejects.toThrow("Aborted");
    });

    it("aborts when signal fires while waiting", async () => {
      const controller = new AbortController();

      const headers = {
        get: (name: string) => (name === "retry-after" ? "10" : null),
      };
      updateRateLimitFromHeaders("p-abort-later", headers as any, {
        callsPerMinute: 0,
        autoAdapt: true,
      });

      setTimeout(() => controller.abort(), 20);

      await expect(
        waitForRateLimitSlot(
          "p-abort-later",
          "g1",
          {
            callsPerMinute: 0,
            autoAdapt: true,
          },
          controller.signal,
        ),
      ).rejects.toThrow("Aborted");
    });
  });
});
