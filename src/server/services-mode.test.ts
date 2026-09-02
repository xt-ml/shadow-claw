import { describe, it, expect, beforeAll, afterAll, jest } from "@jest/globals";
import http from "node:http";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { startServer } from "./server.js";
import type { ServerConfig } from "./config.js";

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
        method: options.method || "GET",
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

describe("Services-only mode (headless server)", () => {
  let server: http.Server | any;
  let port: number;
  let tempDir: string;
  let logSpy: any;
  const controlToken = "test-services-token";

  beforeAll(async () => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "shadowclaw-services-test-"),
    );
    const databaseDir = path.join(tempDir, "database");
    // Pick an ephemeral port for testing
    const testPort = 19876;

    const config: ServerConfig = {
      port: testPort,
      bindHost: "127.0.0.1",
      corsMode: "localhost",
      allowedOrigins: new Set(),
      verbose: false,
      peerjs: false,
      rootPath: path.join(tempDir, "non-existent-dist-public"),
      databaseDir,
      controlToken,
      allowPrivateProxy: true,
      https: false,
      sslDir: path.join(tempDir, "tls"),
      serveStatic: false,
    };

    server = await startServer(config);
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    logSpy?.mockRestore();
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("returns 404 JSON for GET / without redirecting or serving HTML", async () => {
    const res = await makeHttpRequest({
      method: "GET",
      path: "/",
      port,
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    expect(res.status).toBe(404);
    expect(res.data).toEqual({ error: "Not found" });
  });

  it("returns 404 JSON for SPA routes like GET /chat without redirecting", async () => {
    const res = await makeHttpRequest({
      method: "GET",
      path: "/chat",
      port,
      headers: {
        Accept: "text/html",
      },
    });

    expect(res.status).toBe(404);
    expect(res.data).toEqual({ error: "Not found" });
  });

  it("serves Stateless MCP endpoint at POST /mcp", async () => {
    const res = await makeHttpRequest({
      method: "POST",
      path: "/mcp",
      port,
      headers: {
        "x-control-token": controlToken,
        "MCP-Protocol-Version": "2026-07-28",
      },
      body: {
        jsonrpc: "2.0",
        id: 1,
        method: "server/discover",
      },
    });

    expect(res.status).toBe(200);
    expect(res.data.jsonrpc).toBe("2.0");
    expect(res.data.id).toBe(1);
    expect(res.data.result.serverInfo.name).toBe("shadow-claw");
  });

  it("serves task schedule API routes at GET /schedule/tasks", async () => {
    const res = await makeHttpRequest({
      method: "GET",
      path: "/schedule/tasks",
      port,
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  });
});
