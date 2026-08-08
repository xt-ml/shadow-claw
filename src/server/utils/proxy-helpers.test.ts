import { jest } from "@jest/globals";

import {
  extractBearerToken,
  fetchWithTimeout,
  getFirstHeaderValue,
  handleProxyRequest,
  handleStreamingProxyRequest,
  isPrivateOrLoopback,
  isTelegramProxyPath,
  ollamaDoesNotSupportTools,
  parseLooseFunctionCallArgs,
  parseLooseToolCallInput,
  parseNonNegativeInteger,
  parsePositiveInteger,
  redactSensitiveUrl,
  requestHasTools,
  stripToolsFromRequest,
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
      jest.useRealTimers();
      global.fetch = jest.fn() as any;
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("calls fetch normally if no timeout", async () => {
      (global.fetch as any).mockResolvedValue({ ok: true });
      await fetchWithTimeout("https://example.com", {});
      expect(global.fetch).toHaveBeenCalledWith("https://example.com", {});
    });

    it("throws if timeout is reached", async () => {
      jest.useFakeTimers();
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
      jest.advanceTimersByTime(50);

      await expect(promise).rejects.toThrow(
        "Upstream request timed out after 50ms",
      );

      jest.useRealTimers();
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

  // ---------------------------------------------------------------------------
  // Scheme allowlist — http: and https: only
  // ---------------------------------------------------------------------------

  describe("handleProxyRequest — scheme allowlist", () => {
    function makeMockRes() {
      const json = jest.fn();
      const status = jest.fn().mockReturnValue({ json });
      return { status, json } as any;
    }

    const blockedSchemes = [
      "file:///etc/passwd",
      "ftp://files.example.com/pub/data",
      "gopher://gopher.example.com/",
      "data:text/plain,hello",
    ];

    for (const url of blockedSchemes) {
      it(`rejects ${url.split(":")[0]}:// scheme with 400`, async () => {
        const res = makeMockRes();

        await handleProxyRequest({} as any, res, {
          targetUrl: url,
          method: "GET",
          headers: {},
        });

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.stringMatching(/scheme|protocol|unsupported/i),
          }),
        );
      });
    }

    it("passes http: through", async () => {
      const res = {
        status: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
        send: jest.fn(),
      } as any;

      (global.fetch as any).mockResolvedValue({
        status: 200,
        headers: new Map(),
        arrayBuffer: async () => Buffer.from("{}"),
      });

      await handleProxyRequest({} as any, res, {
        targetUrl: "http://api.example.com/data",
        method: "GET",
        headers: {},
      });

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("passes https: through", async () => {
      const res = {
        status: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
        send: jest.fn(),
      } as any;

      (global.fetch as any).mockResolvedValue({
        status: 200,
        headers: new Map(),
        arrayBuffer: async () => Buffer.from("{}"),
      });

      await handleProxyRequest({} as any, res, {
        targetUrl: "https://api.example.com/data",
        method: "GET",
        headers: {},
      });

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("handleStreamingProxyRequest — scheme allowlist", () => {
    function makeMockRes() {
      const json = jest.fn();
      const status = jest.fn().mockReturnValue({ json });
      return { status, json, headersSent: false } as any;
    }

    it("rejects ftp:// scheme with 400", async () => {
      const res = makeMockRes();

      await handleStreamingProxyRequest({} as any, res, {
        targetUrl: "ftp://files.example.com/data",
        headers: {},
      });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringMatching(/scheme|protocol|unsupported/i),
        }),
      );
    });

    it("passes https: streaming through", async () => {
      const res = {
        status: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
        flushHeaders: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
      } as any;

      const reader = {
        read: (jest.fn() as any).mockResolvedValueOnce({ done: true }),
        releaseLock: jest.fn(),
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        body: { getReader: () => reader },
      });

      await handleStreamingProxyRequest({} as any, res, {
        targetUrl: "https://api.example.com/stream",
        headers: {},
      });

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ---------------------------------------------------------------------------
  // isPrivateOrLoopback
  // ---------------------------------------------------------------------------

  describe("isPrivateOrLoopback", () => {
    it("identifies loopback hostnames", () => {
      expect(isPrivateOrLoopback("localhost")).toBe(true);
      expect(isPrivateOrLoopback("127.0.0.1")).toBe(true);
      expect(isPrivateOrLoopback("127.1.2.3")).toBe(true);
      expect(isPrivateOrLoopback("::1")).toBe(true);
    });

    it("identifies RFC-1918 private ranges", () => {
      expect(isPrivateOrLoopback("10.0.0.1")).toBe(true);
      expect(isPrivateOrLoopback("10.255.255.255")).toBe(true);
      expect(isPrivateOrLoopback("192.168.1.100")).toBe(true);
      expect(isPrivateOrLoopback("172.16.0.1")).toBe(true);
      expect(isPrivateOrLoopback("172.31.255.255")).toBe(true);
    });

    it("identifies link-local and cloud metadata endpoints", () => {
      expect(isPrivateOrLoopback("169.254.169.254")).toBe(true);
      expect(isPrivateOrLoopback("169.254.0.1")).toBe(true);
    });

    it("does not flag legitimate public addresses", () => {
      expect(isPrivateOrLoopback("example.com")).toBe(false);
      expect(isPrivateOrLoopback("8.8.8.8")).toBe(false);
      expect(isPrivateOrLoopback("172.32.0.1")).toBe(false); // just outside RFC-1918 range
      expect(isPrivateOrLoopback("11.0.0.1")).toBe(false);
      expect(isPrivateOrLoopback("192.169.1.1")).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // handleProxyRequest — private-IP guard
  // ---------------------------------------------------------------------------

  describe("handleProxyRequest — private-IP blocking", () => {
    function makeMockRes() {
      const json = jest.fn();
      const status = jest.fn().mockReturnValue({ json });
      return { status, json } as any;
    }

    const privateUrls = [
      "http://localhost/secret",
      "http://127.0.0.1/etc/passwd",
      "http://10.0.0.1/admin",
      "http://192.168.1.1/router",
      "http://172.16.0.5/internal",
      "http://169.254.169.254/latest/meta-data/",
    ];

    for (const url of privateUrls) {
      it(`blocks ${url} with 403`, async () => {
        const res = makeMockRes();

        await handleProxyRequest({} as any, res, {
          targetUrl: url,
          method: "GET",
          headers: {},
        });

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.stringMatching(/private|internal|blocked/i),
          }),
        );
      });
    }

    it("does not block a legitimate public URL", async () => {
      const res = {
        status: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
        send: jest.fn(),
      } as any;

      (global.fetch as any).mockResolvedValue({
        status: 200,
        headers: new Map(),
        arrayBuffer: async () => Buffer.from("{}"),
      });

      await handleProxyRequest({} as any, res, {
        targetUrl: "https://api.example.com/data",
        method: "GET",
        headers: {},
      });

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("allows private URL when allowPrivate: true (--allow-private-proxy flag)", async () => {
      const res = {
        status: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
        send: jest.fn(),
      } as any;

      (global.fetch as any).mockResolvedValue({
        status: 200,
        headers: new Map(),
        arrayBuffer: async () => Buffer.from("{}"),
      });

      await handleProxyRequest({} as any, res, {
        targetUrl: "http://10.0.0.1/internal-api",
        method: "GET",
        headers: {},
        allowPrivate: true,
      });

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("allows private URL when fromServiceWorker: true (headersFromBody heuristic)", async () => {
      const res = {
        status: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
        send: jest.fn(),
      } as any;

      (global.fetch as any).mockResolvedValue({
        status: 200,
        headers: new Map(),
        arrayBuffer: async () => Buffer.from("{}"),
      });

      await handleProxyRequest({} as any, res, {
        targetUrl: "http://localhost:8080/tool-server",
        method: "GET",
        headers: {},
        fromServiceWorker: true,
      });

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ---------------------------------------------------------------------------
  // handleStreamingProxyRequest — private-IP guard
  // ---------------------------------------------------------------------------

  describe("handleStreamingProxyRequest — private-IP blocking", () => {
    function makeMockRes() {
      const json = jest.fn();
      const status = jest.fn().mockReturnValue({ json });
      const headersSent = false;
      return { status, json, headersSent } as any;
    }

    const privateUrls = [
      "http://localhost/stream",
      "http://10.0.0.1/stream",
      "http://169.254.169.254/latest/meta-data/",
    ];

    for (const url of privateUrls) {
      it(`blocks streaming ${url} with 403`, async () => {
        const res = makeMockRes();

        await handleStreamingProxyRequest({} as any, res, {
          targetUrl: url,
          headers: {},
        });

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.stringMatching(/private|internal|blocked/i),
          }),
        );
      });
    }

    it("does not block a public streaming URL", async () => {
      const res = {
        status: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
        flushHeaders: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
      } as any;

      const reader = {
        read: (jest.fn() as any).mockResolvedValueOnce({ done: true }),
        releaseLock: jest.fn(),
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        body: { getReader: () => reader },
      });

      await handleStreamingProxyRequest({} as any, res, {
        targetUrl: "https://api.example.com/stream",
        headers: {},
      });

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("allows private streaming URL when allowPrivate: true", async () => {
      const res = {
        status: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
        flushHeaders: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
      } as any;

      const reader = {
        read: (jest.fn() as any).mockResolvedValueOnce({ done: true }),
        releaseLock: jest.fn(),
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        body: { getReader: () => reader },
      });

      await handleStreamingProxyRequest({} as any, res, {
        targetUrl: "http://192.168.1.5/local-llm/stream",
        headers: {},
        allowPrivate: true,
      });

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("allows private streaming URL when fromServiceWorker: true", async () => {
      const res = {
        status: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
        flushHeaders: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
      } as any;

      const reader = {
        read: (jest.fn() as any).mockResolvedValueOnce({ done: true }),
        releaseLock: jest.fn(),
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        body: { getReader: () => reader },
      });

      await handleStreamingProxyRequest({} as any, res, {
        targetUrl: "http://localhost:11435/stream",
        headers: {},
        fromServiceWorker: true,
      });

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
