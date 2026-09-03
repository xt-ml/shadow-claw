import { describe, it, expect, jest } from "@jest/globals";
import {
  registerBuiltInTools,
  SHADOWCLAW_BUILTIN_TOOLS,
} from "./built-in-tools.js";
import { createClientToolRelay } from "./client-tool-relay.js";
import { McpServer } from "../mcp-server.js";

describe("ShadowClaw Built-in MCP Tools", () => {
  it("registers all built-in ShadowClaw control tools", () => {
    const server = new McpServer();
    const mockControlPlane: any = {
      getConnectedClients: jest.fn().mockReturnValue([
        {
          clientId: "client-1",
          deviceLabel: "Chrome Desktop",
          capabilities: ["opfs", "webmcp"],
          version: "1.25.0",
          lastSeen: Date.now(),
        },
      ]),
      sendCommand: (jest.fn() as any).mockResolvedValue({
        commandId: "cmd-1",
        success: true,
        data: { queued: true, groupId: "br:main" },
      }),
    };

    registerBuiltInTools(server, mockControlPlane);

    const toolNames = SHADOWCLAW_BUILTIN_TOOLS.map((t) => t.name);
    expect(toolNames).toContain("shadowclaw_list_clients");
    expect(toolNames).toContain("shadowclaw_send_message");
    expect(toolNames).toContain("shadowclaw_read_state");
    expect(toolNames).toContain("shadowclaw_list_tasks");
    expect(toolNames).toContain("shadowclaw_manage_backup");
  });

  it("executes shadowclaw_list_clients", async () => {
    const server = new McpServer();
    const mockControlPlane: any = {
      getConnectedClients: jest.fn().mockReturnValue([
        {
          clientId: "client-abc",
          deviceLabel: "MacBook Chrome",
          capabilities: ["opfs", "push", "webmcp"],
          version: "1.25.0",
          lastSeen: Date.now(),
        },
      ]),
    };

    registerBuiltInTools(server, mockControlPlane);

    const res = await server.handleRequest({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "shadowclaw_list_clients",
        arguments: {},
      },
    });

    expect(res).not.toBeNull();
    if (res && "result" in res) {
      expect(res.result.resultType).toBe("complete");
      const text = res.result.content[0].text;
      expect(text).toContain("client-abc");
      expect(text).toContain("MacBook Chrome");
    }
  });

  it("executes shadowclaw_send_message to active client", async () => {
    const server = new McpServer();
    const mockControlPlane: any = {
      getConnectedClients: jest
        .fn()
        .mockReturnValue([{ clientId: "client-1", deviceLabel: "Browser" }]),
      sendCommand: (jest.fn() as any).mockResolvedValue({
        commandId: "cmd-1",
        success: true,
        data: { queued: true, groupId: "br:main" },
      }),
    };

    registerBuiltInTools(server, mockControlPlane);

    const res = await server.handleRequest({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "shadowclaw_send_message",
        arguments: { text: "Hello from Claude Desktop" },
      },
    });

    expect(res).not.toBeNull();
    if (res && "result" in res) {
      expect(res.result.resultType).toBe("complete");
      expect(mockControlPlane.sendCommand).toHaveBeenCalledWith(
        "client-1",
        "send-message",
        { text: "Hello from Claude Desktop", groupId: undefined },
      );
    }
  });

  it("handles shadowclaw_send_message validation and disconnected errors", async () => {
    const server = new McpServer();
    const mockControlPlane: any = {
      getConnectedClients: jest.fn().mockReturnValue([]),
      sendCommand: (jest.fn() as any).mockResolvedValue({ success: false }),
    };
    registerBuiltInTools(server, mockControlPlane);

    // Empty text validation
    const resEmpty = await server.handleRequest({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "shadowclaw_send_message", arguments: { text: "" } },
    });
    expect(resEmpty).not.toBeNull();
    if (resEmpty && "result" in resEmpty) {
      expect(resEmpty.result.isError).toBe(true);
      expect(resEmpty.result.content[0].text).toContain("cannot be empty");
    }

    // No client connected
    const resNoClient = await server.handleRequest({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "shadowclaw_send_message", arguments: { text: "hi" } },
    });
    expect(resNoClient).not.toBeNull();
    if (resNoClient && "result" in resNoClient) {
      expect(resNoClient.result.isError).toBe(true);
      expect(resNoClient.result.content[0].text).toContain("No active");
    }
  });

  it("executes shadowclaw_read_state when client connected and error when not", async () => {
    const server = new McpServer();
    const mockControlPlane: any = {
      getConnectedClients: jest
        .fn()
        .mockReturnValue([{ clientId: "client-1", deviceLabel: "Browser" }]),
      sendCommand: (jest.fn() as any).mockResolvedValue({
        success: true,
        data: { state: "active" },
      }),
    };
    registerBuiltInTools(server, mockControlPlane);

    const res = await server.handleRequest({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "shadowclaw_read_state", arguments: {} },
    });
    expect(res).not.toBeNull();
    if (res && "result" in res) {
      expect(res.result.content[0].text).toContain("active");
    }

    // Disconnected
    mockControlPlane.getConnectedClients.mockReturnValue([]);
    const resDisc = await server.handleRequest({
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "shadowclaw_read_state", arguments: {} },
    });
    expect(resDisc).not.toBeNull();
    if (resDisc && "result" in resDisc) {
      expect(resDisc.result.isError).toBe(true);
    }
  });

  it("executes shadowclaw_list_tasks when client connected and error when not", async () => {
    const server = new McpServer();
    const mockControlPlane: any = {
      getConnectedClients: jest
        .fn()
        .mockReturnValue([{ clientId: "client-1", deviceLabel: "Browser" }]),
      sendCommand: (jest.fn() as any).mockResolvedValue({
        success: true,
        data: { tasks: [{ id: "t1" }] },
      }),
    };
    registerBuiltInTools(server, mockControlPlane);

    const res = await server.handleRequest({
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: {
        name: "shadowclaw_list_tasks",
        arguments: { groupId: "br:main" },
      },
    });
    expect(res).not.toBeNull();
    if (res && "result" in res) {
      expect(res.result.content[0].text).toContain("t1");
    }

    mockControlPlane.getConnectedClients.mockReturnValue([]);
    const resDisc = await server.handleRequest({
      jsonrpc: "2.0",
      id: 8,
      method: "tools/call",
      params: { name: "shadowclaw_list_tasks", arguments: {} },
    });
    expect(resDisc).not.toBeNull();
    if (resDisc && "result" in resDisc) {
      expect(resDisc.result.isError).toBe(true);
    }
  });

  it("handles shadowclaw_manage_backup actions: trigger, list, delete, and errors", async () => {
    const server = new McpServer();
    const mockControlPlane: any = {
      getConnectedClients: jest
        .fn()
        .mockReturnValue([{ clientId: "client-1", deviceLabel: "Browser" }]),
      sendCommand: (jest.fn() as any).mockResolvedValue({
        success: true,
        data: { backedUp: true },
      }),
      listBackups: (jest.fn() as any).mockResolvedValue([{ id: "backup-1" }]),
      deleteBackup: (jest.fn() as any).mockResolvedValue({ deleted: true }),
    };
    registerBuiltInTools(server, mockControlPlane);

    // trigger
    const resTrigger = await server.handleRequest({
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: {
        name: "shadowclaw_manage_backup",
        arguments: { action: "trigger" },
      },
    });
    expect(resTrigger).not.toBeNull();
    if (resTrigger && "result" in resTrigger) {
      expect(resTrigger.result.content[0].text).toContain("backedUp");
    }

    // trigger with no client
    mockControlPlane.getConnectedClients.mockReturnValue([]);
    const resTriggerNoClient = await server.handleRequest({
      jsonrpc: "2.0",
      id: 10,
      method: "tools/call",
      params: {
        name: "shadowclaw_manage_backup",
        arguments: { action: "trigger" },
      },
    });
    expect(resTriggerNoClient).not.toBeNull();
    if (resTriggerNoClient && "result" in resTriggerNoClient) {
      expect(resTriggerNoClient.result.isError).toBe(true);
    }
    mockControlPlane.getConnectedClients.mockReturnValue([
      { clientId: "client-1" },
    ]);

    // list
    const resList = await server.handleRequest({
      jsonrpc: "2.0",
      id: 11,
      method: "tools/call",
      params: {
        name: "shadowclaw_manage_backup",
        arguments: { action: "list" },
      },
    });
    expect(resList).not.toBeNull();
    if (resList && "result" in resList) {
      expect(resList.result.content[0].text).toContain("backup-1");
    }

    // delete without backupId
    const resDeleteNoId = await server.handleRequest({
      jsonrpc: "2.0",
      id: 12,
      method: "tools/call",
      params: {
        name: "shadowclaw_manage_backup",
        arguments: { action: "delete" },
      },
    });
    expect(resDeleteNoId).not.toBeNull();
    if (resDeleteNoId && "result" in resDeleteNoId) {
      expect(resDeleteNoId.result.isError).toBe(true);
      expect(resDeleteNoId.result.content[0].text).toContain("backupId");
    }

    // delete with backupId
    const resDelete = await server.handleRequest({
      jsonrpc: "2.0",
      id: 13,
      method: "tools/call",
      params: {
        name: "shadowclaw_manage_backup",
        arguments: { action: "delete", backupId: "b1" },
      },
    });
    expect(resDelete).not.toBeNull();
    if (resDelete && "result" in resDelete) {
      expect(resDelete.result.content[0].text).toContain("deleted");
    }

    // unsupported action
    const resUnsupported = await server.handleRequest({
      jsonrpc: "2.0",
      id: 14,
      method: "tools/call",
      params: {
        name: "shadowclaw_manage_backup",
        arguments: { action: "invalid_action" },
      },
    });
    expect(resUnsupported).not.toBeNull();
    if (resUnsupported && "result" in resUnsupported) {
      expect(resUnsupported.result.isError).toBe(true);
    }
  });

  it("executes shadowclaw_server_status", async () => {
    const server = new McpServer();
    const mockControlPlane: any = {
      getConnectedClients: jest
        .fn()
        .mockReturnValue([{ clientId: "client-1" }]),
    };
    registerBuiltInTools(server, mockControlPlane);

    const res = await server.handleRequest({
      jsonrpc: "2.0",
      id: 15,
      method: "tools/call",
      params: { name: "shadowclaw_server_status", arguments: {} },
    });
    expect(res).not.toBeNull();
    if (res && "result" in res) {
      expect(res.result.content[0].text).toContain("ShadowClaw");
      expect(res.result.content[0].text).toContain("healthy");
    }
  });
});

