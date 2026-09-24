/**
 * Express Route Registration for Server-to-Server A2A Protocol v1.0.
 *
 * Endpoints:
 * - GET  /.well-known/agent-card.json   (A2A Agent Discovery)
 * - POST /a2a                          (A2A JSON-RPC 2.0 Wire Protocol)
 * - GET  /a2a/tasks/:taskId            (A2A SSE Task Stream)
 *
 * References:
 * - A2A v1.0 Spec §4.4 (Agent Discovery), §3.2 (Message Exchange)
 * - ADR: docs/decisions/server-a2a-http-binding.md
 */

import type { Express, Request, Response, NextFunction } from "express";
import type { A2AHttpServer } from "./a2a-http-server.js";

export interface A2ARouteOptions {
  httpServer: A2AHttpServer;
  token?: string;
}

export function registerA2ARoutes(
  app: Express,
  options: A2ARouteOptions,
): void {
  const { httpServer, token } = options;

  function setCorsHeaders(req: Request, res: Response): void {
    const origin = req.headers.origin;
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, x-control-token, Accept",
    );
    res.setHeader("Access-Control-Allow-Private-Network", "true");
  }

  function authenticate(req: Request, res: Response, next: NextFunction): void {
    if (!token) {
      return next();
    }

    const headerToken = req.headers["x-control-token"];
    if (headerToken && headerToken === token) {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (authHeader) {
      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      if (match && match[1] === token) {
        return next();
      }
    }

    res.status(401).json({
      error: "Unauthorized",
      message: "Valid control token required for A2A communication",
    });
  }

  // ---------------------------------------------------------------------------
  // Preflight OPTIONS handlers
  // ---------------------------------------------------------------------------
  app.options("/.well-known/agent-card.json", (req: Request, res: Response) => {
    setCorsHeaders(req, res);
    res.status(204).end();
  });

  app.options("/a2a", (req: Request, res: Response) => {
    setCorsHeaders(req, res);
    res.status(204).end();
  });

  app.options("/a2a/tasks/:taskId", (req: Request, res: Response) => {
    setCorsHeaders(req, res);
    res.status(204).end();
  });

  // ---------------------------------------------------------------------------
  // Agent Discovery: GET /.well-known/agent-card.json
  // ---------------------------------------------------------------------------
  app.get("/.well-known/agent-card.json", (req: Request, res: Response) => {
    setCorsHeaders(req, res);
    res.setHeader("Content-Type", "application/json");
    res.status(200).json(httpServer.agentCard);
  });

  // ---------------------------------------------------------------------------
  // JSON-RPC Wire Protocol: POST /a2a
  // ---------------------------------------------------------------------------
  app.post("/a2a", authenticate, async (req: Request, res: Response) => {
    setCorsHeaders(req, res);
    res.setHeader("Content-Type", "application/json");

    try {
      const result = await httpServer.handleRequest(req.body);
      res.status(200).json(result);
    } catch (err: any) {
      res.status(500).json({
        jsonrpc: "2.0",
        id: req.body?.id ?? null,
        error: {
          code: -32603,
          message: err?.message ?? "Internal server error",
        },
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Task Event Streaming: GET /a2a/tasks/:taskId (Server-Sent Events)
  // ---------------------------------------------------------------------------
  app.get("/a2a/tasks/:taskId", authenticate, (req: Request, res: Response) => {
    setCorsHeaders(req, res);
    const taskId = req.params.taskId as string;

    const task = httpServer.taskStore.getTask(taskId);
    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    // Send initial snapshot event
    res.write(`data: ${JSON.stringify({ task })}\n\n`);

    const unsubscribe = httpServer.taskStore.subscribe(taskId, (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    req.on("close", () => {
      unsubscribe();
    });
  });
}
