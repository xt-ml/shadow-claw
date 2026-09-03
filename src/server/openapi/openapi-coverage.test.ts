import http from "node:http";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { createApp } from "../app.js";
import { createControlPlane } from "../control-plane.js";
import { registerMcpRoutes } from "../routes/mcp.js";
import { openApiSpec } from "./openapi-spec.js";
import type { ServerConfig } from "../config.js";

const REST_METHODS = new Set(["get", "post", "put", "delete", "patch"]);
const WILDCARD_PROXIES = new Set(["/proxy", "/git-proxy", "/telegram"]);

describe("OpenAPI Route Coverage & Drift Guardrail", () => {
  let tempDir: string;
  let server: http.Server;
  let registeredRoutes: Map<string, Set<string>>;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "shadowclaw-openapi-test-"),
    );
    const config: ServerConfig = {
      port: 0,
      bindHost: "127.0.0.1",
      verbose: false,
      corsMode: "localhost",
      allowedOrigins: new Set(),
      controlToken: "test-control-token",
      databaseDir: path.join(tempDir, "db"),
      rootPath: path.join(tempDir, "public"),
      https: false,
      sslDir: path.join(tempDir, "ssl"),
      peerjs: false,
      allowPrivateProxy: false,
      serveStatic: false,
    };

    const { app, scheduler } = createApp(config);
    server = http.createServer(app);

    const controlPlane = createControlPlane({
      httpServer: server,
      app,
      token: config.controlToken,
    });

    registerMcpRoutes(app, {
      controlPlane,
      token: config.controlToken,
    });

    scheduler.stop();
    controlPlane.close();

    // Extract all registered route paths and methods from Express
    registeredRoutes = new Map();

    const routerStack =
      (app as any)._router?.stack || (app as any).router?.stack || [];

    for (const layer of routerStack) {
      if (layer.route && layer.route.path) {
        let rawPath = layer.route.path;

        // Normalize regex routes
        if (rawPath instanceof RegExp) {
          const str = rawPath.toString();
          if (str.includes("git-proxy")) {
            rawPath = "/git-proxy";
          } else if (str.includes("telegram")) {
            rawPath = "/telegram";
          } else if (str.includes("proxy")) {
            rawPath = "/proxy";
          } else {
            rawPath = str;
          }
        } else if (typeof rawPath === "string") {
          // Convert Express param syntax :param to OpenAPI {param}
          rawPath = rawPath.replace(/:([a-zA-Z0-9_]+)/g, "{$1}");
        }

        const methods = Object.keys(layer.route.methods || {})
          .map((m) => m.toLowerCase())
          .filter((m) => REST_METHODS.has(m));

        if (!registeredRoutes.has(rawPath)) {
          registeredRoutes.set(rawPath, new Set());
        }

        const methodSet = registeredRoutes.get(rawPath)!;
        for (const method of methods) {
          methodSet.add(method);
        }
      }
    }
  });

  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should have valid OpenAPI 3.1 root metadata", () => {
    expect(openApiSpec.openapi).toBe("3.1.0");
    expect(openApiSpec.info.title).toBe("ShadowClaw API");
    expect(openApiSpec.info.version).toBeDefined();
    expect(openApiSpec.paths).toBeDefined();
  });

  it("should document all registered Express REST routes in OpenAPI spec", () => {
    const documentedPaths = new Set(Object.keys(openApiSpec.paths));
    const undocumentedRoutes: string[] = [];

    for (const [expressPath, methods] of registeredRoutes.entries()) {
      // Exclude catch-all or non-API routes if any
      if (expressPath === "*" || expressPath === "/") {
        continue;
      }

      if (!documentedPaths.has(expressPath)) {
        undocumentedRoutes.push(
          `${Array.from(methods).join(",").toUpperCase()} ${expressPath}`,
        );
        continue;
      }

      const pathItem = openApiSpec.paths[expressPath];

      // Generic proxies accept all methods; verify they are present in spec
      if (WILDCARD_PROXIES.has(expressPath)) {
        continue;
      }

      for (const method of methods) {
        const operation = (pathItem as any)[method];
        if (!operation) {
          undocumentedRoutes.push(`${method.toUpperCase()} ${expressPath}`);
        }
      }
    }

    expect(undocumentedRoutes).toEqual([]);
  });

  it("should not have orphaned or dead paths in the OpenAPI specification", () => {
    const deadPaths: string[] = [];

    for (const pathKey of Object.keys(openApiSpec.paths)) {
      if (!registeredRoutes.has(pathKey)) {
        deadPaths.push(pathKey);
      }
    }

    expect(deadPaths).toEqual([]);
  });

  it("should provide tags, summary, and responses for every documented operation", () => {
    for (const pathItem of Object.values(openApiSpec.paths)) {
      const methods = ["get", "post", "put", "delete", "patch"] as const;
      for (const method of methods) {
        const op = pathItem[method];
        if (op) {
          expect(op.tags).toBeDefined();
          expect(op.tags!.length).toBeGreaterThan(0);
          expect(op.summary).toBeDefined();
          expect(op.responses).toBeDefined();
          expect(Object.keys(op.responses).length).toBeGreaterThan(0);
        }
      }
    }
  });
});
