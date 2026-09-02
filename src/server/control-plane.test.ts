import http from "node:http";
import express from "express";
import { WebSocket } from "ws";
import { openClientStore, closeClientStore } from "./client-registry.js";
import { createControlPlane } from "./control-plane.js";
import type { AddressInfo } from "node:net";
import type {
  ControlMessage,
  ClientRegisterPayload,
  CommandResultPayload,
} from "./control-plane-types.js";

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
    if (options.body) {
      req.write(
        typeof options.body === "string"
          ? options.body
          : JSON.stringify(options.body),
      );
    }
    req.end();
  });
}

describe("control-plane", () => {
  let app: express.Express;
  let server: http.Server;
  let port: number;
  let token: string;
  let controlPlane: ReturnType<typeof createControlPlane>;

  beforeEach(async () => {
    openClientStore(":memory:");
    token = "test-secret-token";

    app = express();
    app.use(express.json());
    server = http.createServer(app);

    controlPlane = createControlPlane({
      httpServer: server,
      app,
      token,
      heartbeatTimeoutMs: 1000,
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        port = (server.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    controlPlane.close();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    closeClientStore();
  });

  describe("WebSocket connection and authentication", () => {
    it("rejects cross-origin connection with invalid or missing token", async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/control`, {
        headers: { Origin: "https://unauthorized-origin.com" },
      });
      const closeEvent = await new Promise<{ code: number; reason: string }>(
        (resolve) => {
          ws.on("close", (code, reason) =>
            resolve({ code, reason: reason.toString() }),
          );
        },
      );

      expect(closeEvent.code).toBe(4001); // Unauthorized code
    });

    it("accepts connection with valid query token", async () => {
      const ws = new WebSocket(
        `ws://127.0.0.1:${port}/ws/control?token=${token}`,
      );
      await new Promise<void>((resolve, reject) => {
        ws.on("open", () => resolve());
        ws.on("error", reject);
      });

      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();
    });

    it("accepts same-origin connection without token", async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/control`, {
        headers: { Origin: `http://127.0.0.1:${port}` },
      });
      await new Promise<void>((resolve, reject) => {
        ws.on("open", () => resolve());
        ws.on("error", reject);
      });

      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();
    });

    it("accepts GitHub Pages origin connection without token", async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/control`, {
        headers: { Origin: "https://xt-ml.github.io" },
      });
      await new Promise<void>((resolve, reject) => {
        ws.on("open", () => resolve());
        ws.on("error", reject);
      });

      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();
    });
  });

  describe("Client registration and heartbeat", () => {
    it("handles client:register message and responds with server:registered", async () => {
      const ws = new WebSocket(
        `ws://127.0.0.1:${port}/ws/control?token=${token}`,
      );
      await new Promise<void>((resolve) => ws.on("open", () => resolve()));

      const registerMsg: ControlMessage = {
        id: "msg-1",
        type: "client:register",
        payload: {
          clientId: "test-client-1",
          deviceLabel: "Test Device",
          capabilities: ["opfs", "webmcp"],
          version: "1.0.0",
        } as ClientRegisterPayload,
      };

      const responsePromise = new Promise<ControlMessage>((resolve) => {
        ws.on("message", (data) => {
          resolve(JSON.parse(data.toString()));
        });
      });

      ws.send(JSON.stringify(registerMsg));
      const response = await responsePromise;

      expect(response.type).toBe("server:registered");
      expect(response.replyTo).toBe("msg-1");
      expect(controlPlane.isClientConnected("test-client-1")).toBe(true);

      ws.close();
    });

    it("handles client:heartbeat and updates client registry", async () => {
      const ws = new WebSocket(
        `ws://127.0.0.1:${port}/ws/control?token=${token}`,
      );
      await new Promise<void>((resolve) => ws.on("open", () => resolve()));

      ws.send(
        JSON.stringify({
          id: "reg-1",
          type: "client:register",
          payload: {
            clientId: "test-client-hb",
            deviceLabel: "Test Device",
            capabilities: ["opfs"],
            version: "1.0.0",
          },
        }),
      );

      // Wait for registration
      await new Promise((resolve) => ws.once("message", resolve));

      const heartbeatMsg: ControlMessage = {
        id: "hb-1",
        type: "client:heartbeat",
        payload: {
          clientId: "test-client-hb",
        },
      };

      ws.send(JSON.stringify(heartbeatMsg));
      // Give server a moment to update
      await new Promise((resolve) => setTimeout(resolve, 50));

      const clients = controlPlane.getConnectedClients();
      expect(clients.some((c) => c.clientId === "test-client-hb")).toBe(true);

      ws.close();
    });
  });

  describe("Command execution", () => {
    it("dispatches command to client and receives result", async () => {
      const ws = new WebSocket(
        `ws://127.0.0.1:${port}/ws/control?token=${token}`,
      );
      await new Promise<void>((resolve) => ws.on("open", () => resolve()));

      ws.send(
        JSON.stringify({
          id: "reg-cmd",
          type: "client:register",
          payload: {
            clientId: "cmd-client",
            deviceLabel: "Cmd Client",
            capabilities: ["opfs"],
            version: "1.0.0",
          },
        }),
      );
      await new Promise((resolve) => ws.once("message", resolve));

      // Listen for incoming command and respond
      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString()) as ControlMessage;
        if (msg.type === "command:execute") {
          const payload = msg.payload as any;
          const resultMsg: ControlMessage = {
            id: "res-1",
            type: "command:result",
            replyTo: msg.id,
            payload: {
              commandId: payload.commandId,
              success: true,
              data: { answer: 42 },
            } as CommandResultPayload,
          };
          ws.send(JSON.stringify(resultMsg));
        }
      });

      const result = await controlPlane.sendCommand(
        "cmd-client",
        "read-state",
        { key: "foo" },
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ answer: 42 });

      ws.close();
    });

    it("rejects when sending command to unconnected client", async () => {
      await expect(
        controlPlane.sendCommand("nonexistent-client", "list-tasks", {}),
      ).rejects.toThrow(/not connected/i);
    });

    it("times out if client does not respond in time", async () => {
      const ws = new WebSocket(
        `ws://127.0.0.1:${port}/ws/control?token=${token}`,
      );
      await new Promise<void>((resolve) => ws.on("open", () => resolve()));

      ws.send(
        JSON.stringify({
          id: "reg-timeout",
          type: "client:register",
          payload: {
            clientId: "timeout-client",
            deviceLabel: "Timeout Client",
            capabilities: [],
            version: "1.0.0",
          },
        }),
      );
      await new Promise((resolve) => ws.once("message", resolve));

      // Do not respond to command, specify short timeout
      await expect(
        controlPlane.sendCommand(
          "timeout-client",
          "list-tasks",
          {},
          100, // 100ms timeout
        ),
      ).rejects.toThrow(/timed out/i);

      ws.close();
    });
  });

  describe("REST / SSE endpoints", () => {
    it("GET /api/control/health returns 200 with ok status and version", async () => {
      const res = await makeHttpRequest({
        port,
        path: "/api/control/health",
      });

      expect(res.status).toBe(200);
      expect(res.data.status).toBe("ok");
      expect(res.data.controlPlane).toBe(true);
    });

    it("GET /api/control/clients returns connected clients with valid token", async () => {
      const res = await makeHttpRequest({
        port,
        path: "/api/control/clients",
        headers: { "x-control-token": token },
      });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.data.clients)).toBe(true);
    });

    it("GET /api/control/clients returns 401 with invalid token from unauthorized origin", async () => {
      const res = await makeHttpRequest({
        port,
        path: "/api/control/clients",
        headers: {
          Origin: "https://unauthorized-origin.com",
          "x-control-token": "wrong-token",
        },
      });

      expect(res.status).toBe(401);
    });

    it("POST /api/control/messages processes message over HTTP", async () => {
      const res = await makeHttpRequest({
        port,
        path: "/api/control/messages",
        method: "POST",
        headers: { "x-control-token": token },
        body: {
          id: "http-msg-1",
          type: "client:register",
          payload: {
            clientId: "http-client-1",
            deviceLabel: "HTTP Client",
            capabilities: ["opfs"],
            version: "1.0.0",
          },
        },
      });

      expect(res.status).toBe(200);
      expect(res.data.status).toBe("received");
      expect(res.data.reply?.type).toBe("server:registered");
    });

    it("POST /api/control/messages processes message from GitHub Pages origin without token", async () => {
      const res = await makeHttpRequest({
        port,
        path: "/api/control/messages",
        method: "POST",
        headers: { Origin: "https://xt-ml.github.io" },
        body: {
          id: "http-msg-gh-1",
          type: "client:register",
          payload: {
            clientId: "http-client-gh",
            deviceLabel: "GitHub Pages Client",
            capabilities: ["opfs"],
            version: "1.0.0",
          },
        },
      });

      expect(res.status).toBe(200);
      expect(res.data.status).toBe("received");
      expect(res.data.reply?.type).toBe("server:registered");
    });

    it("dispatches command to SSE client and resolves when client POSTs result", async () => {
      // 1. Establish SSE connection
      let sseReq: http.ClientRequest;
      const sseEventsPromise = new Promise<{
        sseReq: http.ClientRequest;
        onEvent: (fn: (event: string, data: any) => void) => void;
      }>((resolve, reject) => {
        sseReq = http.request(
          {
            hostname: "127.0.0.1",
            port,
            path: `/api/control/events?clientId=sse-cmd-client&token=${token}`,
            method: "GET",
            headers: {
              Accept: "text/event-stream",
            },
          },
          (res) => {
            let buffer = "";
            let eventHandler: ((event: string, data: any) => void) | null =
              null;

            res.on("data", (chunk) => {
              buffer += chunk.toString();
              const lines = buffer.split("\n\n");
              buffer = lines.pop() || "";
              for (const block of lines) {
                if (!block.trim()) continue;
                let currentEvent = "message";
                let dataStr = "";
                for (const line of block.split("\n")) {
                  if (line.startsWith("event: ")) {
                    currentEvent = line.slice(7).trim();
                  } else if (line.startsWith("data: ")) {
                    dataStr = line.slice(6).trim();
                  }
                }
                if (dataStr && eventHandler) {
                  try {
                    eventHandler(currentEvent, JSON.parse(dataStr));
                  } catch (_) {}
                }
              }
            });

            resolve({
              sseReq,
              onEvent: (fn) => {
                eventHandler = fn;
              },
            });
          },
        );
        sseReq.on("error", reject);
        sseReq.end();
      });

      const { onEvent } = await sseEventsPromise;

      // 2. Register client via HTTP POST
      await makeHttpRequest({
        port,
        path: "/api/control/messages",
        method: "POST",
        headers: { "x-control-token": token },
        body: {
          id: "reg-sse-1",
          type: "client:register",
          payload: {
            clientId: "sse-cmd-client",
            deviceLabel: "SSE Cmd Client",
            capabilities: ["opfs"],
            version: "1.0.0",
            transport: "sse",
          },
        },
      });

      expect(controlPlane.isClientConnected("sse-cmd-client")).toBe(true);

      // 3. Listen for command:execute over SSE stream and reply via POST /api/control/messages
      onEvent(async (eventName, data) => {
        if (eventName === "command:execute") {
          const payload = data.payload;
          await makeHttpRequest({
            port,
            path: "/api/control/messages",
            method: "POST",
            headers: { "x-control-token": token },
            body: {
              id: "res-sse-1",
              type: "command:result",
              replyTo: data.id,
              payload: {
                commandId: payload.commandId,
                success: true,
                data: { sseResult: "success from sse" },
              },
            },
          });
        }
      });

      // 4. Send command from server
      const result = await controlPlane.sendCommand(
        "sse-cmd-client",
        "read-state",
        { test: true },
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ sseResult: "success from sse" });

      sseReq!.destroy();
    });
  });
});
