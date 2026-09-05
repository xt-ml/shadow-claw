/**
 * ShadowClaw — MCP Streamable HTTP Route Handler (POST /mcp)
 *
 * Exposes an official Stateless MCP (2026-07-28) endpoint supporting header-based
 * routing, origin validation, control token authentication, and tool execution.
 */

import type { Express, Request, Response } from "express";
import { URL } from "node:url";
import {
  MCP_ERROR_CODES,
  MCP_PROTOCOL_VERSION_2026_07_28,
  type McpHttpHeaders,
} from "../mcp/types.js";
import { McpServer } from "../mcp/mcp-server.js";
import { registerBuiltInTools } from "../mcp/tools/built-in-tools.js";
import { createClientToolRelay } from "../mcp/tools/client-tool-relay.js";
import { getOrCreateControlToken } from "../client-registry.js";

export interface McpRouteOptions {
  mcpServer?: McpServer;
  controlPlane: any;
  token?: string;
  allowedOrigins?: Set<string>;
  corsMode?: "localhost" | "private" | "all";
}

export function registerMcpRoutes(
  app: Express,
  options: McpRouteOptions,
): McpServer {
  const { controlPlane, allowedOrigins, corsMode } = options;
  const token = options.token || getOrCreateControlToken();

  const mcpServer =
    options.mcpServer ||
    new McpServer({
      name: "shadow-claw",
    });

  // Register ShadowClaw built-in and client-relayed tools
  if (controlPlane) {
    registerBuiltInTools(mcpServer, controlPlane);
    const relay = createClientToolRelay(controlPlane);
    relay.attachToServer(mcpServer);
  }

  function validateToken(providedToken?: string | null): boolean {
    if (!providedToken) {
      return false;
    }
    if (providedToken === token) {
      return true;
    }
    try {
      const currentToken = getOrCreateControlToken();
      if (currentToken && providedToken === currentToken) {
        return true;
      }
    } catch (_) {}
    return false;
  }

  function isTrustedOrigin(originUrl: string, hostHeader?: string): boolean {
    try {
      const parsed = new URL(originUrl);
      const hostname = parsed.hostname.toLowerCase();

      if (
        hostname === "127.0.0.1" ||
        hostname === "localhost" ||
        hostname === "::1" ||
        hostname === "[::1]"
      ) {
        return true;
      }

      if (
        hostname === "github.com" ||
        hostname.endsWith(".github.io") ||
        hostname.endsWith(".pages.dev")
      ) {
        return true;
      }

      if (hostHeader && parsed.host === hostHeader) {
        return true;
      }

      if (corsMode === "all") {
        return true;
      }

      if (allowedOrigins && allowedOrigins.has(parsed.origin)) {
        return true;
      }

      if (
        corsMode === "private" &&
        /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(hostname)
      ) {
        return true;
      }
    } catch (_) {}

    return false;
  }

  function extractToken(req: Request): string | null {
    const queryToken = req.query.token;
    if (typeof queryToken === "string") {
      return queryToken.trim();
    }

    const headerToken = req.headers["x-control-token"];
    if (typeof headerToken === "string") {
      return headerToken.trim();
    }

    const authHeader = req.headers["authorization"];
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authHeader.slice(7).trim();
    }

    return null;
  }

  function isLocalRequest(req: Request): boolean {
    const host = (req.headers.host || "").split(":")[0].toLowerCase();
    const isHostLocal =
      host === "127.0.0.1" ||
      host === "localhost" ||
      host === "::1" ||
      host === "[::1]";

    const origin = req.headers.origin;
    if (!origin) {
      return isHostLocal;
    }

    return isTrustedOrigin(origin, req.headers.host);
  }

  if (app && typeof app.post === "function") {
    app.post("/mcp", async (req: Request, res: Response) => {
      // 1. Origin header security check for DNS rebinding protection
      const origin = req.headers.origin;
      if (origin && !isTrustedOrigin(origin, req.headers.host)) {
        res.status(403).json({
          jsonrpc: "2.0",
          id: req.body?.id ?? null,
          error: {
            code: MCP_ERROR_CODES.InvalidRequest,
            message: "Forbidden: Origin validation failed",
          },
        });
        return;
      }

      // 2. Authentication check
      const providedToken = extractToken(req);
      const isAuthenticated = providedToken
        ? validateToken(providedToken)
        : isLocalRequest(req);

      if (!isAuthenticated) {
        res.status(401).json({
          jsonrpc: "2.0",
          id: req.body?.id ?? null,
          error: {
            code: MCP_ERROR_CODES.InvalidRequest,
            message: "Unauthorized: Invalid or missing control token",
          },
        });
        return;
      }

      // 3. Extract standard MCP headers (normalize to lowercase keys)
      const headers: McpHttpHeaders = {
        "mcp-protocol-version":
          (req.headers["mcp-protocol-version"] as string) || undefined,
        "mcp-method": (req.headers["mcp-method"] as string) || undefined,
        "mcp-name": (req.headers["mcp-name"] as string) || undefined,
      };

      // 4. Handle request via McpServer
      const body = req.body;
      if (!body || typeof body !== "object" || !body.method) {
        res.status(400).json({
          jsonrpc: "2.0",
          id: null,
          error: {
            code: MCP_ERROR_CODES.InvalidRequest,
            message: "Invalid JSON-RPC request payload",
          },
        });
        return;
      }

      const response = await mcpServer.handleRequest(body, headers);

      // Notifications return 202 Accepted with no body
      if (response === null) {
        res.status(202).end();
        return;
      }

      res.setHeader("MCP-Protocol-Version", MCP_PROTOCOL_VERSION_2026_07_28);

      // Determine HTTP status code based on error
      let statusCode = 200;
      if ("error" in response) {
        const code = response.error.code;
        if (
          code === MCP_ERROR_CODES.HeaderMismatch ||
          code === MCP_ERROR_CODES.UnsupportedProtocolVersion ||
          code === MCP_ERROR_CODES.InvalidRequest
        ) {
          statusCode = 400;
        }
      }

      res.status(statusCode).json(response);
    });
  }

  return mcpServer;
}
