/**
 * ShadowClaw — WebSocket & HTTP Control Plane Server
 *
 * Provides bidirectional communication between the server/CLI and connected
 * browser/Electron clients. Supports WebSocket connections at `/ws/control`
 * and REST/SSE endpoints under `/api/control/*`.
 */

import http from "node:http";
import https from "node:https";
import { URL } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import type { Express, Request, Response, NextFunction } from "express";
import { ulid } from "../utils/ulid.js";
import {
  registerClient,
  updateClientHeartbeat,
  getAllClients,
  pruneStaleClients,
  getOrCreateControlToken,
} from "./client-registry.js";
import type {
  ControlMessage,
  ClientRegisterPayload,
  ClientHeartbeatPayload,
  CommandResultPayload,
  CommandAction,
  CommandExecutePayload,
  ClientInfo,
} from "./control-plane-types.js";

export interface ControlPlaneOptions {
  httpServer: http.Server | https.Server;
  app?: Express;
  token?: string;
  cacheDir?: string;
  heartbeatTimeoutMs?: number;
  verbose?: boolean;
  allowedOrigins?: Set<string>;
  corsMode?: "localhost" | "private" | "all";
}

export interface PendingCommand {
  resolve: (value: CommandResultPayload) => void;
  reject: (reason: Error) => void;
  timeout: NodeJS.Timeout;
}

export interface ControlPlane {
  sendCommand: (
    clientId: string,
    action: CommandAction,
    args?: Record<string, unknown>,
    timeoutMs?: number,
  ) => Promise<CommandResultPayload>;
  broadcastCommand: (
    action: CommandAction,
    args?: Record<string, unknown>,
    timeoutMs?: number,
  ) => Promise<CommandResultPayload[]>;
  isClientConnected: (clientId: string) => boolean;
  getConnectedClients: () => ClientInfo[];
  getToken: () => string;
  close: () => void;
}

/**
 * Creates and mounts the Control Plane on the provided HTTP server and Express application.
 */
