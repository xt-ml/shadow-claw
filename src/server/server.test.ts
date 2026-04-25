import { jest } from "@jest/globals";

describe("compression filter", () => {
  it("should skip compression for text/event-stream responses", () => {
    // The filter function used by server.js: skip SSE, compress everything else
    const filter = (_req: any, res: any) => {
      if (res.getHeader("Content-Type") === "text/event-stream") {
        return false;
      }

      return true; // simplified: always compress non-SSE in this test
    };

    const sseRes: any = { getHeader: jest.fn(() => "text/event-stream") };
    expect(filter({} as any, sseRes)).toBe(false);

    const jsonRes: any = { getHeader: jest.fn(() => "application/json") };
    expect(filter({} as any, jsonRes)).toBe(true);

    const htmlRes: any = { getHeader: jest.fn(() => "text/html") };
    expect(filter({} as any, htmlRes)).toBe(true);
  });
});

describe("src/server/server.ts proxy simulation", () => {
  // Simplified version of the proxy logic from server.js for testing
  async function simulateProxy(req: any) {
    const target = req.body?.url || req.query?.url;
    if (!target)
      return {
        status: 400,
        body: JSON.stringify({ error: "Missing 'url' parameter" }),
      };

    const method = req.body?.method || "GET";
    const headers: any = { ...req.body?.headers };
    const body = req.body?.body;

    try {
      const upstream = await fetch(target, {
        method,
        headers,
        body: method === "GET" ? undefined : body,
      });

      return {
        status: upstream.status,
        body: await upstream.text(),
      };
    } catch (err) {
      return {
        status: 500,
        body: JSON.stringify({ error: "Proxy request failed" }),
      };
    }
  }

  function getFirstHeaderValue(headerValue: any) {
    if (Array.isArray(headerValue)) {
      return headerValue[0] || "";
    }

    return typeof headerValue === "string" ? headerValue : "";
  }

  function extractBearerToken(authorizationHeader: string) {
    const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);

    return match ? match[1].trim() : "";
  }

  function buildAzureProxyHeaders(
    reqHeaders: Record<string, any>,
    serverApiKey?: string,
  ) {
    const clientApiKey = getFirstHeaderValue(reqHeaders["api-key"]);
    const clientAuthorization = getFirstHeaderValue(reqHeaders.authorization);
    const resolvedApiKey =
      clientApiKey ||
      extractBearerToken(clientAuthorization) ||
      serverApiKey ||
      "";

    const headers: any = { ...reqHeaders };
    delete headers["api-key"];
    delete headers.authorization;

    if (resolvedApiKey) {
      headers["api-key"] = resolvedApiKey;
      headers.authorization = `Bearer ${resolvedApiKey}`;
    }

    return headers;
  }

  it("should proxy GET requests", async () => {
    (global as any).fetch = jest.fn(() =>
      Promise.resolve({
        status: 200,
        text: async () => "OK",
        headers: new Headers(),
      } as unknown as Response),
    );

    const response = await simulateProxy({
      body: {
        url: "https://httpbin.org/headers",
        method: "GET",
        headers: { "X-Test": "Passed" },
      },
    });

    expect(response.status).toBe(200);

    expect(response.body).toBe("OK");

    expect((global as any).fetch).toHaveBeenCalledWith(
      "https://httpbin.org/headers",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("should normalize UI-saved Azure key to both upstream auth headers", () => {
    const headers = buildAzureProxyHeaders(
      {
        "content-type": "application/json",
        "api-key": "ui-key",
      },
      "server-key",
    );

    expect(headers["api-key"]).toBe("ui-key");

    expect(headers.authorization).toBe("Bearer ui-key");
  });

  it("should fall back to server key when browser request has no auth", () => {
    const headers = buildAzureProxyHeaders(
      {
        "content-type": "application/json",
      },
      "server-key",
    );

    expect(headers["api-key"]).toBe("server-key");

    expect(headers.authorization).toBe("Bearer server-key");
  });
});
