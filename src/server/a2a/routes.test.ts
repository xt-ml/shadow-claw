import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { registerA2ARoutes } from "./routes.js";
import { A2AHttpServer } from "./a2a-http-server.js";
import { A2ATaskStore } from "./a2a-task-store.js";
import { buildHttpAgentCard } from "./agent-card-builder.js";
import {
  A2A_METHOD,
  Role,
  TaskState,
} from "../../subsystems/channels/peer-protocol.js";

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

describe("A2A HTTP Routes", () => {
  let app: express.Express;
  let server: http.Server;
  let port: number;
  let taskStore: A2ATaskStore;
  let a2aServer: A2AHttpServer;
  const testToken = "secret-token-xyz";

  beforeAll(async () => {
    app = express();
    app.use(express.json());

    taskStore = new A2ATaskStore();
    const card = buildHttpAgentCard({
      baseUrl: "http://127.0.0.1:0",
      name: "ShadowClaw Server Node",
      version: "1.0.0",
    });

    a2aServer = new A2AHttpServer({
      agentCard: card,
      taskStore,
    });

    registerA2ARoutes(app, {
      httpServer: a2aServer,
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

  it("serves GET /.well-known/agent-card.json without requiring auth", async () => {
    const res = await makeHttpRequest({
      method: "GET",
      path: "/.well-known/agent-card.json",
      port,
    });

    expect(res.status).toBe(200);
    expect(res.data.name).toBe("ShadowClaw Server Node");
    expect(res.data.supportedInterfaces[0].protocolBinding).toBe("JSONRPC");
    expect(res.headers["access-control-allow-origin"]).toBeDefined();
  });

  it("rejects unauthorized POST /a2a when token configured", async () => {
    const res = await makeHttpRequest({
      method: "POST",
      path: "/a2a",
      port,
      body: {
        jsonrpc: "2.0",
        id: "1",
        method: A2A_METHOD.GET_AGENT_CARD,
      },
    });

    expect(res.status).toBe(401);
  });

  it("accepts authorized POST /a2a with x-control-token header", async () => {
    const res = await makeHttpRequest({
      method: "POST",
      path: "/a2a",
      port,
      headers: {
        "x-control-token": testToken,
      },
      body: {
        jsonrpc: "2.0",
        id: "auth-1",
        method: A2A_METHOD.GET_AGENT_CARD,
      },
    });

    expect(res.status).toBe(200);
    expect(res.data.id).toBe("auth-1");
    expect(res.data.result.name).toBe("ShadowClaw Server Node");
  });

  it("accepts authorized POST /a2a with Bearer authorization header", async () => {
    const res = await makeHttpRequest({
      method: "POST",
      path: "/a2a",
      port,
      headers: {
        authorization: `Bearer ${testToken}`,
      },
      body: {
        jsonrpc: "2.0",
        id: "auth-2",
        method: A2A_METHOD.GET_AGENT_CARD,
      },
    });

    expect(res.status).toBe(200);
    expect(res.data.id).toBe("auth-2");
  });

  it("handles SendMessage via POST /a2a", async () => {
    const res = await makeHttpRequest({
      method: "POST",
      path: "/a2a",
      port,
      headers: {
        "x-control-token": testToken,
      },
      body: {
        jsonrpc: "2.0",
        id: "send-1",
        method: A2A_METHOD.SEND_MESSAGE,
        params: {
          message: {
            messageId: "m-user-1",
            role: Role.USER,
            parts: [{ text: "Process server payload" }],
          },
        },
      },
    });

    expect(res.status).toBe(200);
    expect(res.data.result.task).toBeDefined();
    expect(res.data.result.task.status.state).toBe(TaskState.COMPLETED);
  });

  it("streams task updates over SSE at GET /a2a/tasks/:taskId", async () => {
    // Create an initial task in the store
    const task = taskStore.createTask({
      message: {
        messageId: "sse-1",
        role: Role.USER,
        parts: [{ text: "Stream this" }],
      },
    });

    const receivedChunks: string[] = [];
    const ssePromise = new Promise<void>((resolve, reject) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: `/a2a/tasks/${task.id}`,
          method: "GET",
          headers: {
            "x-control-token": testToken,
            Accept: "text/event-stream",
          },
        },
        (res) => {
          expect(res.statusCode).toBe(200);
          expect(res.headers["content-type"]).toContain("text/event-stream");

          res.on("data", (chunk) => {
            const str = chunk.toString();
            receivedChunks.push(str);
            if (str.includes(TaskState.COMPLETED)) {
              req.destroy();
              resolve();
            }
          });
        },
      );
      req.on("error", (err) => {
        // Socket closed is expected when req.destroy() is called
        if ((err as any).code === "ECONNRESET") {
          resolve();
        } else {
          reject(err);
        }
      });
      req.end();
    });

    // Wait slightly then transition task state to trigger SSE event
    setTimeout(() => {
      taskStore.updateTaskStatus(task.id, TaskState.WORKING);
      taskStore.updateTaskStatus(task.id, TaskState.COMPLETED);
    }, 50);

    await ssePromise;
    expect(receivedChunks.join("")).toContain("statusUpdate");
    expect(receivedChunks.join("")).toContain(TaskState.COMPLETED);
  });
});
