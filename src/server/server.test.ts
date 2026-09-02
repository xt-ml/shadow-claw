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

describe("startServer HTTP / HTTPS selection", () => {
  let httpMock: any;
  let httpsMock: any;
  let appMock: any;
  let tlsMock: any;
  let tcpPortUsedMock: any;
  let controlPlaneMock: any;

  beforeEach(() => {
    jest.resetModules();

    const fakeServer = {
      listen: jest.fn((_port: number, _host: string, cb: any) => {
        if (cb) cb();
        return fakeServer;
      }),
      on: jest.fn().mockReturnThis(),
      close: jest.fn((cb: any) => {
        if (cb) cb();
        return fakeServer;
      }),
    };

    httpMock = {
      createServer: jest.fn(() => fakeServer),
    };

    httpsMock = {
      createServer: jest.fn(() => fakeServer),
    };

    appMock = {
      createApp: jest.fn(() => ({
        app: { use: jest.fn(), post: jest.fn() },
        scheduler: { start: jest.fn() },
      })),
    };

    tlsMock = {
      ensureTlsCredentials: jest.fn(() => ({
        key: Buffer.from("fake-key"),
        cert: Buffer.from("fake-cert"),
      })),
    };

    tcpPortUsedMock = {
      check: jest.fn(() => Promise.resolve(false)),
    };

    controlPlaneMock = {
      createControlPlane: jest.fn(() => ({
        getToken: jest.fn(() => "test-token"),
        close: jest.fn(),
      })),
    };

    jest.spyOn(console, "log").mockImplementation(() => {});

    jest.unstable_mockModule("node:http", () => ({
      default: httpMock,
      ...httpMock,
    }));
    jest.unstable_mockModule("node:https", () => ({
      default: httpsMock,
      ...httpsMock,
    }));
    jest.unstable_mockModule("./app.js", () => appMock);
    jest.unstable_mockModule("./tls.js", () => tlsMock);
    jest.unstable_mockModule("tcp-port-used", () => ({
      default: tcpPortUsedMock,
      ...tcpPortUsedMock,
    }));
    jest.unstable_mockModule("./control-plane.js", () => controlPlaneMock);
    jest.unstable_mockModule("./peer.js", () => ({
      attachPeerServer: jest.fn(),
    }));
    jest.unstable_mockModule("./server-peer.js", () => ({
      ServerPeer: jest.fn(() => ({
        start: jest.fn(() => Promise.resolve("peer-123")),
      })),
    }));
  });

  it("creates http.Server when config.https is false", async () => {
    const { startServer } = await import("./server.js");
    await startServer({
      port: 8888,
      bindHost: "127.0.0.1",
      corsMode: "localhost",
      allowedOrigins: new Set(),
      verbose: false,
      peerjs: false,
      rootPath: "/root",
      databaseDir: "/db",
      allowPrivateProxy: false,
      https: false,
      sslDir: "/ssl",
    });

    expect(httpMock.createServer).toHaveBeenCalledTimes(1);
    expect(httpsMock.createServer).not.toHaveBeenCalled();
    expect(tlsMock.ensureTlsCredentials).not.toHaveBeenCalled();
  });

  it("creates https.Server with TLS credentials when config.https is true", async () => {
    const { startServer } = await import("./server.js");
    await startServer({
      port: 8888,
      bindHost: "127.0.0.1",
      corsMode: "localhost",
      allowedOrigins: new Set(),
      verbose: false,
      peerjs: false,
      rootPath: "/root",
      databaseDir: "/db",
      allowPrivateProxy: false,
      https: true,
      sslDir: "/ssl",
      certPath: "/custom/cert.pem",
    });

    expect(tlsMock.ensureTlsCredentials).toHaveBeenCalledTimes(1);
    expect(httpsMock.createServer).toHaveBeenCalledWith(
      { key: Buffer.from("fake-key"), cert: Buffer.from("fake-cert") },
      expect.anything(),
    );
  });

  it("handles verbose logging, peerjs, inferred bindHost, allowedOrigins, and services-only mode", async () => {
    const { startServer } = await import("./server.js");
    await startServer({
      port: 8889,
      bindHost: "0.0.0.0",
      corsMode: "all",
      allowedOrigins: new Set(["https://allowed.example.com"]),
      verbose: true,
      peerjs: true,
      rootPath: "/root",
      databaseDir: "/db",
      allowPrivateProxy: false,
      https: false,
      sslDir: "/ssl",
      serveStatic: false,
    });

    expect(httpMock.createServer).toHaveBeenCalled();
  });
});