describe("Client Tool Relay", () => {
  it("discovers tools from connected client and proxies execution", async () => {
    const server = new McpServer();
    const mockControlPlane: any = {
      getConnectedClients: jest
        .fn()
        .mockReturnValue([{ clientId: "client-1", deviceLabel: "Browser" }]),
      sendCommand: jest
        .fn()
        .mockImplementation(async (_clientId, action, _args: any) => {
          if (action === "list-tools") {
            return {
              success: true,
              data: {
                tools: [
                  {
                    name: "read_file",
                    description: "Read workspace file",
                    inputSchema: {
                      type: "object",
                      properties: { path: { type: "string" } },
                      required: ["path"],
                    },
                  },
                ],
              },
            };
          }
          if (action === "invoke-tool") {
            return {
              success: true,
              data: {
                result: "File content here",
              },
            };
          }
          return { success: false, error: "Unknown action" };
        }),
    };

    const relay = createClientToolRelay(mockControlPlane);
    relay.attachToServer(server);

    // Tools list should discover relayed tool
    const tools = await server.getTools();
    const readFileTool = tools.find((t) => t.name === "read_file");
    expect(readFileTool).toBeDefined();
    expect(readFileTool?.description).toBe("Read workspace file");

    // Calling the tool should proxy to invoke-tool
    const res = await server.handleRequest({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "read_file",
        arguments: { path: "notes.txt" },
      },
    });

    expect(res).not.toBeNull();
    if (res && "result" in res) {
      expect(res.result.resultType).toBe("complete");
      expect(res.result.content[0].text).toContain("File content here");
    }
  });

  it("handles ask_user interactive MRTR loop via client relay", async () => {
    const server = new McpServer();
    const mockControlPlane: any = {
      getConnectedClients: jest
        .fn()
        .mockReturnValue([{ clientId: "client-1" }]),
      sendCommand: (jest.fn() as any).mockImplementation(
        async (_cid: string, action: string) => {
          if (action === "list-tools") {
            return {
              success: true,
              data: {
                tools: [
                  {
                    name: "ask_user",
                    description: "Ask question",
                    inputSchema: { type: "object", properties: {} },
                  },
                ],
              },
            };
          }
          return { success: true };
        },
      ),
    };

    const relay = createClientToolRelay(mockControlPlane);
    relay.attachToServer(server);

    // Initial call requires input
    const res1 = await server.handleRequest({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "ask_user",
        arguments: { question: "Are you sure?" },
      },
    });

    expect(res1).not.toBeNull();
    if (res1 && "result" in res1) {
      expect(res1.result.resultType).toBe("input_required");
      expect(res1.result.inputRequests[0].message).toBe("Are you sure?");
    }

    // Follow-up call with input response
    const res2 = await server.handleRequest({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "ask_user",
        arguments: { question: "Are you sure?" },
        inputResponses: { response: "Yes indeed" },
      },
    });

    expect(res2).not.toBeNull();
    if (res2 && "result" in res2) {
      expect(res2.result.resultType).toBe("complete");
      expect(res2.result.content[0].text).toBe("Yes indeed");
    }
  });

  it("handles client tool relay errors and disconnected state", async () => {
    const server = new McpServer();
    const mockControlPlane: any = {
      getConnectedClients: jest
        .fn()
        .mockReturnValue([{ clientId: "client-1" }]),
      sendCommand: (jest.fn() as any).mockImplementation(
        async (_cid: string, action: string) => {
          if (action === "list-tools") {
            return {
              success: true,
              data: {
                tools: [
                  {
                    name: "read_file",
                    description: "Read workspace file",
                    inputSchema: {
                      type: "object",
                      properties: { path: { type: "string" } },
                    },
                  },
                ],
              },
            };
          }
          return { success: false, error: "Execution failed on client" };
        },
      ),
    };

    const relay = createClientToolRelay(mockControlPlane);
    relay.attachToServer(server);
    await server.getTools();

    // Relayed tool error response
    const resErr = await server.handleRequest({
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "read_file", arguments: { path: "bad.txt" } },
    });
    expect(resErr).not.toBeNull();
    if (resErr && "result" in resErr) {
      expect(resErr.result.isError).toBe(true);
      expect(resErr.result.content[0].text).toContain(
        "Execution failed on client",
      );
    }

    // Thrown exception in sendCommand
    mockControlPlane.sendCommand.mockImplementation(
      async (_cid: string, action: string) => {
        if (action === "list-tools") {
          return {
            success: true,
            data: {
              tools: [
                {
                  name: "read_file",
                  description: "Read workspace file",
                  inputSchema: {
                    type: "object",
                    properties: { path: { type: "string" } },
                  },
                },
              ],
            },
          };
        }
        throw new Error("Network timeout");
      },
    );
    const resException = await server.handleRequest({
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: { name: "read_file", arguments: { path: "bad.txt" } },
    });
    expect(resException).not.toBeNull();
    if (resException && "result" in resException) {
      expect(resException.result.isError).toBe(true);
      expect(resException.result.content[0].text).toContain("Network timeout");
    }

    // No connected clients
    mockControlPlane.getConnectedClients.mockReturnValue([]);
    const resNoClient = await server.handleRequest({
      jsonrpc: "2.0",
      id: 8,
      method: "tools/call",
      params: { name: "read_file", arguments: { path: "bad.txt" } },
    });
    expect(resNoClient).not.toBeNull();
    if (resNoClient && "result" in resNoClient) {
      expect(resNoClient.result.isError).toBe(true);
      expect(resNoClient.result.content[0].text).toContain("No connected");
    }
  });
});
