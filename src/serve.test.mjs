import { jest } from "@jest/globals";

describe("src/serve.mjs proxy simulation", () => {
  // Simplified version of the proxy logic from serve.mjs for testing
  async function simulateProxy(req) {
    const target = req.body?.url || req.query?.url;
    if (!target)
      return {
        status: 400,
        body: JSON.stringify({ error: "Missing 'url' parameter" }),
      };

    const method = req.body?.method || "GET";
    const headers = { ...req.body?.headers };
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

  function getFirstHeaderValue(headerValue) {
    if (Array.isArray(headerValue)) {
      return headerValue[0] || "";
    }

    return typeof headerValue === "string" ? headerValue : "";
  }

  function extractBearerToken(authorizationHeader) {
    const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() : "";
  }

  function buildAzureProxyHeaders(reqHeaders, serverApiKey) {
    const clientApiKey = getFirstHeaderValue(reqHeaders["api-key"]);
    const clientAuthorization = getFirstHeaderValue(reqHeaders.authorization);
    const resolvedApiKey =
      clientApiKey ||
      extractBearerToken(clientAuthorization) ||
      serverApiKey ||
      "";

    const headers = { ...reqHeaders };
    delete headers["api-key"];
    delete headers.authorization;

    if (resolvedApiKey) {
      headers["api-key"] = resolvedApiKey;
      headers.authorization = `Bearer ${resolvedApiKey}`;
    }

    return headers;
  }

  it("should proxy GET requests", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      text: async () => "OK",
      headers: new Headers(),
    });

    const response = await simulateProxy({
      body: {
        url: "https://httpbin.org/headers",
        method: "GET",
        headers: { "X-Test": "Passed" },
      },
    });

    expect(response.status).toBe(200);

    expect(response.body).toBe("OK");

    expect(global.fetch).toHaveBeenCalledWith(
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
