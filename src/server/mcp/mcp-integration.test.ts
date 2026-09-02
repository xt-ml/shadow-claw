import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import WebSocket from "ws";
import { registerMcpRoutes } from "../routes/mcp.js";
import { createControlPlane } from "../control-plane.js";
import { openClientStore, closeClientStore } from "../client-registry.js";
import type { ControlMessage } from "../control-plane-types.js";

function postMcp(
  port: number,
  token: string,
  body: any,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/mcp",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-control-token": token,
          "mcp-protocol-version": "2026-07-28",
          ...headers,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          let parsed = data;
          try {
            parsed = JSON.parse(data);
          } catch (_) {}
          resolve({
            status: res.statusCode || 0,
            body: parsed,
            headers: res.headers,
          });
        });
      },
    );
    req.on("error", reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

describe("End-to-End MCP Server & Control Plane Relay", () => {
  let app: express.Express;
  let httpServer: http.Server;
  let port: number;
  let controlPlane: any;
  let wsClient: WebSocket;
  const token = "integration-secret-token";

  beforeAll(async () => {
    openClientStore(":memory:");

    app = express();
    app.use(express.json());
    httpServer = http.createServer(app);

    controlPlane = createControlPlane({
      httpServer,
      app,
      token,
      corsMode: "localhost",
    });

    registerMcpRoutes(app, {
      controlPlane,
      token,
      corsMode: "localhost",
    });

    await new Promise<void>((resolve) => {
      httpServer.listen(0, "127.0.0.1", () => {
        port = (httpServer.address() as AddressInfo).port;
        resolve();
      });
    });

    // Connect simulated browser client via WebSocket
    wsClient = new WebSocket(
      `ws://127.0.0.1:${port}/ws/control?token=${token}`,
    );
    await new Promise<void>((resolve, reject) => {
      wsClient.on("open", () => resolve());
      wsClient.on("error", reject);
    });

    // Register client
    wsClient.send(
      JSON.stringify({
        id: "reg-e2e",
        type: "client:register",
        payload: {
          clientId: "test-browser-client-e2e",
          deviceLabel: "Chrome Headless E2E",
          capabilities: ["opfs", "webmcp"],
          version: "1.25.0",
        },
      }),
    );

    await new Promise((resolve) => wsClient.once("message", resolve));

    // Command responder for simulated browser client
    wsClient.on("message", (raw) => {
      const msg = JSON.parse(raw.toString()) as ControlMessage;
      if (msg.type === "command:execute") {
        const payload = msg.payload as any;
        const commandId = payload.commandId;
        const action = payload.action;
        const args = payload.args || {};

        let resultData: any = {};
        if (action === "list-tools") {
          resultData = {
            tools: [
              {
                name: "workspace_status",
                description: "Check workspace files status",
                inputSchema: { type: "object", properties: {} },
              },
              {
                name: "read_file",
                description: "Read workspace file",
                inputSchema: {
                  type: "object",
                  properties: { path: { type: "string" } },
                  required: ["path"],
                },
              },
              {
                name: "ask_user",
                description: "Ask the user a question",
                inputSchema: {
                  type: "object",
                  properties: { question: { type: "string" } },
                  required: ["question"],
                },
              },
            ],
          };
        } else if (action === "invoke-tool") {
          if (args.toolName === "read_file") {
            resultData = {
              result: `Content of file ${args.input?.path}: Hello from Browser OPFS!`,
            };
          } else if (args.toolName === "workspace_status") {
            resultData = {
              result: { clean: true, filesCount: 42 },
            };
          }
        } else if (action === "read-state") {
          resultData = {
            activeGroupId: "br:main",
            state: "idle",
            model: "claude-3-5-sonnet",
          };
        } else if (action === "send-message") {
          resultData = {
            queued: true,
            receivedText: args.text,
            groupId: args.groupId || "br:main",
          };
        } else if (action === "list-tasks") {
          resultData = {
            tasks: [{ id: "task-e2e-1", name: "Daily Sync", enabled: true }],
          };
        }

        const replyMsg: ControlMessage = {
          id: `reply-${Date.now()}`,
          type: "command:result",
          replyTo: msg.id,
          payload: {
            commandId,
            success: true,
            data: resultData,
          },
        };
        wsClient.send(JSON.stringify(replyMsg));
      }
    });

    // Give server a moment to synchronize registration
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    wsClient.close();
    controlPlane.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    closeClientStore();
  });

  it("discovers server info via server/discover RPC", async () => {
    const res = await postMcp(
      port,
      token,
      {
        jsonrpc: "2.0",
        id: 1,
        method: "server/discover",
      },
      { "mcp-method": "server/discover" },
    );

    expect(res.status).toBe(200);
    expect(res.headers["mcp-protocol-version"]).toBe("2026-07-28");
    expect(res.body.result.protocolVersion).toBe("2026-07-28");
    expect(res.body.result.supportedProtocolVersions).toContain("2026-07-28");
    expect(res.body.result.capabilities.tools).toBeDefined();
  });

  it("lists both built-in ShadowClaw tools and relayed browser tools", async () => {
    const res = await postMcp(
      port,
      token,
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
      },
      { "mcp-method": "tools/list" },
    );

    expect(res.status).toBe(200);
    expect(res.body.result.resultType).toBe("complete");
    expect(res.body.result.ttlMs).toBe(5000);

    const toolNames = res.body.result.tools.map((t: any) => t.name);

    // Built-in tools
    expect(toolNames).toContain("shadowclaw_list_clients");
    expect(toolNames).toContain("shadowclaw_send_message");
    expect(toolNames).toContain("shadowclaw_read_state");
    expect(toolNames).toContain("shadowclaw_list_tasks");

    // Relayed browser tools
    expect(toolNames).toContain("read_file");
    expect(toolNames).toContain("workspace_status");
  });

  it("calls built-in tool shadowclaw_read_state and returns browser state", async () => {
    const res = await postMcp(
      port,
      token,
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "shadowclaw_read_state",
          arguments: { clientId: "test-browser-client-e2e" },
        },
      },
      { "mcp-method": "tools/call", "mcp-name": "shadowclaw_read_state" },
    );

    expect(res.status).toBe(200);
    expect(res.body.result.resultType).toBe("complete");
    const content = res.body.result.content[0].text;
    expect(content).toContain("br:main");
    expect(content).toContain("claude-3-5-sonnet");
  });

  it("calls relayed browser tool read_file across Control Plane and receives response", async () => {
    const res = await postMcp(
      port,
      token,
      {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "read_file",
          arguments: { path: "src/main.ts" },
        },
      },
      { "mcp-method": "tools/call", "mcp-name": "read_file" },
    );

    expect(res.status).toBe(200);
    expect(res.body.result.resultType).toBe("complete");
    expect(res.body.result.isError).toBeFalsy();
    const text = res.body.result.content[0].text;
    expect(text).toContain(
      "Content of file src/main.ts: Hello from Browser OPFS!",
    );
  });

  it("handles MRTR interactive flow for ask_user tool", async () => {
    // Round 1: ask_user request without inputResponses
    const res1 = await postMcp(
      port,
      token,
      {
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: {
          name: "ask_user",
          arguments: { question: "Are you ready?" },
        },
      },
      { "mcp-method": "tools/call", "mcp-name": "ask_user" },
    );

    expect(res1.status).toBe(200);
    expect(res1.body.result.resultType).toBe("input_required");
    expect(res1.body.result.inputRequests[0].id).toBe("response");
    expect(res1.body.result.inputRequests[0].message).toBe("Are you ready?");

    // Round 2: Client sends inputResponses with answer
    const res2 = await postMcp(
      port,
      token,
      {
        jsonrpc: "2.0",
        id: 6,
        method: "tools/call",
        params: {
          name: "ask_user",
          arguments: { question: "Are you ready?" },
          inputResponses: { response: "Yes, ready to proceed!" },
        },
      },
      { "mcp-method": "tools/call", "mcp-name": "ask_user" },
    );

    expect(res2.status).toBe(200);
    expect(res2.body.result.resultType).toBe("complete");
    expect(res2.body.result.content[0].text).toBe("Yes, ready to proceed!");
  });
});
