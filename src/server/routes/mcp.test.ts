import { describe, it, expect, jest } from "@jest/globals";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { registerMcpRoutes } from "./mcp.js";
import { McpServer } from "../mcp/mcp-server.js";
import { getPackageVersion } from "../utils/packageVersion.js";

function makeHttpRequest(options: {
  method?: string;
  path: string;
  port: number;
  headers?: Record<string, string>;
  body?: any;
}): Promise<{ status: number; data: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: options.port,
        path: options.path,
        method: options.method || "POST",
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          let parsed = body;
          try {
            parsed = JSON.parse(body);
          } catch (_) {}
          resolve({
            status: res.statusCode || 0,
            data: parsed,
            headers: res.headers,
          });
        });
      },
    );
    req.on("error", reject);
    if (options.body !== undefined) {
      req.write(
        typeof options.body === "string"
          ? options.body
          : JSON.stringify(options.body),
      );
    }
    req.end();
  });
}

describe("MCP Streamable HTTP Route (POST /mcp)", () => {
  let app: express.Express;
  let server: http.Server;
  let port: number;
  let mcpServer: McpServer;
  const testToken = "test-secret-token-12345";

  beforeAll(async () => {
    app = express();
    app.use(express.json());

    mcpServer = new McpServer({
      name: "shadow-claw-http-test",
      version: "1.25.0",
    });

    const mockControlPlane: any = {
      getConnectedClients: jest
        .fn()
        .mockReturnValue([{ clientId: "c1", deviceLabel: "Browser Test" }]),
      sendCommand: (jest.fn() as any).mockResolvedValue({
        success: true,
        data: { queued: true },
      }),
    };

    registerMcpRoutes(app, {
      mcpServer,
      controlPlane: mockControlPlane,
      token: testToken,
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        port = (server.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("handles server/discover with 2026-07-28 headers", async () => {
    const res = await makeHttpRequest({
      port,
      path: "/mcp",
      method: "POST",
      headers: {
        "x-control-token": testToken,
        "mcp-protocol-version": "2026-07-28",
        "mcp-method": "server/discover",
        Accept: "application/json, text/event-stream",
      },
      body: {
        jsonrpc: "2.0",
        id: 1,
        method: "server/discover",
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers["mcp-protocol-version"]).toBe("2026-07-28");
    expect(res.data.result.protocolVersion).toBe("2026-07-28");
    expect(res.data.result.serverInfo.name).toBe("shadow-claw-http-test");
  });

  it("handles tools/list returning cacheable result", async () => {
    const res = await makeHttpRequest({
      port,
      path: "/mcp",
      method: "POST",
      headers: {
        "x-control-token": testToken,
        "mcp-protocol-version": "2026-07-28",
        "mcp-method": "tools/list",
      },
      body: {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
      },
    });

    expect(res.status).toBe(200);
    expect(res.data.result.resultType).toBe("complete");
    expect(res.data.result.ttlMs).toBe(5000);
    expect(Array.isArray(res.data.result.tools)).toBe(true);
  });

  it("returns 202 Accepted for notification requests", async () => {
    const res = await makeHttpRequest({
      port,
      path: "/mcp",
      method: "POST",
      headers: {
        "x-control-token": testToken,
        "mcp-protocol-version": "2026-07-28",
        "mcp-method": "notifications/initialized",
      },
      body: {
        jsonrpc: "2.0",
        method: "notifications/initialized",
      },
    });

    expect(res.status).toBe(202);
  });

  it("returns 400 Bad Request with HeaderMismatch on method mismatch", async () => {
    const res = await makeHttpRequest({
      port,
      path: "/mcp",
      method: "POST",
      headers: {
        "x-control-token": testToken,
        "mcp-protocol-version": "2026-07-28",
        "mcp-method": "tools/call",
      },
      body: {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/list",
      },
    });

    expect(res.status).toBe(400);
    expect(res.data.error.code).toBe(-32020);
  });

  it("returns 403 Forbidden for untrusted Origin header", async () => {
    const res = await makeHttpRequest({
      port,
      path: "/mcp",
      method: "POST",
      headers: {
        Origin: "https://evil-attacker.com",
        "x-control-token": testToken,
      },
      body: {
        jsonrpc: "2.0",
        id: 4,
        method: "server/discover",
      },
    });

    expect(res.status).toBe(403);
  });

  it("returns 401 Unauthorized when missing valid token from external caller", async () => {
    const res = await makeHttpRequest({
      port,
      path: "/mcp",
      method: "POST",
      headers: {
        Host: "custom-domain.example.com",
        "x-control-token": "wrong-token",
      },
      body: {
        jsonrpc: "2.0",
        id: 5,
        method: "server/discover",
      },
    });

    expect(res.status).toBe(401);
    expect(res.headers["www-authenticate"]).toContain(
      'Bearer resource_metadata="',
    );
    expect(res.headers["www-authenticate"]).toContain(
      "/.well-known/oauth-protected-resource",
    );
  });

  it("authenticates via Bearer Authorization header and query parameter", async () => {
    // Bearer token
    const resBearer = await makeHttpRequest({
      port,
      path: "/mcp",
      method: "POST",
      headers: {
        Authorization: `Bearer ${testToken}`,
      },
      body: {
        jsonrpc: "2.0",
        id: 6,
        method: "server/discover",
      },
    });
    expect(resBearer.status).toBe(200);

    // Query token
    const resQuery = await makeHttpRequest({
      port,
      path: `/mcp?token=${testToken}`,
      method: "POST",
      body: {
        jsonrpc: "2.0",
        id: 7,
        method: "server/discover",
      },
    });
    expect(resQuery.status).toBe(200);
  });

  it("returns 400 when body is missing or has no method", async () => {
    const resNoMethod = await makeHttpRequest({
      port,
      path: "/mcp",
      method: "POST",
      headers: {
        "x-control-token": testToken,
      },
      body: {
        jsonrpc: "2.0",
        id: 8,
      },
    });
    expect(resNoMethod.status).toBe(400);
    expect(resNoMethod.data.error.message).toContain("Invalid JSON-RPC");
  });

  it("returns 202 Accepted for notification requests without response", async () => {
    const resNotif = await makeHttpRequest({
      port,
      path: "/mcp",
      method: "POST",
      headers: {
        "x-control-token": testToken,
      },
      body: {
        jsonrpc: "2.0",
        method: "notifications/initialized",
      },
    });
    expect(resNotif.status).toBe(202);
  });

  it("allows local requests without token", async () => {
    const resLocal = await makeHttpRequest({
      port,
      path: "/mcp",
      method: "POST",
      headers: {
        Host: `127.0.0.1:${port}`,
      },
      body: {
        jsonrpc: "2.0",
        id: 9,
        method: "server/discover",
      },
    });
    expect(resLocal.status).toBe(200);
  });

  it("handles Streamable HTTP requests at POST /.well-known/mcp", async () => {
    const res = await makeHttpRequest({
      port,
      path: "/.well-known/mcp",
      method: "POST",
      headers: {
        "x-control-token": testToken,
        "mcp-protocol-version": "2026-07-28",
      },
      body: {
        jsonrpc: "2.0",
        id: 101,
        method: "server/discover",
      },
    });

    expect(res.status).toBe(200);
    expect(res.data.result.serverInfo.name).toBe("shadow-claw-http-test");
  });

  it("serves MCP Server Card discovery at GET /.well-known/mcp, /.well-known/mcp.json, and /mcp/server-card", async () => {
    for (const p of [
      "/.well-known/mcp",
      "/.well-known/mcp.json",
      "/mcp/server-card",
    ]) {
      const res = await makeHttpRequest({
        port,
        path: p,
        method: "GET",
      });

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/json");
      expect(res.data.name).toBe("shadow-claw");
      expect(res.data.version).toBe(getPackageVersion());
      expect(res.data.title).toBe("ShadowClaw MCP Server");
      expect(Array.isArray(res.data.remotes)).toBe(true);
      expect(res.data.remotes[0].type).toBe("streamable-http");
      expect(res.data.remotes[0].supportedProtocolVersions).toContain(
        "2026-07-28",
      );
    }
  });

  it("serves AI Catalog discovery at GET /.well-known/ai-catalog.json", async () => {
    const res = await makeHttpRequest({
      port,
      path: "/.well-known/ai-catalog.json",
      method: "GET",
    });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/json");
    expect(res.data.name).toBe("ShadowClaw AI Catalog");
    expect(Array.isArray(res.data.servers)).toBe(true);
  });

  it("serves MCP Servers manifest at GET /.well-known/mcp/servers.json", async () => {
    const res = await makeHttpRequest({
      port,
      path: "/.well-known/mcp/servers.json",
      method: "GET",
    });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/json");
    expect(res.data.version).toBe("1.0");
    expect(res.data.servers[0].name).toBe("shadow-claw");
  });

  it("serves Protected Resource Metadata at GET /.well-known/oauth-protected-resource", async () => {
    const res = await makeHttpRequest({
      port,
      path: "/.well-known/oauth-protected-resource",
      method: "GET",
    });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/json");
    expect(res.data.resource).toContain("/mcp");
    expect(Array.isArray(res.data.authorization_servers)).toBe(true);
    expect(res.data.scopes_supported).toBeUndefined();
  });
});
