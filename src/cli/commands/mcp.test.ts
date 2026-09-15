import { getProjectRoot } from "../utils/resolve-project-root.js";
import fs from "node:fs";
import path from "node:path";
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { createCliMcpEngine } from "./mcp.js";

const pkg = JSON.parse(
  fs.readFileSync(
    path.join(getProjectRoot(import.meta.url), "package.json"),
    "utf8",
  ),
);

describe("CLI MCP Engine (createCliMcpEngine)", () => {
  let errorSpy: any;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy?.mockRestore();
  });

  it("processes server/discover request", async () => {
    const mockClient = {
      listClients: jest
        .fn<any>()
        .mockResolvedValue([{ clientId: "c1", deviceLabel: "Browser Test" }]),
      sendCommand: jest.fn<any>().mockResolvedValue({
        success: true,
        data: {},
      }),
    };

    const engine = createCliMcpEngine({ client: mockClient });
    const res = await engine.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "server/discover",
    });

    expect(res).toBeDefined();
    expect(res.id).toBe(1);
    expect(res.result.protocolVersion).toBe("2026-07-28");
    expect(res.result.serverInfo.name).toBe("shadow-claw");
    expect(res.result.serverInfo.version).toBe(pkg.version);
  });

  it("processes tools/list including built-in and client tools", async () => {
    const mockClient = {
      listClients: jest
        .fn<any>()
        .mockResolvedValue([{ clientId: "c1", deviceLabel: "Browser Test" }]),
      sendCommand: jest
        .fn<any>()
        .mockImplementation(async (_clientId: string, action: string) => {
          if (action === "list-tools") {
            return {
              success: true,
              data: {
                tools: [
                  {
                    name: "read_file",
                    description: "Read workspace file",
                    inputSchema: { type: "object" },
                  },
                ],
              },
            };
          }
          return { success: true, data: {} };
        }),
    };

    const engine = createCliMcpEngine({
      client: mockClient,
      relayClientTools: true,
    });
    const res = await engine.handleMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    });

    expect(res).toBeDefined();
    expect(res.result.resultType).toBe("complete");
    const toolNames = res.result.tools.map((t: any) => t.name);
    expect(toolNames).toContain("shadowclaw_server_list_clients");
    expect(toolNames).toContain("shadowclaw_server_send_message");
    expect(toolNames).toContain("shadowclaw_server_send_notification");
    expect(toolNames).toContain("shadowclaw_server_status");
    expect(toolNames).toContain("shadowclaw_client_read_file");

    const notifTool = res.result.tools.find(
      (t: any) => t.name === "shadowclaw_server_send_notification",
    );
    expect(notifTool.inputSchema.properties).toHaveProperty("clientId");
  });

  it("populates clientId enum and description for shadowclaw_server_send_notification when push clients are registered", async () => {
    const mockClient = {
      listClients: jest.fn<any>().mockResolvedValue([]),
      listPushClients: jest.fn<any>().mockResolvedValue([
        { clientId: "client-pwa-1", deviceLabel: "Android Pixel" },
        { clientId: "client-pwa-2", deviceLabel: "iPad Safari" },
      ]),
    };

    const engine = createCliMcpEngine({
      client: mockClient,
      relayClientTools: false,
    });
    const res = await engine.handleMessage({
      jsonrpc: "2.0",
      id: 20,
      method: "tools/list",
    });

    expect(res).toBeDefined();
    expect(res.result.resultType).toBe("complete");
    const notifTool = res.result.tools.find(
      (t: any) => t.name === "shadowclaw_server_send_notification",
    );
    expect(notifTool).toBeDefined();
    const clientIdProp = notifTool.inputSchema.properties.clientId;
    expect(clientIdProp).toBeDefined();
    expect(clientIdProp.enum).toEqual(["client-pwa-1", "client-pwa-2"]);
    expect(clientIdProp.description).toContain("client-pwa-1 (Android Pixel)");
    expect(clientIdProp.description).toContain("client-pwa-2 (iPad Safari)");
  });

  it("processes tools/call for shadowclaw_send_notification directly via broadcastNotification", async () => {
    const mockClient = {
      listClients: jest.fn<any>().mockResolvedValue([]),
      broadcastNotification: jest.fn<any>().mockResolvedValue({
        sent: 2,
        failed: 0,
      }),
    };

    const engine = createCliMcpEngine({ client: mockClient });
    const res = await engine.handleMessage({
      jsonrpc: "2.0",
      id: 30,
      method: "tools/call",
      params: {
        name: "shadowclaw_send_notification",
        arguments: { title: "Custom Alert", body: "Server push message" },
      },
    });

    expect(res).toBeDefined();
    expect(res.result.resultType).toBe("complete");
    expect(res.result.isError).toBe(false);
    expect(res.result.content[0].text).toContain(
      "2 recipient(s) delivered, 0 failed",
    );
    expect(mockClient.broadcastNotification).toHaveBeenCalledWith({
      title: "Custom Alert",
      body: "Server push message",
    });
  });

  it("processes tools/call for send_notification alias directly via broadcastNotification", async () => {
    const mockClient = {
      listClients: jest.fn<any>().mockResolvedValue([]),
      broadcastNotification: jest.fn<any>().mockResolvedValue({
        sent: 1,
        failed: 0,
      }),
    };

    const engine = createCliMcpEngine({ client: mockClient });
    const res = await engine.handleMessage({
      jsonrpc: "2.0",
      id: 31,
      method: "tools/call",
      params: {
        name: "send_notification",
        arguments: { body: "Fallback push" },
      },
    });

    expect(res).toBeDefined();
    expect(res.result.resultType).toBe("complete");
    expect(res.result.isError).toBe(false);
    expect(mockClient.broadcastNotification).toHaveBeenCalledWith({
      title: "ShadowClaw",
      body: "Fallback push",
    });
  });

  it("handles empty body validation for shadowclaw_send_notification", async () => {
    const mockClient = {
      listClients: jest.fn<any>().mockResolvedValue([]),
      broadcastNotification: jest.fn<any>(),
    };

    const engine = createCliMcpEngine({ client: mockClient });
    const res = await engine.handleMessage({
      jsonrpc: "2.0",
      id: 32,
      method: "tools/call",
      params: {
        name: "shadowclaw_send_notification",
        arguments: { body: "" },
      },
    });

    expect(res).toBeDefined();
    expect(res.result.isError).toBe(true);
    expect(res.result.content[0].text).toContain("cannot be empty");
    expect(mockClient.broadcastNotification).not.toHaveBeenCalled();
  });

  it("targets a specific client in shadowclaw_send_notification", async () => {
    const mockClient = {
      listClients: jest.fn<any>().mockResolvedValue([]),
      broadcastNotification: jest.fn<any>().mockResolvedValue({
        sent: 1,
        failed: 0,
      }),
    };

    const engine = createCliMcpEngine({ client: mockClient });
    const res = await engine.handleMessage({
      jsonrpc: "2.0",
      id: 33,
      method: "tools/call",
      params: {
        name: "shadowclaw_send_notification",
        arguments: {
          title: "Direct Alert",
          body: "Direct push message",
          clientId: "client-target-99",
        },
      },
    });

    expect(res).toBeDefined();
    expect(res.result.isError).toBe(false);
    expect(res.result.content[0].text).toContain(
      "Push notification sent to client 'client-target-99': 1 recipient(s) delivered, 0 failed.",
    );
    expect(mockClient.broadcastNotification).toHaveBeenCalledWith({
      title: "Direct Alert",
      body: "Direct push message",
      clientId: "client-target-99",
    });
  });

  it("handles notFound warning when targeted client has no push subscriptions", async () => {
    const mockClient = {
      listClients: jest.fn<any>().mockResolvedValue([]),
      broadcastNotification: jest.fn<any>().mockResolvedValue({
        sent: 0,
        failed: 0,
        notFound: true,
      }),
    };

    const engine = createCliMcpEngine({ client: mockClient });
    const res = await engine.handleMessage({
      jsonrpc: "2.0",
      id: 34,
      method: "tools/call",
      params: {
        name: "shadowclaw_send_notification",
        arguments: {
          body: "Alert",
          clientId: "missing-client-id",
        },
      },
    });

    expect(res).toBeDefined();
    expect(res.result.isError).toBe(false);
    expect(res.result.content[0].text).toContain(
      "No push subscriptions found for client 'missing-client-id'",
    );
  });

  it("processes tools/call for shadowclaw_server_send_message and legacy alias", async () => {
    const mockClient = {
      listClients: jest
        .fn<any>()
        .mockResolvedValue([{ clientId: "c1", deviceLabel: "Browser Test" }]),
      sendCommand: jest.fn<any>().mockResolvedValue({
        success: true,
        data: { queued: true },
      }),
    };

    const engine = createCliMcpEngine({ client: mockClient });
    const res = await engine.handleMessage({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "shadowclaw_server_send_message",
        arguments: { text: "Test message" },
      },
    });

    expect(res).toBeDefined();
    expect(res.result.resultType).toBe("complete");
    expect(mockClient.sendCommand).toHaveBeenCalledWith("c1", "send-message", {
      text: "Test message",
      groupId: undefined,
    });

    // Legacy alias
    const resAlias = await engine.handleMessage({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "shadowclaw_send_message",
        arguments: { text: "Legacy test message" },
      },
    });
    expect(resAlias).toBeDefined();
    expect(resAlias.result.resultType).toBe("complete");
    expect(mockClient.sendCommand).toHaveBeenCalledWith("c1", "send-message", {
      text: "Legacy test message",
      groupId: undefined,
    });
  });

  it("processes tools/call for shadowclaw_server_status", async () => {
    const mockClient = {
      listClients: jest
        .fn<any>()
        .mockResolvedValue([{ clientId: "c1" }, { clientId: "c2" }]),
    };

    const engine = createCliMcpEngine({
      client: mockClient,
      version: "1.28.1",
    });
    const res = await engine.handleMessage({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "shadowclaw_server_status",
        arguments: {},
      },
    });

    expect(res).toBeDefined();
    expect(res.result.resultType).toBe("complete");
    const statusData = JSON.parse(res.result.content[0].text);
    expect(statusData.server).toBe("ShadowClaw");
    expect(statusData.connectedClients).toBe(2);
    expect(statusData.status).toBe("healthy");
  });

  it("processes tools/call for relayed client tool (e.g. shadowclaw_client_list_files)", async () => {
    const mockClient = {
      listClients: jest
        .fn<any>()
        .mockResolvedValue([{ clientId: "c1", deviceLabel: "Browser Test" }]),
      sendCommand: jest
        .fn<any>()
        .mockImplementation(
          async (_clientId: string, action: string, payload: any) => {
            if (action === "invoke-tool" && payload.toolName === "list_files") {
              return {
                success: true,
                data: {
                  result: ".agents/ MEMORY.md index.html -/",
                },
              };
            }
            return { success: false, error: "Not handled" };
          },
        ),
    };

    const engine = createCliMcpEngine({ client: mockClient });
    const res = await engine.handleMessage({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "shadowclaw_client_list_files",
        arguments: {},
      },
    });

    expect(res).toBeDefined();
    expect(res.id).toBe(4);
    expect(res.result.resultType).toBe("complete");
    expect(res.result.isError).toBe(false);
    expect(res.result.content[0].text).toBe(".agents/ MEMORY.md index.html -/");
    expect(mockClient.sendCommand).toHaveBeenCalledWith("c1", "invoke-tool", {
      toolName: "list_files",
      input: {},
    });

    // Also verify backward compatibility: calling with unprefixed name also proxies
    const resUnprefixed = await engine.handleMessage({
      jsonrpc: "2.0",
      id: 41,
      method: "tools/call",
      params: {
        name: "list_files",
        arguments: {},
      },
    });
    expect(resUnprefixed.result.content[0].text).toBe(
      ".agents/ MEMORY.md index.html -/",
    );
  });

  it("handles tools/call relayed client tool failure with informative error content", async () => {
    const mockClient = {
      listClients: jest
        .fn<any>()
        .mockResolvedValue([{ clientId: "c1", deviceLabel: "Browser Test" }]),
      sendCommand: jest.fn<any>().mockImplementation(async () => {
        return {
          success: false,
          error: "Permission denied reading directory",
        };
      }),
    };

    const engine = createCliMcpEngine({ client: mockClient });
    const res = await engine.handleMessage({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "shadowclaw_client_list_files",
        arguments: { path: "restricted" },
      },
    });

    expect(res).toBeDefined();
    expect(res.id).toBe(5);
    expect(res.result.resultType).toBe("complete");
    expect(res.result.isError).toBe(true);
    expect(res.result.content[0].text).toContain(
      "Permission denied reading directory",
    );
  });

  it("handles multi-client discovery and explicit clientId targeting", async () => {
    const mockClient = {
      listClients: jest.fn<any>().mockResolvedValue([
        { clientId: "client-alpha", deviceLabel: "Linux Desktop" },
        { clientId: "client-beta", deviceLabel: "Android Phone" },
      ]),
      sendCommand: jest
        .fn<any>()
        .mockImplementation(
          async (clientId: string, action: string, _payload: any) => {
            if (action === "list-tools") {
              const tools: any[] = [
                {
                  name: "list_files",
                  description: "List workspace files.",
                  inputSchema: {
                    type: "object",
                    properties: { path: { type: "string" } },
                  },
                },
              ];
              if (clientId === "client-alpha") {
                tools.push({
                  name: "ask_user",
                  description: "Ask user for confirmation.",
                  inputSchema: {
                    type: "object",
                    properties: { question: { type: "string" } },
                  },
                });
              }
              return {
                success: true,
                data: { tools },
              };
            }
            if (action === "invoke-tool") {
              return {
                success: true,
                data: {
                  result: `Files from ${clientId}`,
                },
              };
            }
            return { success: false };
          },
        ),
    };

    const engine = createCliMcpEngine({ client: mockClient });

    // 1. tools/list should augment schema with clientId enum and default client info
    const listRes = await engine.handleMessage({
      jsonrpc: "2.0",
      id: 10,
      method: "tools/list",
    });

    const listFilesTool = listRes.result.tools.find(
      (t: any) => t.name === "shadowclaw_client_list_files",
    );
    expect(listFilesTool).toBeDefined();
    expect(listFilesTool.description).toContain("[Default: Linux Desktop");
    expect(listFilesTool.inputSchema.properties.clientId).toBeDefined();
    expect(listFilesTool.inputSchema.properties.clientId.enum).toEqual([
      "client-alpha",
      "client-beta",
    ]);

    // ask_user should ONLY be available on client-alpha
    const askUserTool = listRes.result.tools.find(
      (t: any) => t.name === "shadowclaw_client_ask_user",
    );
    expect(askUserTool).toBeDefined();
    expect(askUserTool.description).toContain("[Client: Linux Desktop");
    expect(askUserTool.inputSchema.properties.clientId.enum).toEqual([
      "client-alpha",
    ]);

    // 2. tools/call targeting client-beta explicitly
    const callResBeta = await engine.handleMessage({
      jsonrpc: "2.0",
      id: 11,
      method: "tools/call",
      params: {
        name: "shadowclaw_client_list_files",
        arguments: { clientId: "client-beta" },
      },
    });

    expect(mockClient.sendCommand).toHaveBeenCalledWith(
      "client-beta",
      "invoke-tool",
      {
        toolName: "list_files",
        input: {},
      },
    );
    expect(callResBeta.result.content[0].text).toBe("Files from client-beta");

    // 3. Switch active default client to client-beta
    const setActiveRes = await engine.handleMessage({
      jsonrpc: "2.0",
      id: 12,
      method: "tools/call",
      params: {
        name: "shadowclaw_set_active_client",
        arguments: { clientId: "client-beta" },
      },
    });

    expect(setActiveRes.result.content[0].text).toContain(
      "Active default client set to: client-beta",
    );

    // 4. tools/call without clientId now defaults to client-beta for list_files
    const callResDefault = await engine.handleMessage({
      jsonrpc: "2.0",
      id: 13,
      method: "tools/call",
      params: {
        name: "shadowclaw_client_list_files",
        arguments: {},
      },
    });

    expect(callResDefault.result.content[0].text).toBe(
      "Files from client-beta",
    );

    // 5. Attempting to call ask_user on client-beta should be REJECTED because client-beta does not support it
    const unsupportedRes = await engine.handleMessage({
      jsonrpc: "2.0",
      id: 14,
      method: "tools/call",
      params: {
        name: "shadowclaw_client_ask_user",
        arguments: { clientId: "client-beta", question: "Prompt client beta?" },
      },
    });

    expect(unsupportedRes.result.isError).toBe(true);
    expect(unsupportedRes.result.content[0].text).toContain(
      "Tool 'shadowclaw_client_ask_user' is not enabled or available on client 'client-beta'",
    );
    expect(unsupportedRes.result.content[0].text).toContain(
      "Available on: client-alpha",
    );

    // 6. Calling ask_user without clientId should automatically default to client-alpha
    // (the only supporting client), even though active default is client-beta!
    const askUserRes = await engine.handleMessage({
      jsonrpc: "2.0",
      id: 15,
      method: "tools/call",
      params: {
        name: "shadowclaw_client_ask_user",
        arguments: { question: "Are you ready?" },
      },
    });

    expect(mockClient.sendCommand).toHaveBeenCalledWith(
      "client-alpha",
      "invoke-tool",
      {
        toolName: "ask_user",
        input: { question: "Are you ready?" },
      },
      300000,
    );
    expect(askUserRes.result.content[0].text).toBe("Files from client-alpha");

    // 7. tools/call for ask_user with inputResponses returns fulfilled response
    const fulfilledRes = await engine.handleMessage({
      jsonrpc: "2.0",
      id: 16,
      method: "tools/call",
      params: {
        name: "shadowclaw_client_ask_user",
        arguments: { question: "Are you ready?" },
        inputResponses: { response: "Yes, ready to go!" },
      },
    });
    expect(fulfilledRes.result.content[0].text).toBe("Yes, ready to go!");
  });

  it("handles client.listClients error gracefully in shadowclaw_server_list_clients and legacy alias", async () => {
    const mockClient = {
      listClients: jest
        .fn<any>()
        .mockRejectedValue(new Error("Unauthorized: Invalid control token")),
    };

    const engine = createCliMcpEngine({ client: mockClient });
    const res = await engine.handleMessage({
      jsonrpc: "2.0",
      id: 99,
      method: "tools/call",
      params: {
        name: "shadowclaw_server_list_clients",
        arguments: {},
      },
    });

    expect(res).toBeDefined();
    expect(res.id).toBe(99);
    expect(res.result.isError).toBe(true);
    expect(res.result.content[0].text).toContain(
      "Error listing clients: Unauthorized: Invalid control token",
    );

    // Legacy alias
    const resAlias = await engine.handleMessage({
      jsonrpc: "2.0",
      id: 100,
      method: "tools/call",
      params: {
        name: "shadowclaw_list_clients",
        arguments: {},
      },
    });
    expect(resAlias.result.isError).toBe(true);
  });
});
