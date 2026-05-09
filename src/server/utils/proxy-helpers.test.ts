/** @jest-environment node */
import { jest } from "@jest/globals";
import {
  getFirstHeaderValue,
  extractBearerToken,
  parsePositiveInteger,
  parseNonNegativeInteger,
  isTelegramProxyPath,
  redactSensitiveUrl,
  requestHasTools,
  stripToolsFromRequest,
  ollamaDoesNotSupportTools,
  parseLooseToolCallInput,
  parseLooseFunctionCallArgs,
  fetchWithTimeout,
  handleProxyRequest,
  handleStreamingProxyRequest,
} from "./proxy-helpers.js";

describe("proxy-helpers", () => {
  describe("getFirstHeaderValue", () => {
    it("returns string as is", () => {
      expect(getFirstHeaderValue("text/plain")).toBe("text/plain");
    });

    it("returns first element of array", () => {
      expect(getFirstHeaderValue(["a", "b"])).toBe("a");
    });

    it("returns empty string for undefined", () => {
      expect(getFirstHeaderValue(undefined)).toBe("");
    });
  });

  describe("extractBearerToken", () => {
    it("extracts token correctly", () => {
      expect(extractBearerToken("Bearer abc-123")).toBe("abc-123");
    });

    it("returns empty string for invalid format", () => {
      expect(extractBearerToken("Basic abc")).toBe("");
      expect(extractBearerToken("Bearer")).toBe("");
    });
  });

  describe("parsePositiveInteger", () => {
    it("parses valid positive integer", () => {
      expect(parsePositiveInteger("123", 10)).toBe(123);
    });

    it("returns fallback for non-positive or invalid input", () => {
      expect(parsePositiveInteger("0", 10)).toBe(10);
      expect(parsePositiveInteger("-1", 10)).toBe(10);
      expect(parsePositiveInteger("abc", 10)).toBe(10);
      expect(parsePositiveInteger(undefined, 10)).toBe(10);
    });
  });

  describe("parseNonNegativeInteger", () => {
    it("parses valid non-negative integer", () => {
      expect(parseNonNegativeInteger("0", 10)).toBe(0);
      expect(parseNonNegativeInteger("123", 10)).toBe(123);
    });

    it("returns fallback for negative or invalid input", () => {
      expect(parseNonNegativeInteger("-1", 10)).toBe(10);
      expect(parseNonNegativeInteger("abc", 10)).toBe(10);
      expect(parseNonNegativeInteger(undefined, 10)).toBe(10);
    });
  });

  describe("isTelegramProxyPath", () => {
    it("identifies telegram proxy paths", () => {
      expect(isTelegramProxyPath("/telegram/bot123/getMe")).toBe(true);
      expect(isTelegramProxyPath("/telegram/file/bot123/photo.jpg")).toBe(true);
      expect(isTelegramProxyPath("/other/path")).toBe(false);
    });
  });

  describe("redactSensitiveUrl", () => {
    it("redacts telegram bot tokens", () => {
      const url =
        "https://api.telegram.org/telegram/bot12345:ABCDE/sendMessage";
      expect(redactSensitiveUrl(url)).toBe(
        "https://api.telegram.org/telegram/bot[REDACTED]/sendMessage",
      );
    });

    it("redacts telegram file bot tokens", () => {
      const url =
        "https://api.telegram.org/telegram/file/bot12345:ABCDE/image.png";
      expect(redactSensitiveUrl(url)).toBe(
        "https://api.telegram.org/telegram/file/bot[REDACTED]/image.png",
      );
    });

    it("leaves other URLs alone", () => {
      const url = "https://example.com/api/v1";
      expect(redactSensitiveUrl(url)).toBe(url);
    });
  });

  describe("fetchWithTimeout", () => {
    beforeEach(() => {
      global.fetch = jest.fn() as any;
    });

    it("calls fetch normally if no timeout", async () => {
      (global.fetch as any).mockResolvedValue({ ok: true });
      await fetchWithTimeout("https://example.com", {});
      expect(global.fetch).toHaveBeenCalledWith("https://example.com", {});
    });

    it("throws if timeout is reached", async () => {
      (global.fetch as any).mockImplementation(
        (_url: string, init: any) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener("abort", () => {
              const err = new Error("aborted");
              err.name = "AbortError";
              reject(err);
            });
          }),
      );

      const promise = fetchWithTimeout("https://example.com", {}, 50);

      await expect(promise).rejects.toThrow(
        "Upstream request timed out after 50ms",
      );
    });
  });

  describe("Ollama helpers", () => {
    it("requestHasTools identifies tools", () => {
      expect(requestHasTools({ tools: [{ type: "function" }] })).toBe(true);
      expect(requestHasTools({ tools: [] })).toBe(false);
      expect(requestHasTools({})).toBe(false);
    });

    it("stripToolsFromRequest removes tool fields", () => {
      const body = { model: "m", tools: [], tool_choice: "auto" };
      expect(stripToolsFromRequest(body)).toEqual({ model: "m" });
    });

    it("ollamaDoesNotSupportTools matches error message", () => {
      expect(
        ollamaDoesNotSupportTools("this model does not support tools"),
      ).toBe(true);
      expect(ollamaDoesNotSupportTools("other error")).toBe(false);
    });
  });

  describe("parseLooseToolCallInput", () => {
    it("parses key-value pairs with colon or equals", () => {
      const input = "name: 'John', age=30, active: true, notes: null";
      expect(parseLooseToolCallInput(input)).toEqual({
        name: "John",
        age: 30,
        active: true,
        notes: null,
      });
    });

    it("handles escaped quotes", () => {
      const input = "text: 'It\\'s a test'";
      expect(parseLooseToolCallInput(input)).toEqual({
        text: "It's a test",
      });
    });
  });

  describe("parseLooseFunctionCallArgs", () => {
    it("parses complex arguments with nested structures", () => {
      const input =
        'path="/tmp/test", content="hello", options={recursive: true, items: [1, 2]}';
      const result = parseLooseFunctionCallArgs(input);
      expect(result.path).toBe("/tmp/test");
      expect(result.content).toBe("hello");
      expect(result.options).toBe("{recursive: true, items: [1, 2]}");
    });
  });

  describe("handleProxyRequest", () => {
    it("forwards request and pipes response", async () => {
      const res = {
        status: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
        send: jest.fn(),
      } as any;

      (global.fetch as any).mockResolvedValue({
        status: 200,
        headers: new Map([["Content-Type", "application/json"]]),
        arrayBuffer: async () => Buffer.from(JSON.stringify({ ok: true })),
      });

      await handleProxyRequest({} as any, res, {
        targetUrl: "https://api.example.com",
        method: "GET",
        headers: {},
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Type",
        "application/json",
      );
      expect(res.send).toHaveBeenCalled();
    });
  });

  describe("handleStreamingProxyRequest", () => {
    it("handles streaming responses", async () => {
      const res = {
        status: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
        flushHeaders: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
      } as any;

      const reader = {
        read: (jest.fn() as any)
          .mockResolvedValueOnce({ done: false, value: Buffer.from("chunk1") })
          .mockResolvedValueOnce({ done: true }),
        releaseLock: jest.fn(),
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        body: {
          getReader: () => reader,
        },
      });

      await handleStreamingProxyRequest({} as any, res, {
        targetUrl: "https://api.example.com/stream",
        headers: {},
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Type",
        "text/event-stream",
      );
      expect(res.write).toHaveBeenCalled();
      expect(res.end).toHaveBeenCalled();
    });
  });
});