export function createControlPlane(options: ControlPlaneOptions): ControlPlane {
  const {
    httpServer,
    app,
    heartbeatTimeoutMs = 90_000,
    verbose = false,
  } = options;

  const token =
    options.token || getOrCreateControlToken(undefined, options.cacheDir);

  const wss = new WebSocketServer({ noServer: true });
  const activeSockets = new Map<string, WebSocket>();
  const socketToClientId = new Map<WebSocket, string>();
  const sseClientsByClientId = new Map<string, Response>();
  const pendingCommands = new Map<string, PendingCommand>();
  const sseClients = new Set<Response>();

  // Heartbeat stale client pruner interval
  const prunerInterval = setInterval(
    () => {
      pruneStaleClients(heartbeatTimeoutMs);
    },
    Math.max(10_000, Math.floor(heartbeatTimeoutMs / 2)),
  );
  if (typeof prunerInterval.unref === "function") {
    prunerInterval.unref();
  }

  function log(msg: string) {
    if (verbose) {
      console.log(`[control-plane] ${msg}`);
    }
  }

  function validateToken(providedToken?: string | null): boolean {
    if (!providedToken) {
      return false;
    }
    if (providedToken === token) {
      return true;
    }
    try {
      const currentToken = getOrCreateControlToken(undefined, options.cacheDir);
      if (currentToken && providedToken === currentToken) {
        return true;
      }
    } catch (_) {}
    return false;
  }

  function isSameOriginBrowser(req: http.IncomingMessage): boolean {
    const host = req.headers.host || "127.0.0.1";
    const origin = req.headers.origin;
    const referer = req.headers.referer;

    const isTrustedUrl = (urlStr: string): boolean => {
      try {
        const parsed = new URL(urlStr);
        if (parsed.host === host) {
          return true;
        }

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

        if (options.corsMode === "all") {
          return true;
        }

        if (
          options.allowedOrigins &&
          options.allowedOrigins.has(parsed.origin)
        ) {
          return true;
        }

        if (
          options.corsMode === "private" &&
          /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(hostname)
        ) {
          return true;
        }
      } catch (_) {}
      return false;
    };

    if (origin && isTrustedUrl(origin)) {
      return true;
    }

    if (referer && isTrustedUrl(referer)) {
      return true;
    }

    const secFetchSite = req.headers["sec-fetch-site"];
    if (secFetchSite === "same-origin" || secFetchSite === "same-site") {
      return true;
    }

    return false;
  }

  function extractTokenFromReq(
    req: http.IncomingMessage,
    parsedUrl: URL,
  ): string | null {
    const queryToken = parsedUrl.searchParams.get("token");
    if (queryToken) {
      return queryToken;
    }

    const headerToken = req.headers["x-control-token"];
    if (typeof headerToken === "string") {
      return headerToken;
    }

    const authHeader = req.headers["authorization"];
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authHeader.slice(7).trim();
    }

    return null;
  }

  // Handle WebSocket upgrade
  const upgradeHandler = (
    req: http.IncomingMessage,
    socket: any,
    head: Buffer,
  ) => {
    const host = req.headers.host || "127.0.0.1";
    const parsedUrl = new URL(req.url || "/", `http://${host}`);

    if (parsedUrl.pathname === "/ws/control") {
      const providedToken = extractTokenFromReq(req, parsedUrl);
      const isAuthValid = providedToken
        ? validateToken(providedToken)
        : isSameOriginBrowser(req);

      if (!isAuthValid) {
        log(
          `Rejected unauthorized WebSocket connection from ${req.socket.remoteAddress}`,
        );
        // Handle upgrade to reject cleanly via WebSocket close code 4001
        wss.handleUpgrade(req, socket, head, (ws) => {
          ws.close(4001, "Unauthorized");
        });
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    }
  };

  httpServer.on("upgrade", upgradeHandler);

  // Handle incoming message from client
  function handleIncomingMessage(
    ws: WebSocket | null,
    message: ControlMessage,
  ): ControlMessage | void {
    const { id, type, payload } = message;

    if (type === "client:register") {
      const reg = payload as ClientRegisterPayload;
      if (
        reg?.clientId &&
        typeof reg.clientId === "string" &&
        reg.clientId.trim()
      ) {
        const cleanClientId = reg.clientId.trim();
        registerClient({
          clientId: cleanClientId,
          deviceLabel: reg.deviceLabel || "Unknown device",
          capabilities: reg.capabilities || [],
          version: reg.version || "1.0.0",
          peerId: reg.peerId,
        });

        if (ws) {
          activeSockets.set(cleanClientId, ws);
          socketToClientId.set(ws, cleanClientId);
        }

        log(`Client registered: ${cleanClientId} (${reg.deviceLabel})`);

        const ack: ControlMessage = {
          id: ulid(),
          type: "server:registered",
          replyTo: id,
          payload: {
            clientId: cleanClientId,
            status: "ok",
            serverTime: Date.now(),
          },
        };

        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(ack));
        }

        return ack;
      } else {
        log("Warning: received client:register without valid clientId");
      }
    } else if (type === "client:heartbeat") {
      const hb = payload as ClientHeartbeatPayload;
      if (hb?.clientId) {
        updateClientHeartbeat(hb.clientId);
        log(`Heartbeat from client: ${hb.clientId}`);
      }
    } else if (type === "command:result") {
      const res = payload as CommandResultPayload;
      if (res?.commandId && pendingCommands.has(res.commandId)) {
        const pending = pendingCommands.get(res.commandId)!;
        clearTimeout(pending.timeout);
        pendingCommands.delete(res.commandId);
        pending.resolve(res);
        log(`Command ${res.commandId} resolved: success=${res.success}`);
      }
    }
  }

  // WebSocket connection handler
  wss.on("connection", (ws: WebSocket) => {
    log("WebSocket client connected");

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString()) as ControlMessage;
        handleIncomingMessage(ws, message);
      } catch (err: any) {
        log(`Error parsing WebSocket message: ${err.message}`);
      }
    });

    ws.on("close", () => {
      const clientId = socketToClientId.get(ws);
      if (clientId) {
        activeSockets.delete(clientId);
        socketToClientId.delete(ws);
        log(`Client disconnected: ${clientId}`);
      }
    });

    ws.on("error", (err) => {
      log(`WebSocket error: ${err.message}`);
    });
  });

  // Wire REST & SSE endpoints if Express app is provided
  if (app) {
    const adminAuthMiddleware = (
      req: Request,
      res: Response,
      next: NextFunction,
    ) => {
      const host = req.headers.host || "127.0.0.1";
      const parsedUrl = new URL(req.url, `http://${host}`);
      const providedToken = extractTokenFromReq(req, parsedUrl);

      if (!validateToken(providedToken)) {
        res.status(401).json({ error: "Unauthorized: Invalid control token" });
        return;
      }
      next();
    };

    const clientAuthMiddleware = (
      req: Request,
      res: Response,
      next: NextFunction,
    ) => {
      const host = req.headers.host || "127.0.0.1";
      const parsedUrl = new URL(req.url, `http://${host}`);
      const providedToken = extractTokenFromReq(req, parsedUrl);

      const isAuthValid = providedToken
        ? validateToken(providedToken)
        : isSameOriginBrowser(req);

      if (!isAuthValid) {
        res.status(401).json({ error: "Unauthorized: Invalid control token" });
        return;
      }
      next();
    };

    // Health / Probe endpoint for browser reachability checks and LNA permissions
    app.get("/api/control/health", (_req: Request, res: Response) => {
      res.json({
        status: "ok",
        controlPlane: true,
      });
    });

    // List all registered clients
    app.get(
      "/api/control/clients",
      adminAuthMiddleware,
      (_req: Request, res: Response) => {
        const clients = getAllClients();
        res.json({ clients });
      },
    );

    // Send a command to a client via REST
    app.post(
      "/api/control/command",
      adminAuthMiddleware,
      async (req: Request, res: Response) => {
        const { clientId, action, args, timeoutMs } = req.body || {};
        if (!clientId || !action) {
          res.status(400).json({ error: "clientId and action are required" });
          return;
        }

        try {
          const result = await sendCommand(clientId, action, args, timeoutMs);
          res.json(result);
        } catch (err: any) {
          res.status(err.message?.includes("not connected") ? 404 : 500).json({
            error: err.message,
          });
        }
      },
    );

    // Inbound messages over HTTP
    app.post(
      "/api/control/messages",
      clientAuthMiddleware,
      (req: Request, res: Response) => {
        const message = req.body as ControlMessage;
        if (!message || !message.type) {
          res.status(400).json({ error: "Invalid control message payload" });
          return;
        }

        const reply = handleIncomingMessage(null, message);
        res.json({ status: "received", reply });
      },
    );

    // SSE Events Stream
    app.get(
      "/api/control/events",
      clientAuthMiddleware,
      (req: Request, res: Response) => {
        const host = req.headers.host || "127.0.0.1";
        const parsedUrl = new URL(req.url, `http://${host}`);
        const clientId =
          parsedUrl.searchParams.get("clientId") ||
          (req.headers["x-client-id"] as string) ||
          undefined;

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders?.();

        sseClients.add(res);
        if (clientId) {
          sseClientsByClientId.set(clientId, res);
          log(`SSE client connected: ${clientId}`);
        }

        res.write(
          `event: ready\ndata: ${JSON.stringify({ status: "ok", serverTime: Date.now() })}\n\n`,
        );

        const keepAlive = setInterval(() => {
          if (!res.writableEnded) {
            res.write(": ping\n\n");
          }
        }, 15_000);

        req.on("close", () => {
          clearInterval(keepAlive);
          sseClients.delete(res);
          if (clientId && sseClientsByClientId.get(clientId) === res) {
            sseClientsByClientId.delete(clientId);
            log(`SSE client disconnected: ${clientId}`);
          }
        });
      },
    );
  }

  /**
   * Send a command to a connected client and wait for the result.
   */
  function sendCommand(
    clientId: string,
    action: CommandAction,
    args: Record<string, unknown> = {},
    timeoutMs: number = 30_000,
  ): Promise<CommandResultPayload> {
    const ws = activeSockets.get(clientId);
    const sseRes = sseClientsByClientId.get(clientId);

    const isWsOpen = ws && ws.readyState === WebSocket.OPEN;
    const isSseOpen = sseRes && !sseRes.writableEnded;

    if (!isWsOpen && !isSseOpen) {
      return Promise.reject(new Error(`Client not connected: ${clientId}`));
    }

    const commandId = ulid();
    const commandPayload: CommandExecutePayload = {
      commandId,
      action,
      args,
    };

    const message: ControlMessage = {
      id: ulid(),
      type: "command:execute",
      payload: commandPayload,
    };

    return new Promise<CommandResultPayload>((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingCommands.delete(commandId);
        reject(
          new Error(
            `Command ${action} to client ${clientId} timed out after ${timeoutMs}ms`,
          ),
        );
      }, timeoutMs);

      pendingCommands.set(commandId, { resolve, reject, timeout });

      try {
        if (isWsOpen) {
          ws!.send(JSON.stringify(message));
        } else if (isSseOpen) {
          sseRes!.write(
            `event: command:execute\ndata: ${JSON.stringify(message)}\n\n`,
          );
        }
      } catch (err: any) {
        clearTimeout(timeout);
        pendingCommands.delete(commandId);
        reject(err);
      }
    });
  }

  /**
   * Broadcast a command to all connected clients.
   */
  async function broadcastCommand(
    action: CommandAction,
    args: Record<string, unknown> = {},
    timeoutMs: number = 30_000,
  ): Promise<CommandResultPayload[]> {
    const allConnectedClientIds = new Set<string>([
      ...activeSockets.keys(),
      ...sseClientsByClientId.keys(),
    ]);

    const promises: Promise<CommandResultPayload>[] = [];
    for (const clientId of allConnectedClientIds) {
      if (isClientConnected(clientId)) {
        promises.push(
          sendCommand(clientId, action, args, timeoutMs).catch((err) => ({
            commandId: "",
            success: false,
            error: err.message,
          })),
        );
      }
    }
    return Promise.all(promises);
  }

  function isClientConnected(clientId: string): boolean {
    const ws = activeSockets.get(clientId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      return true;
    }
    const sseRes = sseClientsByClientId.get(clientId);
    if (sseRes && !sseRes.writableEnded) {
      return true;
    }
    return false;
  }

  function getConnectedClients(): ClientInfo[] {
    const all = getAllClients();
    return all.filter((c) => isClientConnected(c.clientId));
  }

  function close(): void {
    clearInterval(prunerInterval);
    httpServer.removeListener("upgrade", upgradeHandler);

    for (const [, pending] of pendingCommands) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Control plane closed"));
    }
    pendingCommands.clear();

    for (const ws of activeSockets.values()) {
      try {
        ws.close();
      } catch (_) {}
    }
    activeSockets.clear();
    socketToClientId.clear();

    for (const sseRes of sseClients) {
      try {
        sseRes.end();
      } catch (_) {}
    }
    sseClients.clear();
    sseClientsByClientId.clear();

    try {
      wss.close();
    } catch (_) {}
  }

  return {
    sendCommand,
    broadcastCommand,
    isClientConnected,
    getConnectedClients,
    getToken: () => token,
    close,
  };
}
